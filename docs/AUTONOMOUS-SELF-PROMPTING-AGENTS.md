# Autonomous Self-Prompting Agents

> **Status:** Architecture concept for autonomous agents that detect problems and self-prompt Claude API to generate fixes.
>
> **Motivation:** Agents living on dedicated infrastructure (VPS/servers) should diagnose issues, generate their own prompts to Claude, and apply fixes without human intervention.

---

## Problem Statement

Current agent workflows require human prompting:
```
Error in logs → User notices → User writes prompt → User asks Claude Code
                                                    ↓
                                        Claude responds with fix
```

**Goal:** Agents should operate autonomously:
```
Error in logs → Agent detects → Agent self-generates prompt → Claude fixes → Agent applies
                                                                               ↓
                                                                        User notified (success/failure)
```

---

## Architecture: Self-Prompting Loop

### Agent Running on Dedicated VPS

```
┌─────────────────────────────────────────────────────┐
│          Agent Daemon (on Oracle/VPS)               │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │ Monitoring Loop (continuous)                 │  │
│  │                                               │  │
│  │  while True:                                 │  │
│  │    logs = read_logs()  # Docker, Git, etc   │  │
│  │    metrics = check_health()                  │  │
│  │    alerts = parse_alerts()                   │  │
│  │                                               │  │
│  │    if error_detected(logs, metrics):         │  │
│  │      → Self-Prompt Claude (see below)        │  │
│  │      → Apply fix                             │  │
│  │      → Commit + push                         │  │
│  │      → Monitor result                        │  │
│  └──────────────────────────────────────────────┘  │
│                      │                              │
│                      ↓                              │
│  ┌──────────────────────────────────────────────┐  │
│  │ Claude API Client                            │  │
│  │ (self-generates prompts + calls Claude)      │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │ Execution Engine                             │  │
│  │ - Apply code changes                         │  │
│  │ - Commit + push to git                       │  │
│  │ - Trigger CI/CD workflows                    │  │
│  │ - Monitor deployment                         │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │ Notification Engine                          │  │
│  │ - Telegram alerts                            │  │
│  │ - Health reports                             │  │
│  │ - Escalation to user if needed               │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## Self-Prompting Pattern

### Error Detection → Prompt Generation

When agent detects an error:

```python
# 1. DETECT ERROR
error_log = """
ERROR: failed to build: resolve : lstat server: no such file or directory
Context: Docker build for spree-backend failed during GitHub Actions
"""

# 2. SELF-GENERATE PROMPT
prompt = f"""
You are a DevOps engineer for Kakałowy Sklepik backend (Spree Commerce).
The Docker build failed with this error:

{error_log}

Repository context:
- Monorepo structure: spree/ gems, server/ Rails host app (gitignored)
- .gitignore rule: server/* except !server/Dockerfile
- Problem: Docker build can't find server/Dockerfile

Analyze this error and provide ONLY the fix (code/command).
Explain the root cause briefly (1 line), then provide the fix.
"""

# 3. CALL CLAUDE
response = await claude_api.complete(prompt)

# 4. PARSE & APPLY
fix_code = parse_response(response)
apply_fix(fix_code)  # Creates file, modifies config, etc.

# 5. COMMIT & PUSH
commit("Auto-fix: " + extract_summary(response))
push_to_branch()

# 6. TRIGGER WORKFLOW
trigger_github_actions()

# 7. MONITOR RESULT
monitor_workflow_until_completion()
notify_user_of_result()
```

---

## Problem Classification & Autonomy Levels

Agent should decide: **"Can I fix this autonomously or escalate?"**

### Level 1: Fully Autonomous (No escalation)
```
✓ Docker build failures (missing dependencies, config issues)
✓ Deployment script bugs (shell syntax, logic)
✓ CI/CD workflow fixes (GitHub Actions config)
✓ Environment variable issues
✓ Known infrastructure problems (restart Redis, etc.)
```

**Decision Logic:**
```python
if error in KNOWN_FIXABLE_ERRORS:
    fix_autonomously()
elif error_severity == "HIGH" and user_on_call:
    escalate_to_user("URGENT")
else:
    log_issue_for_review()
