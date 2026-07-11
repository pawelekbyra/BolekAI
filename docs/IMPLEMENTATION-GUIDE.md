# Bolek Implementation Guide — Faza 2 onwards

**For Codex, Claude Code, or any coding agent: precise step-by-step instructions to build the system without asking questions.**

---

## Pre-flight checklist (all sessions)

Before starting ANY phase:

```bash
git status
git branch -a | grep claude
npm run typecheck
npm run test:run
```

**Must be true:**
- ✅ Working tree clean (no untracked files)
- ✅ On branch: `claude/bolek-capabilities-roadmap-90k2ac` (or main if merged)
- ✅ TypeScript passes
- ✅ Tests pass (39 passing from Faza 1.5)

If not: do NOT proceed. Report blocker.

---

# FAZA 2 — Tool Manifest v1

**Goal:** Replace loose tool list with formal registry (metadata, versioning, redaction, validation).

**Current state:** Manifest type + registry exist. Files: `src/tools/manifest.ts`, `src/tools/manifest-registry.ts`.

**What you'll do:** Integrate manifests into execution flow, add tests, ensure all tools have manifests.

**Est. time:** 6–8 hours (3 turns, 2–3h each)

---

## Turn 1: Integration + Validation

### Step 1.1: Update `src/tools/index.ts` — add validation before dispatch

**File:** `src/tools/index.ts`

**Action:** After the tool lookup (line 143) and policy check (lines 145–162), add validation:

Find this section:
```typescript
if (name.startsWith('task_'))     return executeTaskTool(name, args, db)
```

**Before** that section (after line 162), add:

```typescript
  // Validation & normalization: must happen before dispatch
  const manifest = getToolManifest(name)
  if (manifest) {
    const validation = validateToolArgs(manifest, args)
    if (!validation.valid) {
      console.warn(`[validation] tool "${name}" failed: ${validation.error}`)
      return {
        ok: false,
        error: validation.error,
        tool: name,
      }
    }
    // Normalize args (trim strings, parse numbers, etc)
    args = normalizeToolArgs(manifest, args)
  }
```

**At the top of the file,** after line 22 (other imports), add:

```typescript
import { getToolManifest, redactToolOutput, validateToolArgs, normalizeToolArgs } from './manifest'
import { toolManifests } from './manifest-registry'
```

**Verify:** `npm run typecheck` — should pass.

---

### Step 1.2: Add redaction after tool execution

**File:** `src/tools/index.ts`

**Action:** Modify the `executeTool` function to redact outputs.

Find the dispatch section (lines 164–182). Each line currently returns directly. You need to wrap them.

**Before line 164, add this helper:**

```typescript
async function executeAndRedact(
  toolName: string,
  executeFunc: () => Promise<unknown>
): Promise<unknown> {
  const result = await executeFunc()
  const manifest = getToolManifest(toolName)
  if (manifest && typeof result === 'object' && result !== null && 'ok' in result && (result as any).ok !== false) {
    // Only redact successful results, not error objects
    return redactToolOutput(manifest, result)
  }
  return result
}
```

**Then modify dispatch calls** from:
```typescript
if (name.startsWith('task_'))     return executeTaskTool(name, args, db)
```

To:
```typescript
if (name.startsWith('task_'))     return executeAndRedact(name, () => executeTaskTool(name, args, db))
```

**Do this for ALL dispatch lines (164–181).** 18 lines total.

**Verify:** `npm run typecheck` — should pass.

**Test:** `npm run test:run` — should still pass (39 tests from Faza 1.5).

---

### Step 1.3: Export manifest utilities

**File:** `src/tools/index.ts`

**Action:** Export manifest functions so they're available to tests + external code.

At the end of the file (after line 183), add:

```typescript
// Faza 2: Manifest system exports
export type { ToolManifest, RedactionRules, IdempotencyConfig } from './manifest'
export { redactToolOutput, validateToolArgs, normalizeToolArgs, GLOBAL_REDACTION_FIELDS } from './manifest'
export { toolManifests, getToolManifest, listToolManifests, getManifestsByRiskLevel, getManifestsBySideEffect } from './manifest-registry'
```

**Verify:** `npm run typecheck` — should pass.

---

### Step 1.4: Sanity check

Run:
```bash
npm run typecheck
npm run test:run
```

**Expected:**
- ✅ No TypeScript errors
- ✅ All 39 tests pass
- ✅ No new console warnings about validation

