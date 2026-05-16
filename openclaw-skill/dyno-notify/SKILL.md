---
name: dyno-notify
description: Send push notifications directly to the developer's phone via the Dyno relay server on Railway. Use this for all reminders, GitHub alerts, Discord error reports, and anything urgent. Prefer this over Discord for time-sensitive events.
requires:
  env:
    - DYNO_RELAY_URL
    - DYNO_RELAY_KEY
  bins:
    - curl
---

# Dyno Notify Skill

## When to use

- Cron reminders needing immediate attention
- GitHub activity spikes (3+ new issues, PR conflicts, failed builds)
- Discord error channel reports
- Heartbeat alerts requiring action before morning
- Any event marked urgent or high priority

## Priority levels

- `urgent` — critical, needs immediate action (use sparingly)
- `high` — important, check within the hour
- `default` — normal reminder or update
- `low` — informational, morning reading

## Source tags

- `github` — repository activity
- `discord` — channel monitoring alerts
- `reminder` — scheduled cron reminders
- `changelog` — language or dependency updates
- `system` — infrastructure alerts

## How to send a notification

```bash
curl -X POST "$DYNO_RELAY_URL/push?key=$DYNO_RELAY_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "TITLE_HERE",
    "message": "MESSAGE_HERE",
    "priority": "PRIORITY_HERE",
    "tag": "TAG_HERE",
    "source": "SOURCE_HERE"
  }'
```

## Decision rules

| Situation                             | Priority | Source    |
| ------------------------------------- | -------- | --------- |
| 3+ new GitHub issues in one heartbeat | high     | github    |
| New PR open >24hrs without review     | default  | github    |
| Critical bug label added to any repo  | urgent   | github    |
| New Discord error report              | high     | discord   |
| New Discord suggestion (5+ upvotes)   | low      | discord   |
| Scheduled reminder (PRs, standup)     | default  | reminder  |
| Java/Rust/Fabric API changelog        | low      | changelog |
| Railway relay health check failed     | urgent   | system    |

## Examples

### GitHub issue spike

```bash
curl -X POST "$DYNO_RELAY_URL/push?key=$DYNO_RELAY_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "DynoClient: Issue Spike",
    "message": "5 new issues opened in the last 30 minutes — possible bug in latest build",
    "priority": "high",
    "source": "github"
  }'
```

### Morning summary

```bash
curl -X POST "$DYNO_RELAY_URL/push?key=$DYNO_RELAY_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Good morning — Overnight Summary",
    "message": "3 new PRs, 7 issues, 2 Discord reports, Fabric API updated to 0.x.x",
    "priority": "low",
    "source": "reminder"
  }'
```

### Critical bug

```bash
curl -X POST "$DYNO_RELAY_URL/push?key=$DYNO_RELAY_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "CRITICAL — DynoClient",
    "message": "Critical bug label added to issue #XXX — memory leak in competitive mode",
    "priority": "urgent",
    "source": "github"
  }'
```

### Changelog update

```bash
curl -X POST "$DYNO_RELAY_URL/push?key=$DYNO_RELAY_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Fabric API Updated",
    "message": "Fabric API 0.x.x released — check for breaking changes affecting DynoClient",
    "priority": "low",
    "source": "changelog"
  }'
```

## Failure handling

If curl returns non-200, retry once after 10 seconds:

```bash
curl -X POST "$DYNO_RELAY_URL/push?key=$DYNO_RELAY_KEY" \
  -H "Content-Type: application/json" \
  -d '{...}' \
  --retry 1 \
  --retry-delay 10 \
  --retry-http-codes 500 502 503
```

If relay is unreachable after retry, fall back to Discord and note the failure in memory.
