# Bolek — Owner-Only AI Operations Platform

## System Architecture

Bolek is a **personal AI agent platform** for managing life and business operations. It runs on Cloudflare Workers with D1 (SQLite) for persistence, Anthropic Claude for reasoning, and exposes itself through Telegram.

**Core principle:** Bolek is owner-only by default. Tool execution is policy-driven, not model-driven. Side-effect operations require explicit approval.

```
┌─────────────────────────────┐
│      INTERFACES             │
│  Telegram (primary)         │
│  Voice (Faza 12)            │
│  Web (planned)              │
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│   CLOUDFLARE WORKER         │
│   - Webhook receiver        │
│   - Request router          │
│   - Session management      │
└──────────────┬──────────────┘
               │
    ┌──────────┼──────────┐
    │          │          │
┌───▼──┐   ┌───▼──┐   ┌──▼──┐
│ D1   │   │ KV   │   │ AI  │
│ SQL  │   │Cache │   │Model│
└──────┘   └──────┘   └─────┘
    │          │
    └──────────┼──────────┐
               │          │
        ┌──────▼──────┐   │
        │  RUNTIME    │   │
        │  Core       │   │
        └──────┬──────┘   │
               │          │
    ┌──────────┼──────────┘
    │          │
┌───▼──────────▼─────────┐
│   EXECUTION PIPELINE   │
│ 1. Policy Engine       │
│ 2. Approval Engine     │
│ 3. Tool Execution      │
│ 4. Audit Logging       │
│ 5. Memory Update       │
└────────────────────────┘
    │
    └──────────┐
               │
    ┌──────────▼──────────┐
    │  12 CONNECTORS      │
    │ GitHub, Vercel,     │
    │ Email, Stripe,      │
    │ Clerk, Polutek      │
    └─────────────────────┘
```

## Implementation Status: 12/12 Phases Complete

### Faza 1 — Security Foundation ✅
Risk classification on all tools. Kill switches: `READ_ONLY_MODE`, `SIDE_EFFECTS_DISABLED`. Policy engine (`decideToolPolicy()`) before every tool call. Agent mode constraints: manual/confirm/autonomous.

### Faza 2-3 — Tool Manifest & Policy Engine ✅
Formalized tool metadata with versioning, scopes, risk levels, redaction rules. Centralized policy decision engine evaluating tool/mode/environment/limits.

### Faza 4-8 — Approval Engine, Audit, Workflows, Postgres, Memory ✅
Structured approval objects with TTL and idempotency. Audit event logging for all operations. Durable workflow foundation (Inngest). Postgres schema blueprint. Memory system with consent flow.

### Faza 9-10 — Command Center UI & Connector Refactor ✅
UI components for approvals, audit timeline, tasks, integrations. 6 live integrations with risk profiles, redaction, audit logging: GitHub, Vercel, Email, Stripe, Clerk, Polutek — implemented as tools in `src/tools/*.ts` (registered in `src/tools/index.ts`), sharing the manifest/redaction framework in `src/tools/manifest.ts`. (An earlier parallel `src/connectors/` class-based scaffold from this phase was never wired into the tool registry and was removed as dead code on 2026-07-11 — see "Corrections" below.)

### Faza 11 — Evals & Release Gates ✅
Regression test framework. 85+ test cases across 6 security categories: approval enforcement, prompt injection, memory consent, idempotency, redaction, critical operations.

### Faza 12 — Voice Interface ✅
Telegram voice notes → transcription → same policy pipeline as text. Critical operations (refund, delete, deploy) require explicit approval even when spoken. All voice commands audited.

---

## Execution Pipeline

Every request follows this path:

```
1. RECEIVE
   └─→ Telegram message (text/voice/callback)

2. PARSE & TRANSCRIBE
   └─→ Voice notes: transcribe to text
   └─→ Text: normalize & intent extraction

3. POLICY DECISION
   └─→ decideToolPolicy(tool, agent_mode, env)
   └─→ Allow | Deny | Require Approval | Require Step-Up Auth

4. APPROVAL FLOW (if required)
   └─→ Create approval object (ID, TTL, preview, risk level)
   └─→ Send approval message to user
   └─→ Wait for explicit approve/deny

5. EXECUTE
   └─→ Check idempotency key
   └─→ Run tool
   └─→ Redact output
   └─→ Log to audit trail

6. RESPOND
   └─→ Text response to Telegram
   └─→ Optional: voice response (audio file)

7. UPDATE STATE
   └─→ Write approval result
   └─→ Update memory if consent given
   └─→ Log execution to audit
```

---

## Security Model

### Risk Levels
- **Low**: Read-only, no side effects (list repos, check status)
- **Medium**: Side effects, reversible (send email, create issue, update patron)
- **High**: Side effects, partially reversible (GitHub push, Vercel deploy)
- **Critical**: Side effects, irreversible (Stripe refund, Polutek refund, Vercel rollback)

### Policy Decisions
```typescript
type PolicyDecision =
  | { type: 'allow' }
  | { type: 'deny'; reason: string }
  | { type: 'require_approval'; reason: string }
  | { type: 'require_step_up_auth'; reason: string }
```

### Kill Switches
- `READ_ONLY_MODE=true` → all side-effect tools blocked
- `SIDE_EFFECTS_DISABLED=true` → all side-effect tools blocked
- `AGENT_MODE=manual` → high/critical ops blocked
- `AGENT_MODE=confirm` → high/critical ops require approval
- `AGENT_MODE=autonomous` → no automatic high/critical ops

### Approval Requirements
- **Low risk**: execute immediately
- **Medium risk**: approval required if agent_mode=confirm or side effect
- **High risk**: approval required always
- **Critical risk**: approval required always, user must explicitly confirm

### Redaction Rules
Each connector applies redaction to outputs:
- Global: token, password, apiKey, authorization
- Patterns: sk_*, pk_*, emails, phone numbers
- Tool-specific: stripe refunds redact chargeId, clerk redacts emails, etc.

---

## Connectors (Faza 10)

> Despite the name, these are not a separate `src/connectors/` module — they are tools in
> `src/tools/*.ts` registered directly in `src/tools/index.ts`, sharing the risk/redaction
> framework in `src/tools/manifest.ts`. See "Corrections" below.

Each connector implements:

```typescript
interface ConnectorManifest {
  id: string                           // e.g. "github_v1"
  name: string                         // e.g. "github"
  version: string                      // semantic versioning
  provider: string                     // e.g. "GitHub"
  scopes: string[]                     // e.g. ["repo:read", "repo:write"]
  riskProfile: {
    default: RiskLevel                 // low | medium | high | critical
    byAction: Record<string, RiskLevel>// per-tool overrides
  }
  redactionRules: {
    globalFields: string[]             // token, password, apiKey, etc
    patterns: RegExp[]                 // /sk_.*/, /email@.*/, etc
    toolSpecific: Record<string, string[]> // per-tool field redaction
  }
  auditEvents: {
    logSensitiveArgs: boolean          // false for secrets
    logResult: boolean                 // true
    retentionDays: number              // 90-365
  }
  idempotency: {
    enabled: boolean                   // true for refunds
    keyExtractor?: (args) => string    // stripe-${chargeId}-refund
  }
}
```

### 6 Connectors
1. **GitHub** — repo management, read-only by default, write requires approval
2. **Vercel** — deployments, read-only by default, redeploy/rollback require approval
3. **Email** — IMAP/SMTP, read-only by default, send requires approval
4. **Stripe** — payments, read-only by default, refund is critical approval
5. **Clerk** — authentication, read-only, ban user requires approval
6. **Polutek** — VOD platform ops, read-only by default, refunds/revokes require critical approval

---

## Data Model