```

### Level 2: Propose Fix + Wait for Approval
```
? Database schema changes
? API breaking changes
? Security-related fixes
? Changes affecting other services
```

### Level 3: User Escalation (Cannot fix)
```
✗ Unclear root cause
✗ Multiple possible fixes
✗ Business logic issues
✗ Third-party service failures
```

---

## For Kakałowy Sklepik: Deployment Agent Pattern

### Real Example: Auto-Fix Docker/Deploy Issues

```
┌─ Oracle VPS (Agent Home)
│
├─ [Monitoring Loop]
│  └─ Watches: GitHub Actions logs, Docker build, deployment status
│
├─ [Self-Prompt Examples]
│
│  Error 1: "Dockerfile not found"
│  ├─ Agent reads: .gitignore rules + git status
│  ├─ Generates prompt: "Why is server/Dockerfile missing from git?"
│  ├─ Claude suggests: "Add -f flag, commit Dockerfile"
│  ├─ Agent: `git add -f server/Dockerfile && git commit ...`
│  └─ Result: Workflow re-triggered → SUCCESS
│
│  Error 2: "docker-compose interactive prompt blocking SSH"
│  ├─ Agent reads: SSH deploy logs
│  ├─ Generates prompt: "SSH session blocked by docker-compose prompt. Fix?"
│  ├─ Claude suggests: "Add docker-compose down before up"
│  ├─ Agent: Edits workflow, commits, triggers
│  └─ Result: Deploy succeeds
│
│  Error 3: "GHCR push permission denied"
│  ├─ Agent reads: Build logs
│  ├─ Generates prompt: "How to skip GHCR push if permissions fail?"
│  ├─ Claude suggests: "Add continue-on-error: true"
│  ├─ Agent: Modifies workflow step
│  └─ Result: Deploy job still runs despite push failure
│
└─ [Telegram Notifications]
   ├─ "⚠️ Docker build failed, investigating..."
   ├─ "🔧 Applied fix: Added docker-compose down"
   ├─ "✓ Deployment successful"
   └─ "👤 Issue unclear, need your input: [link to logs]"
```

---

## Implementation Checklist for Kakałowy Sklepik

- [ ] Agent daemon running on Oracle VPS
- [ ] Monitoring: Read GitHub Actions logs via API
- [ ] Monitoring: SSH into VPS, check docker-compose status
- [ ] Error classification: Known errors → KNOWN_FIXABLE_ERRORS dict
- [ ] Claude API integration: Agent prompts Claude with error context
- [ ] Git automation: Commit + push fixes automatically
- [ ] Workflow trigger: Re-trigger GitHub Actions after fix
- [ ] Escalation: Telegram notification if fix fails or unknown error
- [ ] Approval gate: User can veto automatic fixes (via Telegram)
- [ ] Logging: Track all self-prompted Claude calls + fixes applied

---

## Tech Stack

**Agent Framework:**
- Node.js/Python service (runs 24/7 on VPS)
- Anthropic Claude API (for self-prompting)
- GitHub API (read logs, trigger workflows)
- Telegram Bot API (user notifications)
- SQLite/PostgreSQL (log history, decisions)

**Integration Points:**
```
Agent ←→ Claude API (self-prompt)
Agent ←→ GitHub API (read logs, push commits)
Agent ←→ Oracle VPS (SSH, Docker, kubectl)
Agent ←→ Telegram (user escalation)
```

---

## Future: Autonomous Development Agent

Extended pattern for code-level fixes:

```
Failing test in CI → Agent detects
                  ↓
            Agent reads test output
                  ↓
         "Why did this test fail?"
                  ↓
         Claude analyzes + proposes fix
                  ↓
         Agent applies fix to source code
                  ↓
         Agent runs tests locally (if possible)
                  ↓
         Agent commits + pushes
                  ↓
         Workflow runs → GREEN ✓
                  ↓
         User wakes up to: "✓ Test fixed automatically"
```

**Status:** Requires local test runner on VPS (Docker test environment).

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Agent applies wrong fix | Approval gate + staged rollout |
| Infinite loop of fix attempts | Max retry count + escalate after N failures |
| Agent breaks something | Rollback to previous commit if deploy fails |
| Sensitive data in logs | Redact secrets before prompting Claude |
| Claude suggests dangerous code | Policy layer: block DELETE operations without approval |
| User doesn't know what agent did | Telegram daily summary + git commit message |

---

## Decision Criteria: When to Self-Prompt Claude

```python
def should_self_prompt(error, context):
    # YES if:
    if error in KNOWN_FIXABLE_ERRORS:
        return True
    
    if error_severity == "LOW" and confidence > 0.8:
        return True
    
    if similar_fix_exists_in_history(error):
        return True
    
    # NO if:
    if involves_user_data:
        return False
    
    if involves_payment_system:
        return False
    
    if error_unclear:
        return False
    
    if first_time_seeing_error:
        return False
    
    return False
```

---

## Integration with Bolek

Bolek (in Kulfon) can be the **orchestrator** for Kakałowy Sklepik deployments:

```
Bolek (Telegram interface)
  ↓ routes to specific service
Self-Prompting Deployment Agent (specialized for Kakałowy)
  ├─ Monitors: GitHub Actions, Docker, Deployment
  ├─ Self-prompts Claude for fixes
  ├─ Reports back to Bolek
  └─ Bolek notifies user
```

User talks to Bolek, Bolek coordinates specialized agents per project.

---

## Next Steps

1. **Prototype:** Build minimal self-prompting loop for Docker errors
2. **Test:** Run on Kakałowy Sklepik Oracle VPS
3. **Expand:** Add more error types to KNOWN_FIXABLE_ERRORS
4. **Monitor:** Track success rate of auto-fixes
5. **Integrate:** Connect to Bolek for unified control

---

**Author Note:** This is a living document. As we build Bolek and autonomous agents, patterns learned here should be fed back into the design.