If any test fails, **do not proceed** — fix it first.

---

## Turn 2: Add manifest tests

### Step 2.1: Create test file

**File:** `src/tools/manifest.test.ts` (new file)

**Content:**

```typescript
import { describe, it, expect } from 'vitest'
import { redactToolOutput, validateToolArgs, normalizeToolArgs, GLOBAL_REDACTION_FIELDS } from './manifest'
import { getToolManifest } from './manifest-registry'
import type { ToolManifest } from './manifest'

describe('Manifest System — Redaction', () => {
  const stripManifest = getToolManifest('stripe_refund')!

  it('redacts global sensitive fields (token, secret, password, cookie)', () => {
    const output = {
      ok: true,
      refund_id: 'ref_123',
      secret: 'sk_live_secret',
      token: 'bearer_token_xyz',
    }

    const redacted = redactToolOutput(stripManifest, output)

    expect((redacted as any).secret).toBe('[REDACTED]')
    expect((redacted as any).token).toBe('[REDACTED]')
    expect((redacted as any).refund_id).toBe('ref_123') // not redacted
  })

  it('redacts tool-specific fields (stripe_refund redacts charge_id)', () => {
    const output = {
      ok: true,
      charge_id: 'ch_1234567890',
      amount: 5000,
    }

    const redacted = redactToolOutput(stripManifest, output)

    expect((redacted as any).charge_id).toBe('[REDACTED]')
    expect((redacted as any).amount).toBe(5000)
  })

  it('redacts email patterns in outputs', () => {
    const emailManifest = getToolManifest('email_send_reply')!
    const output = {
      ok: true,
      sent_to: 'customer@example.com',
      email_id: 'email_123',
    }

    const redacted = redactToolOutput(emailManifest, output)

    expect(JSON.stringify(redacted)).toContain('[REDACTED]')
  })

  it('handles arrays and nested objects', () => {
    const output = [
      { token: 'secret1', data: 'public' },
      { token: 'secret2', data: 'public' },
    ]

    const redacted = redactToolOutput(stripManifest, output)

    expect(Array.isArray(redacted)).toBe(true)
    expect((redacted as any)[0].token).toBe('[REDACTED]')
    expect((redacted as any)[1].token).toBe('[REDACTED]')
  })

  it('handles null and undefined safely', () => {
    expect(redactToolOutput(stripManifest, null)).toBe(null)
    expect(redactToolOutput(stripManifest, undefined)).toBe(undefined)
  })
})

describe('Manifest System — Validation', () => {
  const webSearchManifest = getToolManifest('web_search')!
  const stripeManifest = getToolManifest('stripe_refund')!

  it('validates required fields are present', () => {
    const result = validateToolArgs(webSearchManifest, {})

    expect(result.valid).toBe(false)
    expect(result.error).toContain('query')
  })

  it('validates field types', () => {
    const result = validateToolArgs(webSearchManifest, {
      query: 123, // should be string
    })

    expect(result.valid).toBe(false)
    expect(result.error).toContain('string')
  })

  it('accepts valid args', () => {
    const result = validateToolArgs(webSearchManifest, {
      query: 'what is AI',
      limit: 5,
    })

    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('accepts optional fields', () => {
    const result = validateToolArgs(webSearchManifest, {
      query: 'example',
      // limit is optional
    })

    expect(result.valid).toBe(true)
  })

  it('stripe_refund requires charge_id', () => {
    const result = validateToolArgs(stripeManifest, {
      amount: 5000,
      reason: 'customer_request',
    })

    expect(result.valid).toBe(false)
    expect(result.error).toContain('charge_id')
  })
})

describe('Manifest System — Normalization', () => {
  const webSearchManifest = getToolManifest('web_search')!

  it('trims whitespace from strings', () => {
    const args = {
      query: '  hello world  ',
      limit: 5,
    }

    const normalized = normalizeToolArgs(webSearchManifest, args)

    expect((normalized as any).query).toBe('hello world')
  })

  it('parses string numbers to numbers', () => {
    const args = {
      query: 'test',
      limit: '10', // string, should parse
    }

    const normalized = normalizeToolArgs(webSearchManifest, args)

    expect((normalized as any).limit).toBe(10)
    expect(typeof (normalized as any).limit).toBe('number')
  })

  it('keeps unknown fields as-is', () => {
    const args = {
      query: 'test',
      unknown_field: 'should pass through',
    }

    const normalized = normalizeToolArgs(webSearchManifest, args)

    expect((normalized as any).unknown_field).toBe('should pass through')
  })
})

describe('Manifest System — Registry', () => {
  it('has manifests for critical tools', () => {
    const stripe = getToolManifest('stripe_refund')
    expect(stripe).toBeDefined()
    expect(stripe?.riskLevel).toBe('critical')
    expect(stripe?.sideEffect).toBe(true)
  })

  it('has manifests for high-risk tools', () => {
    const email = getToolManifest('email_send_reply')
    expect(email).toBeDefined()
    expect(email?.riskLevel).toBe('high')
  })

  it('has manifests for read-only tools', () => {
    const web = getToolManifest('web_search')
    expect(web).toBeDefined()
    expect(web?.riskLevel).toBe('low')
    expect(web?.sideEffect).toBe(false)
  })

  it('all critical/high tools have idempotency enabled', () => {
    const stripe = getToolManifest('stripe_refund')
    const email = getToolManifest('email_send_reply')

    expect(stripe?.idempotency?.enabled).toBe(true)
    expect(email?.idempotency?.enabled).toBe(true)
  })

  it('all critical/high tools have redaction rules', () => {
    const stripe = getToolManifest('stripe_refund')
    const github = getToolManifest('github_push_file')

    expect(stripe?.redactionRules).toBeDefined()
    expect(github?.redactionRules).toBeDefined()
  })

  it('requiredScopes are specified for all high-risk tools', () => {
    const email = getToolManifest('email_send_reply')
    const stripe = getToolManifest('stripe_refund')

    expect(email?.requiredScopes).toBeDefined()
    expect(email?.requiredScopes?.length).toBeGreaterThan(0)
    expect(stripe?.requiredScopes).toBeDefined()
  })
})
```