### Core Tables (D1 SQLite)
- **approvals**: Pending and executed approvals with TTL, status, idempotency key
- **audit_events**: All policy decisions, approvals, tool executions, memory updates
- **task_runs**: Durable workflow execution history (preparation for Inngest)
- **memory_items**: Layered memory (profile, project, operational, decision, episodic)

### Planned: Postgres (Future)
Migration targets for scale:
- identity (users, sessions)
- conversation (messages, agent_runs, agent_steps)
- approvals + audit_events + task_runs
- memory_items + connectors + eval_runs

---

## Evals & Testing (Faza 11)

Test suite covers:
1. **Approval enforcement** — critical ops require approval
2. **Prompt injection** — malicious inputs don't bypass policy
3. **Memory consent** — no personal data stored without approval
4. **Idempotency** — refunds can't execute twice
5. **Redaction** — secrets removed from tool outputs
6. **Critical operations** — refund, delete, deploy, rollback detected

```bash
npm test -- evals.test.ts
# Runs 85+ regression tests
# Categories: approval, security, memory, redaction, critical-ops
```

---

## Voice Interface (Faza 12)

### Pipeline
1. Telegram voice note received
2. Download audio file from Telegram
3. Transcribe to text (Cloudflare Workers AI)
4. Validate for critical operations (refund, delete, deploy, etc.)
5. Execute through same orchestrator as typed text
6. Send response (text + optional audio)

### Safety
✅ **Voice does NOT bypass approval** — same policy engine as text
✅ **Critical ops require explicit confirmation** — user sees/hears approval
✅ **All voice audited** — transcription + confidence + execution logged
✅ **Minimum confidence threshold** — low-confidence transcriptions rejected (< 85%)

Example:
```
User (voice): "Zwróć 50 złotych"
↓
Transcribed: "Zwróć 50 złotych" (confidence: 0.95)
↓
Policy: stripe_refund → risk_level = "critical" → require_approval
↓
Approval created: "Refund $50 to customer?"
User taps: APPROVE
↓
Stripe refund executed, response sent to Telegram
↓
Audit logged: voice_command + transcription + approval + execution
```

---

## File Structure

```
src/
  index.ts                    # Worker entry, route definitions
  telegram.ts                 # Telegram interface + voice routing
  orchestrator.ts             # AI model caller, tool dispatcher
  memory.ts                   # D1 memory read/write
  voice/
    telegram-voice.ts         # Telegram voice download + transcription
    voice-integrations.ts     # Webhook integration
    voice.test.ts             # Voice safety tests
  tools/
    index.ts                  # Tool registry - github/vercel/stripe/clerk/polutek/email wired in here
    manifest.ts               # Manifest types, redaction rules, risk levels
    manifest-*.test.ts        # Manifest tests
    github.ts, vercel.ts, stripe.ts, clerk.ts, polutek.ts, email-imap-smtp.ts  # the 6 live integrations
  security/
    policy.ts                 # re-exports decideToolPolicy from ../policy
    owner-guard.ts            # Bearer-token check gating every /api/* route
    owner-guard.test.ts
  approvals.ts                # ApprovalStore + helpers
  audit.ts                    # Audit event logger
  db/
    schema.sql                # D1 schema
    migrations/               # Schema evolution
evals/
  runner.ts                   # Eval framework
  evals.test.ts               # Regression test suite
  fixtures/                   # YAML test cases
    stripe-refund-approval.yaml
    prompt-injection-prevention.yaml
    memory-consent.yaml
    redaction-and-idempotency.yaml
wrangler.toml                 # Cloudflare Worker config
```

---

## Development Principles

1. **Never delete memory** — migrate, archive, transform; never drop
2. **No hardcoded behavior** — everything goes through the AI orchestrator
3. **Fail gracefully on Telegram** — always send a response, even on error
4. **Tools are pure functions** — receive input, return output, side effects only via D1
5. **One migration per change** — D1 schema changes via migrations/
6. **Audit everything** — policy decisions, approvals, executions all logged
7. **Redact by default** — all outputs redacted unless explicitly safe
8. **Voice equals text** — same policy engine for both inputs

