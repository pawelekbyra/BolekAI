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
Security regression suite (`evals/evals.test.ts`) that drives the real `executeTool`/`decideToolPolicy`/`ApprovalStore`/audit/memory pipeline against a real in-memory SQLite database (`evals/fake-d1.ts`, via Node's `node:sqlite`) — not fixture-to-fixture comparisons. 6 scenario tests covering: approval enforcement (critical + high risk), prompt-injection resistance, double-execution prevention, output redaction, and memory consent + secret redaction. See "Corrections" below for what this replaced.

### Faza 12 — Voice Interface ✅
Telegram voice notes → real transcription via Cloudflare Workers AI (`@cf/openai/whisper`) → same policy pipeline as text. Wired into the live webhook in `src/telegram.ts`. Critical operations (refund, delete, deploy) require explicit approval even when spoken. All voice commands audited.

### 2026-07-15/16 Session — Multi-Channel Integration + Remote Compute ✅
MCP server (`src/mcp.ts`) exposes the full tool registry to Claude Code (`/mcp`, Bearer auth) and claude.ai (`/mcp/:secret`, path-secret auth), converting each `ToolDefinition` to a Zod schema at runtime. Vercel Web Analytics daily visits report (`src/visits-report.ts`) and hourly Vercel runtime-error monitor (`src/log-monitor.ts`) both follow the same pattern: KV-throttled, D1-audited, Telegram-alerting.

Remote compute went from idea to verified-working system: a headless Claude Code instance runs on an Oracle Cloud VM behind a small HTTP wrapper (`bolek-agent.service`, systemd), reachable from Bolek via the new `vm_claude_code` tool (`src/tools/vm-claude-code.ts` — `riskLevel: 'high'`, `requiresApproval: true`, same `runAction()` confirm-gate pattern as `coding_task`). Exposed over a Cloudflare Quick Tunnel (ephemeral, no auth, no uptime guarantee — acceptable for tonight, not for production). Verified through the real path end to end: Telegram message → policy engine creates approval → `/approve <id>` → wrapper calls `claude -p --dangerously-skip-permissions` on the VM → real file written and confirmed on disk → real cost reported back to the user ($0.0249 on Haiku for a working Python calculator). See "Corrections (2026-07-16)" below for two real bugs this end-to-end test surfaced that no automated check had caught.

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

`evals/evals.test.ts` runs 6 scenario tests against the real production code paths
(`executeTool`, `decideToolPolicy`, `ApprovalStore`, `auditEvent`, `executeMemoryTool`), backed
by a real SQLite database (`evals/fake-d1.ts` runs the actual migration SQL through Node's
`node:sqlite`, not a hand-rolled mock). It covers:

1. **Approval enforcement** — `stripe_refund` (critical) and `github_push_file` (high) require
   approval and never reach `fetch()` without it
2. **Prompt injection** — text crafted to look like an override instruction inside tool args
   does not change the policy decision (policy is driven by tool risk metadata, not by args content)
3. **Double-execution prevention** — approving/executing the same approval twice is rejected by
   the DB-level state transition guard (`WHERE status = 'pending'` / `'approved'`)
4. **Redaction** — a tool leaking `api_key`/`token` fields gets them replaced with `[REDACTED]`
   via the real `redactToolResult`
5. **Memory consent** — `memory_propose` never becomes `active` without an explicit
   `memory_approve` call, and secrets in the raw content are redacted before the row is written

```bash
npx vitest run evals/evals.test.ts
```

The full suite (`src/**/*.test.ts` + `evals/evals.test.ts`) is 84 tests across 10 files as of
2026-07-11 — see "Corrections" below for what this replaced.

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
✅ **Voice does NOT bypass approval** — transcribed text goes through the same
`processText()` path (`handleActionConfirmation` → `orchestrate` → `executeTool` →
`decideToolPolicy`) as typed messages
✅ **Critical ops require explicit confirmation** — user sees/hears approval
✅ **Tool executions are audited** — same `auditEvent()` calls as the text path
⚠️ **Confidence-based rejection is NOT implemented** — `VOICE_SAFETY_RULES.minTranscriptionConfidence`
in `src/voice/voice-integrations.ts` is a documented target, not enforced code; Workers AI Whisper
doesn't return a usable confidence score, and no code path currently checks one before executing.

Example:
```
User (voice): "Zwróć 50 złotych"
↓
Transcribed via Workers AI Whisper: "Zwróć 50 złotych"
↓
Policy: stripe_refund → risk_level = "critical" → require_approval
↓
Approval created: "Refund $50 to customer?"
User taps: APPROVE
↓
Stripe refund executed, response sent to Telegram
↓
Audit logged: policy_decision + approval_created + approval_executed
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
  fake-d1.ts                   # Real SQLite (node:sqlite) behind the D1Database interface
  evals.test.ts                # Security regression suite (see Faza 11 above)
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

## Corrections (2026-07-11, second pass)

A second, independent review re-verified every "done" claim against the running code instead of
trusting this document, and found the same overclaiming pattern repeating:

- **The eval suite tested nothing.** `evals/evals.test.ts` claimed "85+ regression tests" but
  contained 6 hardcoded fixture objects and 15 assertions that only checked one hardcoded JS value
  against another (e.g. `expect(stripeEval?.expected.approval_created).toBe(true)`). Nothing ever
  called `executeTool`, `decideToolPolicy`, or any other production function. `evals/runner.ts`
  (`EvalRunner`, `createMockExecutor`) and `evals/fixtures/*.yaml` were dead code — nothing loaded
  the YAML fixtures. **Rewritten**: the suite now runs 6 real scenarios against `executeTool` /
  `ApprovalStore` / `redactToolResult` / `executeMemoryTool`, backed by a real SQLite engine
  (`evals/fake-d1.ts`, via Node's built-in `node:sqlite`) executing the actual migration schema —
  not a mock. The dead `runner.ts` and unused fixtures were deleted.
- **Voice transcription was a hardcoded string.** `transcribeVoiceNote()` returned
  `'[Transcribed audio content would go here]'` with a comment admitting it was a placeholder, and
  `handleTelegramVoiceMessage`/`handleVoiceMessage` were never called from `src/telegram.ts` or
  `src/index.ts` — voice notes sent to the live webhook were silently dropped despite Faza 12 being
  marked ✅. **Fixed**: `transcribeVoiceNote()` now calls Workers AI (`env.AI.run('@cf/openai/whisper', ...)`),
  and `src/telegram.ts` routes `update.message.voice` to the voice handler with the same
  `processText()` pipeline text messages use (`src/telegram.test.ts` guards the wiring itself,
  not just the transcription function, against silently regressing to "defined but never called").
- **Writing real evals surfaced a genuine, previously-undetected bug**: every explicit tool
  manifest with a `require_approval` policy (`stripe_refund`, `email_send_reply`,
  `github_push_file`, `github_create_issue`, `vercel_redeploy`) declared a `required` input schema
  field set that didn't match the actual `ToolDefinition.parameters` the tool file uses at
  runtime (e.g. `stripe_refund`'s manifest required `charge_id`, but the tool only ever receives
  `paymentId`). Since `buildToolManifestRegistry()` lets the explicit manifest's `inputSchema`
  fully replace the generated one, **every real call to any of these five approval-gated tools
  would have been rejected before reaching the policy engine** with "Missing required argument."
  Fixed in `src/tools/manifest-registry.ts` by aligning each manifest's `inputSchema`/`required`/
  `idempotency.keyField` with the tool's actual parameters.
- **A real gap in secret redaction**: `redactMemoryContent()`'s regex only matched a secret
  keyword immediately adjacent to `:`/`=` (e.g. `password: x`), missing natural phrasing like
  "Hasło klienta to: x" — the exact kind of sentence an owner or the model would actually write.
  Fixed by widening the pattern to tolerate up to 25 characters between the keyword and the
  delimiter (`src/memory-items.ts`).
- The "112/112 tests passing" and "npm run typecheck clean" status line at the top of
  `CLAUDE.md` was stale for the same reason as the 85+ evals claim — the real count before this
  pass was 90/90, not 112/112, and is now 84 tests (fewer, because the old fake eval suite's 15
  tautological tests were replaced with 6 real ones) across 10 files. `npm run typecheck` and
  `npx wrangler deploy --dry-run` were independently re-verified as part of this pass.

## Corrections (2026-07-16)

`vm_claude_code` was the first approval-gated tool actually exercised through the real
Telegram → policy engine → `/approve` → execution path since Faza 4 was built. Every prior
approval-gated tool had only been unit-tested or dry-run — this was the first live fire, and it
found two bugs that no eval, typecheck, or dry-run could have, because both are about what the
*user* sees and types, not what the code returns:

- **The orchestrator invented a UI that doesn't exist.** `BASE_SYSTEM_PROMPT` in
  `src/orchestrator.ts` never specified how to present a `{ blocked: true, reason:
  'requires_approval' }` tool result. Left to its own judgment, the model (Haiku,
  `claude-haiku-4-5-20251001`) described an "Approve/Deny button" — but `send()` in
  `src/telegram.ts` never sets `parse_mode`, so Telegram renders plain text, no clickable
  anything. The user tapped nothing, got a friendly "OK, zatwierdzam!"-style reply that never
  called `ApprovalStore.approve()`, and the model re-proposed the same tool call on the next
  message, minting a fresh approval each time. Verified via direct D1 query: all 15 approvals
  created during the incident sat at `status: 'pending'`, `approved_at: null`. Fixed by adding an
  explicit instruction to `BASE_SYSTEM_PROMPT`: relay the approval ID and the literal
  `/approve <id>` / `/deny <id>` command verbatim, and do not retry the tool call until the user
  sends that command.
- **The approval command regex was not resilient to how it's actually copied.** `handleActionConfirmation`
  in `src/agent-mode.ts` matched `/^\/(approve|deny)\s+([0-9a-fA-F-]{36})$/` — an exact,
  anchored match. The approval ID is naturally shown to the user wrapped in backtick
  code-formatting for readability; copying that into Telegram carries the backticks along,
  which breaks the anchored match. The unmatched text silently fell through to
  `orchestrate()` as an ordinary message instead of producing an error, which is what made the
  first bug look like it was "working" — the model just answered conversationally. Fixed by
  stripping backticks/quotes/asterisks/whitespace from both ends of the input before matching.

**Lesson recorded for future sessions:** a `requiresApproval: true` tool with a green eval suite
and a clean dry-run is not verified until someone has actually approved and executed it through
the real interface a real user types into. Add "manually exercise the full approval round-trip
through Telegram" to the checklist for any new approval-gated tool, not just to its test file.

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