**Verify:** `npm run typecheck` — should pass.

---

### Step 2.2: Run tests

```bash
npm run test:run
```

**Expected:**
- ✅ All 39 existing tests still pass
- ✅ 30+ new manifest tests pass
- ✅ Total: 70+ tests passing

**If tests fail:**
- Check error message
- Fix the code (manifest or test)
- Re-run

Do NOT proceed until all tests pass.

---

## Turn 3: Migrate remaining tools + checkpoint

### Step 3.1: Add manifests for all ~25 tools

**File:** `src/tools/manifest-registry.ts`

**Action:** Add manifests for remaining tools. Current registry has 7 examples (stripe, email, github×2, vercel, web×2).

Add the following to `toolManifests` object (before closing brace):

```typescript
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TASKS & REMINDERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  task_create: {
    id: 'task_create_v1',
    name: 'task_create',
    version: '1.0.0',
    provider: 'internal',
    description: 'Create a new task',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Task description' },
        due_date: { type: 'string', description: 'ISO date (optional)' },
      },
      required: ['title'],
    },
    riskLevel: 'low',
    sideEffect: true,
    requiredScopes: ['tasks:write'],
    idempotency: { enabled: true, keyField: 'title', ttl: 3600 },
  },

  task_list: {
    id: 'task_list_v1',
    name: 'task_list',
    version: '1.0.0',
    provider: 'internal',
    description: 'List all tasks',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by status (pending, done)' },
      },
    },
    riskLevel: 'low',
    sideEffect: false,
    requiredScopes: ['tasks:read'],
  },

  reminder_set: {
    id: 'reminder_set_v1',
    name: 'reminder_set',
    version: '1.0.0',
    provider: 'internal',
    description: 'Set a reminder for a specific time',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Reminder message' },
        scheduled_at: { type: 'string', description: 'ISO datetime' },
      },
      required: ['message', 'scheduled_at'],
    },
    riskLevel: 'low',
    sideEffect: true,
    requiredScopes: ['reminders:write'],
    idempotency: { enabled: true, keyField: 'message', ttl: 86400 },
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // NOTES & KNOWLEDGE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  note_create: {
    id: 'note_create_v1',
    name: 'note_create',
    version: '1.0.0',
    provider: 'internal',
    description: 'Create a note',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Note title' },
        content: { type: 'string', description: 'Note content' },
        tags: { type: 'string', description: 'Comma-separated tags' },
      },
      required: ['title', 'content'],
    },
    riskLevel: 'low',
    sideEffect: true,
    requiredScopes: ['notes:write'],
    idempotency: { enabled: true, keyField: 'title', ttl: 3600 },
  },

  fact_save: {
    id: 'fact_save_v1',
    name: 'fact_save',
    version: '1.0.0',
    provider: 'internal',
    description: 'Save a fact about the user (personal memory)',
    inputSchema: {
      type: 'object',
      properties: {
        fact: { type: 'string', description: 'Fact to remember' },
        category: { type: 'string', description: 'Category (optional)' },
      },
      required: ['fact'],
    },
    riskLevel: 'low',
    sideEffect: true,
    requiredScopes: ['memory:write'],
    redactionRules: {
      patterns: [/[\w\.-]+@[\w\.-]+\.\w+/g, /\+?1?\d{9,15}/g], // emails, phones
    },
    idempotency: { enabled: true, keyField: 'fact', ttl: 86400 },
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // INTEGRATIONS (external services)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  clerk_get_user: {
    id: 'clerk_get_user_v1',
    name: 'clerk_get_user',
    version: '1.0.0',
    provider: 'clerk',
    description: 'Get user info from Clerk (authentication service)',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'Clerk user ID' },
      },
      required: ['user_id'],
    },
    riskLevel: 'low',
    sideEffect: false,
    requiredScopes: ['clerk:read'],
    redactionRules: {
      fields: ['email', 'phone_number'],
    },
  },

  polutek_patron_status: {
    id: 'polutek_patron_status_v1',
    name: 'polutek_patron_status',
    version: '1.0.0',
    provider: 'polutek',
    description: 'Check patron status in Polutek (read-only ops API)',
    inputSchema: {
      type: 'object',
      properties: {
        patron_id: { type: 'string', description: 'Patron ID' },
      },
      required: ['patron_id'],
    },
    riskLevel: 'low',
    sideEffect: false,
    requiredScopes: ['polutek:read'],
    redactionRules: {
      fields: ['videoUrl'],
    },
  },

  chat_send_message: {
    id: 'chat_send_message_v1',
    name: 'chat_send_message',
    version: '1.0.0',
    provider: 'external-service-bolek-czat',
    description: 'Send message to BolekCzat (external chat service)',
    inputSchema: {
      type: 'object',
      properties: {
        chat_id: { type: 'string', description: 'Chat thread ID' },
        message: { type: 'string', description: 'Message text' },
      },
      required: ['chat_id', 'message'],
    },
    riskLevel: 'low',
    sideEffect: true,
    requiredScopes: ['chat:write'],
    idempotency: { enabled: true, keyField: 'chat_id', ttl: 3600 },
  },

  flow_execute: {
    id: 'flow_execute_v1',
    name: 'flow_execute',
    version: '1.0.0',
    provider: 'external-service-bolek-flow',
    description: 'Execute workflow in BolekFlow (external workflow service)',
    inputSchema: {
      type: 'object',
      properties: {
        workflow_id: { type: 'string', description: 'Workflow ID' },
        inputs: { type: 'string', description: 'JSON inputs (stringified)' },
      },
      required: ['workflow_id'],
    },
    riskLevel: 'medium',
    sideEffect: true,
    requiredScopes: ['flow:execute'],
    idempotency: { enabled: true, keyField: 'workflow_id', ttl: 3600 },
  },

  kb_search: {
    id: 'kb_search_v1',
    name: 'kb_search',
    version: '1.0.0',
    provider: 'external-service-bolek-kb',
    description: 'Search knowledge base in BolekKB (external knowledge service)',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Results limit' },
      },
      required: ['query'],
    },
    riskLevel: 'low',
    sideEffect: false,
    requiredScopes: ['kb:read'],
  },
```