---

## Environment Variables

```bash
TELEGRAM_BOT_TOKEN=          # from BotFather
TELEGRAM_WEBHOOK_SECRET=     # random, set once
BOLEK_API_KEY=               # required - Bearer token guarding every /api/* route (see Corrections)
GITHUB_TOKEN=                # for GitHub connector
VERCEL_TOKEN=                # for Vercel connector
STRIPE_API_KEY=              # for Stripe connector
CLERK_API_KEY=               # for Clerk connector
POLUTEK_API_KEY=             # for Polutek connector
EMAIL_IMAP_USER=             # for Email connector
EMAIL_IMAP_PASS=             # for Email connector
AI_MODEL=                    # Anthropic model ID
READ_ONLY_MODE=              # "true" to disable all side effects
SIDE_EFFECTS_DISABLED=       # "true" to disable all side effects
AGENT_MODE=                  # manual | confirm | autonomous
```

---

## Corrections (2026-07-11)

A status review found that this document and `docs/ROADMAP.md` had marked things "done" that
weren't actually true of the running system. Fixed in the same change that added this note:

- **`/api/*` had no authentication at all**, despite Faza 1's Definition of Done claiming
  "no operator endpoint is publicly usable without control." `/api/chat` (full orchestrator
  access), `/api/agents`, `/api/agents/tasks`, `/api/characters*`, `/api/briefing/polutek/preview`,
  `/api/config/polutek/status`, and `/api/ops/events` were reachable by anyone who found the
  Worker URL. Fixed with `src/security/owner-guard.ts` - a Bearer-token check applied to all of
  `/api/*` in `src/index.ts`. The web dashboard now sends this token via `bolekFetch()`
  (`web/lib/bolek-api.ts`), read from `NEXT_PUBLIC_BOLEK_API_KEY`.
  **Caveat**: `NEXT_PUBLIC_*` values ship inside the browser bundle. This stops anonymous/bot
  traffic from hitting the Worker directly, but does not make the dashboard page itself private
  to anyone who loads it and opens devtools. Put the dashboard behind Vercel deployment
  protection or Cloudflare Access if it must not be viewable by non-owners.
- **`src/connectors/` was dead code.** Faza 9-10 documented a class-based connector registry
  (`BaseConnector`, `registry.ts`, 28 passing tests) as if it were the production integration
  layer. Nothing outside that folder ever imported it - the actual GitHub/Vercel/Stripe/Clerk/
  Polutek/Email integrations that `src/tools/index.ts` dispatches to live in `src/tools/*.ts`.
  The unused folder was deleted; the real integrations are documented above under "Connectors
  (Faza 10)".

---

## Future Phases

### Phase 13: Postgres Migration
Migrate from D1 to Postgres for scale. D1 becomes cache layer.

### Phase 14: Multi-User Mode
Support multiple owner accounts with isolation. Required for SaaS.

### Phase 15: Third-Party Integrations
Open marketplace for community-built connectors.

### Phase 16: Knowledge Base
Semantic search over conversation history + documents.

### Phase 17: Custom Models
Fine-tuned Claude for specific domains (coding, content, etc).

### Phase 18: Phone Interface
Full voice call support via Vapi or similar.

---

## Getting Started

1. **Clone** the repository
2. **Install** dependencies: `npm install`
3. **Configure** environment variables in `.env.local`
4. **Develop** locally: `npx wrangler dev`
5. **Test** locally: `npm test`
6. **Deploy** to Cloudflare: `npm run deploy`

---

## Support

For questions:
- Read [`docs/VISION.md`](./VISION.md) for long-term strategy
- Read [`docs/MULTI-AGENT-ARCHITECTURE.md`](./MULTI-AGENT-ARCHITECTURE.md) for distributed architecture
- Read [`docs/POLUTEK-INTEGRATION.md`](./POLUTEK-INTEGRATION.md) for Polutek-specific ops

Issues: https://github.com/pawelekbyra/BolekAI/issues
