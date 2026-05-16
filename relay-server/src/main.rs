use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    routing::{get, post},
    Json, Router,
    response::IntoResponse,
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::sync::broadcast;

// Notification payload from OpenClaw
#[derive(Deserialize, Serialize, Clone, Debug)]
struct Notification {
    title: String,
    message: String,
    priority: Option<String>,
    tag: Option<String>,
    source: Option<String>, // "github", "discord", "reminder" etc
}

// Shared state
#[derive(Clone)]
struct AppState {
    tx: broadcast::Sender<String>,
    api_key: String,
}

#[tokio::main]
async fn main() {
    let api_key = std::env::var("RELAY_API_KEY")
        .expect("RELAY_API_KEY must be set");

    let (tx, _rx) = broadcast::channel::<String>(100);

    let state = AppState { tx, api_key };

    let app = Router::new()
        .route("/push", post(receive_notification))
        .route("/ws", get(ws_handler))
        .route("/health", get(health))
        .with_state(state)
        .layer(
            tower_http::cors::CorsLayer::permissive()
        );

    let port = std::env::var("PORT")
        .unwrap_or_else(|_| "3000".to_string());
    println!("Dyno Relay running on 0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(
        format!("0.0.0.0:{}", port)
    ).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

// OpenClaw posts here
async fn receive_notification(
    State(state): State<AppState>,
    axum::extract::Query(params): axum::extract::Query<HashMap<String, String>>,
    Json(notification): Json<Notification>,
) -> impl IntoResponse {
    // Validate API key
    let key = params.get("key").map(|s| s.as_str()).unwrap_or("");
    if key != state.api_key {
        return (StatusCode::UNAUTHORIZED, "Invalid API key").into_response();
    }

    let payload = serde_json::to_string(&notification).unwrap();
    
    // Broadcast to all connected app clients
    let _ = state.tx.send(payload);
    
    (StatusCode::OK, "Delivered").into_response()
}

// App connects here via WebSocket
async fn ws_handler(
    ws: WebSocketUpgrade,
    axum::extract::Query(params): axum::extract::Query<HashMap<String, String>>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let key = params.get("key").map(|s| s.as_str()).unwrap_or("");
    if key != state.api_key {
        return (StatusCode::UNAUTHORIZED, "Invalid API key").into_response();
    }
    
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(mut socket: WebSocket, state: AppState) {
    let mut rx = state.tx.subscribe();
    
    println!("App connected");
    
    // Send keepalive pings + forward notifications
    loop {
        tokio::select! {
            msg = rx.recv() => {
                match msg {
                    Ok(notification) => {
                        if socket.send(Message::Text(notification)).await.is_err() {
                            break; // App disconnected
                        }
                    }
                    Err(_) => break,
                }
            }
            // Keepalive ping every 30s
            _ = tokio::time::sleep(tokio::time::Duration::from_secs(30)) => {
                if socket.send(Message::Ping(vec![])).await.is_err() {
                    break;
                }
            }
        }
    }
    println!("App disconnected");
}

async fn health() -> &'static str {
    "OK"
}