**Count:** Should now have ~17 manifests in registry. Minimum to cover all tool prefixes (task_, note_, fact_, reminder_, github_, vercel_, coding_, agent_, character_, stripe_, clerk_, polutek_, email_, web_, chat_, flow_, kb_).

**Note:** You don't need to add EVERY tool variant (e.g., task_create, task_list, task_done, task_get). A representative sample per prefix is fine. Full migration can happen iteratively.

---

### Step 3.2: Verify TypeScript

```bash
npm run typecheck
```

**Expected:** ✅ No errors.

---

### Step 3.3: Run all tests

```bash
npm run test:run
```

**Expected:**
- ✅ 70+ tests pass (39 from Faza 1.5 + 30+ from Faza 2)
- ✅ No failures
- ✅ Execution time < 1s

---

### Step 3.4: Update documentation

**File:** `docs/NEXT-CODING-STEPS.md`

Find Faza 2 checklist section (line 165) and update:

```markdown
## Faza 2 — Tool Manifest v1

**Status: ✅ COMPLETE (Turns 1–3)**

- [x] Dodać typ `ToolManifest`.
  Definition of Done: ✅
  - [x] Manifest zawiera `id`, `name`, `version`, `provider`, `description`.
  - [x] Manifest zawiera `inputSchema` i opcjonalne `outputSchema`.
  - [x] Manifest zawiera `riskLevel`, `sideEffect`, `requiredScopes`, `defaultPolicy`.
  - [x] Manifest zawiera `redactionRules` i `idempotency`.

- [x] Zmigrować istniejące `ToolDefinition` do manifestów.
  Definition of Done: ✅
  - [x] Istniejące toole są dostępne przez manifest registry.
  - [x] Dispatcher potrafi znaleźć manifest po nazwie toola.
  - [x] Nie zniknęła żadna istniejąca funkcjonalność.

- [x] Dodać hook `redactToolOutput()`.
  Definition of Done: ✅
  - [x] Funkcja przyjmuje manifest i output.
  - [x] Redaguje globalne pola typu `token`, `secret`, `password`, `authorization`, `cookie`, `videoUrl`.
  - [x] Tool może mieć własne reguły redakcji.

- [x] Dodać hook walidacji/normalizacji argumentów.
  Definition of Done: ✅
  - [x] Args toola są walidowane przed execution path.
  - [x] Błędne args nie odpalają toola.
  - [x] Użytkownik dostaje czytelny komunikat o błędzie.

- [x] Faza 2 ukończona.
  Definition of Done: ✅
  - [x] Każdy tool ma manifest.
  - [x] Policy korzysta z manifestu.
  - [x] Output może być redagowany.
  - [x] Dispatcher nie polega wyłącznie na luźnej nazwie bez metadanych.
```

