# AGENT BOLEK — Personal Life Automation Agent

## What this is

This is not an app. This is a **personal AI agent platform** — a living system that grows indefinitely alongside its owner.

The agent runs on Cloudflare Workers, speaks through Telegram (and eventually other interfaces), thinks via AI models, and acts through an ever-expanding set of tools. Every new capability added here makes the agent more powerful, more personal, and more autonomous.

**This project has no finish line.**

## Core Philosophy

### 1. Agent, not application
The system understands intent and selects tools. It does not have menus, buttons, or flows. You talk to it like a human assistant who happens to have superpowers.

### 2. Everything is a plugin
New life domain (finance, health, travel, phone calls, whatever) = new tool file. The orchestrator picks it up automatically. No rewrites, no architectural decisions needed.

### 3. Memory compounds
The agent accumulates context about its owner over time. An agent that knows you for 2 years is categorically more useful than one that knows you for 2 days. Memory is sacred — never throw it away.

### 4. Interfaces are interchangeable
Telegram is the first interface. Phone calls, email, web, AR glasses — each is just an input/output adapter to the same core. Adding a new interface does not change the agent's brain.

### 5. AI models are swappable
The agent is not married to any AI provider. The model is a dependency, not an identity. Free models on start, best models when needed.

## Architecture

```
┌─────────────────────────────────────────────┐
│                 INTERFACES                  │
│   Telegram │ Phone │ Email │ Web │ ...      │
└─────────────────────┬───────────────────────┘
                      │
┌─────────────────────▼───────────────────────┐
│            CLOUDFLARE WORKER                │
│         (webhook receiver + router)         │
└──────┬──────────────┬──────────────────┬────┘
       │              │                  │
┌──────▼──────┐ ┌─────▼──────┐ ┌────────▼────┐
│ ORCHESTRATOR│ │  D1 (SQL)  │ │  KV Store   │
│ (AI model)  │ │  memory    │ │  config     │
│ tool caller │ │  history   │ │  sessions   │
└──────┬──────┘ │  tasks     │ └─────────────┘
       │        └────────────┘
┌──────▼──────────────────────────────────────┐
│                   TOOLS                     │
│  tasks │ reminders │ notes │ finance │ ...  │
│  (each tool = one file, infinitely addable) │
└─────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Runtime | Cloudflare Workers | Edge, zero ops, free tier |
| Database | Cloudflare D1 (SQLite) | Persistent memory, SQL |
| Cache | Cloudflare KV | Fast config and sessions |
| Scheduler | Cloudflare Cron Triggers | Proactive agent behaviors |
| Interface | Telegram Bot API | Always in pocket, free |
| AI | Workers AI → pluggable | Start free, upgrade as needed |
| Language | TypeScript | Type-safe tools and schemas |
| Router | Hono | Minimal, Workers-native |

## File Structure

```
src/
  index.ts          # Worker entry, route definitions
  telegram.ts       # Telegram interface adapter
  orchestrator.ts   # AI model caller, tool dispatcher
  memory.ts         # D1 read/write helpers
  tools/
    index.ts        # Tool registry (add new tools here)
    tasks.ts        # Task and reminder management
    notes.ts        # Notes and knowledge base
    # ... add new files for new capabilities
  db/
    schema.sql      # D1 database schema
    migrations/     # Schema evolution over time
wrangler.toml       # Cloudflare config
```

## Adding a New Capability

1. Create `src/tools/your-domain.ts`
2. Export a tool definition (name, description, parameters, handler)
3. Register it in `src/tools/index.ts`
4. Done — the orchestrator will use it automatically

## Development Principles

- **Never delete memory** — migrate, archive, transform; never drop
- **No hardcoded behavior** — everything the agent does goes through the AI orchestrator
- **Fail gracefully on Telegram** — always send a response, even on error
- **Tools are pure functions** — they receive input, return output, have no side effects beyond D1 writes
- **One migration per change** — D1 schema changes always go through `db/migrations/`

## Future Interfaces (planned, not built)

- [ ] Phone calls (Twilio / Vapi)
- [ ] Email ingestion
- [ ] Voice notes from Telegram (already supported, needs transcription)
- [ ] Proactive daily briefings (Cron)
- [ ] Web dashboard (read-only view of agent state)
- [ ] Webhooks from external services (bank notifications, calendar, etc.)

## Environment Variables

```
TELEGRAM_BOT_TOKEN=     # from BotFather
TELEGRAM_WEBHOOK_SECRET= # random string, set once
AI_MODEL=               # e.g. @cf/meta/llama-3-8b-instruct
```

## Owner

This agent belongs to one person and is built for that person's life. It is not a SaaS product, not a startup, not a demo. It is infrastructure for a human.
