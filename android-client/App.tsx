import React, { useEffect, useState, useRef } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  FlatList, SafeAreaView, Platform 
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import { 
  loadNotifications, saveNotifications, 
  loadSettings, saveSettings, 
  NotificationPayload 
} from './storage';

// Configure how notifications behave when the app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);
  const [serverUrl, setServerUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Request permissions for notifications
    const requestPermissions = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Notification permissions not granted');
      }
    };
    requestPermissions();

    // Load initial data
    const init = async () => {
      const notifs = await loadNotifications();
      setNotifications(notifs);
      
      const settings = await loadSettings();
      setServerUrl(settings.url);
      setApiKey(settings.key);

      if (!settings.url) {
        setIsSettingsOpen(true);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!serverUrl || isSettingsOpen) return;

    let ws: WebSocket;
    let reconnectTimer: NodeJS.Timeout;

    const connect = () => {
      try {
        const wsUrl = serverUrl.startsWith('http') 
          ? serverUrl.replace('http', 'ws') 
          : serverUrl;
        
        const fullUrl = `${wsUrl}/ws?key=${encodeURIComponent(apiKey)}`;
        ws = new WebSocket(fullUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('Connected to Relay Server');
          setIsConnected(true);
        };

        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            const newNotif: NotificationPayload = {
              id: Math.random().toString(36).substring(7),
              timestamp: Date.now(),
              ...data,
            };
            
            setNotifications(prev => {
              const updated = [newNotif, ...prev];
              saveNotifications(updated);
              return updated;
            });

            // Trigger local notification
            Notifications.scheduleNotificationAsync({
              content: {
                title: data.title || 'New Notification',
                body: data.message || '',
                data: { source: data.source },
              },
              trigger: null, // Send immediately
            });
          } catch (err) {
            console.error('Failed to parse message', err);
          }
        };

        ws.onclose = () => {
          console.log('Disconnected from Relay Server');
          setIsConnected(false);
          // Try to reconnect in 5 seconds
          reconnectTimer = setTimeout(connect, 5000);
        };

        ws.onerror = (e: any) => {
          console.error('WebSocket error', e.message);
          ws.close();
        };
      } catch (err) {
        console.error('Connection setup failed', err);
        reconnectTimer = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [serverUrl, apiKey, isSettingsOpen]);

  const handleSaveSettings = () => {
    saveSettings(serverUrl, apiKey);
    setIsSettingsOpen(false);
  };

  const clearNotifications = () => {
    setNotifications([]);
    saveNotifications([]);
  };

  const renderItem = ({ item }: { item: NotificationPayload }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardTime}>
          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
      <Text style={styles.cardMessage}>{item.message}</Text>
      <View style={styles.cardFooter}>
        {item.source && <Text style={styles.badge}>{item.source}</Text>}
        {item.tag && <Text style={styles.badge}>{item.tag}</Text>}
      </View>
    </View>
  );

  if (isSettingsOpen) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.settingsContainer}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.label}>Relay Server URL</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. wss://dyno-relay.up.railway.app"
            placeholderTextColor="#888"
            value={serverUrl}
            onChangeText={setServerUrl}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.label}>API Key</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter API Key"
            placeholderTextColor="#888"
            value={apiKey}
            onChangeText={setApiKey}
            secureTextEntry
          />
          <TouchableOpacity style={styles.button} onPress={handleSaveSettings}>
            <Text style={styles.buttonText}>Save & Connect</Text>
          </TouchableOpacity>
        </View>
        <StatusBar style="light" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Dyno Relay</Text>
          <Text style={[styles.status, isConnected ? styles.statusConnected : styles.statusDisconnected]}>
            {isConnected ? '● Connected' : '○ Disconnected'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={clearNotifications} style={styles.iconButton}>
            <Ionicons name="trash-outline" size={24} color="#ccc" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsSettingsOpen(true)} style={styles.iconButton}>
            <Ionicons name="settings-outline" size={24} color="#ccc" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={64} color="#333" />
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        }
      />
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // slate-900
    paddingTop: Platform.OS === 'android' ? 40 : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b', // slate-800
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f8fafc', // slate-50
  },
  status: {
    fontSize: 12,
    marginTop: 4,
  },
  statusConnected: {
    color: '#10b981', // emerald-500
  },
  statusDisconnected: {
    color: '#ef4444', // red-500
  },
  headerActions: {
    flexDirection: 'row',
  },
  iconButton: {
    marginLeft: 15,
    padding: 5,
  },
  listContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#1e293b', // slate-800
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155', // slate-700
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f8fafc',
    flex: 1,
  },
  cardTime: {
    fontSize: 12,
    color: '#94a3b8', // slate-400
  },
  cardMessage: {
    fontSize: 15,
    color: '#cbd5e1', // slate-300
    lineHeight: 22,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    backgroundColor: '#334155',
    color: '#94a3b8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 12,
    overflow: 'hidden',
    marginRight: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyText: {
    color: '#64748b', // slate-500
    fontSize: 16,
    marginTop: 16,
  },
  settingsContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  label: {
    color: '#e2e8f0', // slate-200
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    marginTop: 20,
  },
  input: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 16,
    color: '#f8fafc',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#3b82f6', // blue-500
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 30,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