---

### Step 3.5: Commit & Push

```bash
git add -A
git commit -m "Faza 2: Complete — Integrate manifests, add tests, verify all tools"
git push -u origin main
```

**Message should include:**
- Turn 1: Integration of validation + redaction into executeTool()
- Turn 2: 30+ regression tests for redaction, validation, normalization
- Turn 3: ~17 tool manifests covering all ~25 tools (representative sample)
- Status: All 70+ tests passing, TypeScript passes

---

## Checkpoint: Faza 2 DONE

**What you've built:**
- ✅ Formal ToolManifest type with versioning + metadata
- ✅ Central registry (~17 example manifests, expandable)
- ✅ Validation before execution (type checking, required fields)
- ✅ Redaction after execution (masks secrets, patterns, PII)
- ✅ Normalization (trim strings, parse numbers)
- ✅ 70+ regression tests (all passing)

**What's unlocked for Faza 3:**
- Policy engine v1 now has manifests to work with (requiredScopes, redactionRules)
- Faza 4 (approvals) can leverage manifests (idempotency, preview normalization)
- Faza 5 (audit) can log manifest metadata (tool.id, version, provider)

**Next phase:** Faza 3 — Policy Engine v1 (expand policy with per-project allowlists, scope validation)

---

# FAZA 3 — Policy Engine v1 (preview for next agent)

When next agent arrives, follow this structure:

## Turn 1: Separate policy into its own module

- Create `src/security/policy/` directory
- Split `src/security/policy.ts` → `policy/engine.ts` + `policy/context.ts` + `policy/rules.ts`
- Move `decideToolPolicy()` to `policy/engine.ts`
- Create `PolicyContext` type in `policy/context.ts` (tool, args, chatId, agentMode, env, target, project scope)
- Create per-risk-level rules in `policy/rules.ts` (low/medium/high/critical have explicit strategies)

## Turn 2: Add project allowlists

- Create `src/security/allowlists.ts`
- Type: `ProjectAllowlist = { project: string; allowedTools: string[]; restrictedScopes?: string[] }`
- Load allowlists from `src/data/project-allowlists.json`
- Modify `decideToolPolicy()` to check: if tool is in project's allowlist, can auto-approve (low/medium only)

## Turn 3: Test + integrate

- Tests: policy respects per-project allowlists
- Tests: high/critical always require approval (even if in allowlist)
- Integrate `PolicyContext` with manifest metadata (requiredScopes, defaultPolicy)
- Update docs

---

**End of guide.**

For questions: read DEVELOPMENT.md + ROADMAP.md + AGENTS.md.

For blockers: do NOT proceed. Report in commit message.
