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

Bolek (in Kulfon) can be the **orchestrator** for Kakałowy Sklepik — both deployment AND store operations:

```
Bolek (Telegram interface)
  ├─ routes to: Deployment Agent
  │  ├─ Monitors: GitHub Actions, Docker, Deployment
  │  ├─ Self-prompts Claude for fixes
  │  └─ Reports back to Bolek
  │
  └─ routes to: Store Manager Agent (NEW)
     ├─ Monitors: Orders, Payments, Inventory
     ├─ Processes: Refunds, Notifications
     ├─ Self-prompts Claude for decisions
     └─ Reports back to Bolek
```

User talks to Bolek, Bolek coordinates specialized agents per project.

---

## Store Manager Agent (for Kakałowy Sklepik)

### What It Does

Autonomous store operations manager that runs 24/7.

**Monitoring:**
```
✓ Stripe payments (successful/failed)
✓ Orders (new, shipped, returns)
✓ Inventory (low stock alerts)
✓ Customer inquiries (support tickets)
✓ Sales metrics (daily/weekly reports)
✓ Deployment health (API, database)
```

**Autonomous Actions:**
```
✓ Process refunds (payment failed → auto-refund)
✓ Send notifications (order received, shipped, etc.)
✓ Restock alerts (low inventory warnings)
✓ Answer FAQ (from knowledge base)
✓ Generate reports (daily sales summary)
✓ Monitor deployment (self-fix issues)
```

**Escalation to User:**
```
⚠️ Customer complaint (refund + negative review)
⚠️ Fraud detected (unusual purchase pattern)
⚠️ Technical issue (can't diagnose autonomously)
⚠️ Strategic decision (discontinue product, price change)
```

### Real Workflow: Customer Refund

```
Customer email arrives: "Chciałem inny smak, mogę zwrócić?"

  ↓ Agent reads email (IMAP webhook)
  ↓ Parses intent: "Refund request"
  ↓ Looks up order: #12345 (₹599) from Spree
  ↓ Self-prompts Claude:
     "Customer wants refund. Order #12345: ₹599.
      Refundable? Check Spree order status.
      Time window? Check order date.
      Action: Process refund?"
  ↓ Claude responds: "Yes, refundable. Process ₹599."
  ↓ Agent calls Stripe API: refund ₹599
  ↓ Updates Spree order: status = "refunded"
  ↓ Sends email: "Refund approved ✓"
  ↓ Logs customer behavior: CRM tracking
  ↓ Notifies you: "Refund processed for order #12345"

Done. Zero manual work. You wake up to summary.
```

### Daily Bolek Routine (Store Manager)

```
Morning (6 AM):
  ├─ Stripe: "10 orders processed overnight, ₹5,000 revenue"
  ├─ Inventory: "⚠️ Czekolada 70% low (3 units left)"
  ├─ Support: "3 new customer inquiries"
  ├─ Deployment: "All healthy ✓"
  └─ Telegram to You: Report + alerts

Throughout Day:
  ├─ New order → auto-send "Thanks for buying"
  ├─ Customer asks "Czy macie wersję bez cukru?" → bot answers FAQ
  ├─ Payment fails → auto-refund + notify
  ├─ Low stock → alert you
  └─ Deployment issue → self-fixes + reports

Customer Support:
  ├─ "Kiedy dostanę paczkę?" → answers based on order status
  ├─ "Czy można zmienić adres?" → escalates to you
  ├─ "Product review?" → records feedback
  └─ "Want discount code?" → generates personalized offer
```

### Tech Stack: Store Manager

**Integrations:**
- Spree Store API v3 (orders, products, inventory)
- Stripe API + webhooks (payments, refunds)
- IMAP/Email (customer inquiries)
- SMS/Email service (notifications)
- Analytics (sales metrics, customer behavior)
- Claude API (self-prompting for decisions)
- Telegram (user notifications + escalation)

**Autonomy Levels:**

| Action | Level | Rule |
|--------|-------|------|
| Process refund | 1 | If order refundable AND within window |
| Send notification | 1 | Always (low risk) |
| Answer FAQ | 1 | If confidence > 0.9 |
| Adjust inventory | 2 | Propose + wait for approval |
| Price change | 2 | Suggest + need user OK |
| Contact customer | 2 | Draft message + wait |
| Escalate issue | 3 | If unclear → user decides |

### Cost Analysis (Kakałowy)

**Monthly Costs:**
- Stripe webhook integration: $0 (built-in)
- Spree API calls: $0 (local)
- Claude API (store logic): ~$10-20
- Bolek runtime (Cloudflare): $0-5
- **Total: $10-25/month** for 24/7 store manager

**ROI:** Save 5-10 hours/month on manual store operations = easily pays for itself.

### Future Extensions

- **Recommendations:** Suggest products to customers
- **Dynamic pricing:** Adjust based on demand
- **Forecasting:** Predict inventory needs
- **Marketing:** Generate email campaigns
- **Analytics:** Deep customer behavior insights
- **Loyalty:** Auto-generate personalized offers

---

## Creator Platform Agent (for Polutek.pl)

**Reference:** [`pawelekbyra/polutek-pl`](https://github.com/pawelekbyra/polutek-pl)

### Polutek VOD Platform

Single-creator video platform with patron system:
- Videos at 3 access levels: PUBLIC, LOGGED_IN, PATRON
- Stripe tips above threshold grant lifetime patron status
- Tech: Next.js 15, Neon PostgreSQL, Clerk, Stripe, Cloudflare Stream
- Pre-launch (operational proof needed before production)

### What Bolek Does for Creator (Polutek)

**Patron System Manager:**
```
✓ New patron welcome → auto-email
✓ Daily revenue: "₹2,500 from 3 new patrons today"
✓ Weekly report: "15 patrons total, +20% growth"
✓ Churn detection: "Patron lapsed → try re-engage"
✓ Lifetime value tracking per patron
```

**Content Management:**
```
✓ Video upload confirmation
✓ PlaybackPlan decisions (PUBLIC vs PATRON)
✓ Caption status tracking (PL/EN WebVTT)
✓ Alert: "New video needs access tier decision"
✓ Auto-suggest: "Video trending, make patron-only?"
```

**Playback & Quality:**
```
✓ Cloudflare Stream playback errors
✓ Signed token generation failures
✓ Watch-time analytics: "45% drop at 12min mark"
✓ Region availability monitoring
✓ Suggest: "Viewers stopping here, check video"
```

**Community & Support:**
```
✓ Viewer FAQ: "How do I become patron?" → auto-answer
✓ Mailing list management
✓ Comment moderation
✓ Engagement analytics: "New viewers", "Regulars", "Patrons"
✓ Weekly sentiment: "Comments trending positive/negative"
```

**Creator Stats (Self-Prompting Claude):**
```
"Generate summary of this week"
  → Revenue, viewers, patrons, top videos

"Why did video 3 engagement drop?"
  → Analyze watch time, demographics

"Should we make video X patron-only?"
  → Suggest based on demand, patron feedback

"What's our patron retention rate?"
  → Calculate trends, forecast next month
```

**Real Weekly Workflow:**

```
Monday 9 AM:
Bolek → Telegram Summary:

"📊 Weekly Report (July 1-7)
 
Revenue:        ₹12,500 (+15% vs last week)
New Patrons:    12 (+45% YoY)
Total Viewers:  2,340 (+8%)
Videos:         5 published
Engagement:     Video #8: 89% completion ⭐

⚠️ Alert: Video #3 drop-off at 12min
✅ Suggestion: Promo video #8 (trending)

All systems healthy ✓
"
```

You glance at Telegram, make 1-2 decisions (e.g., "make #8 patron"), Bolek executes.

**Autonomy Levels:**
| Action | Level | Rule |
|--------|-------|------|
| Welcome email | 1 | Always |
| FAQ answer | 1 | If confidence > 0.9 |
| Daily report | 1 | Every morning |
| Suggest content tier | 2 | Propose, wait OK |
| Change video access | 2 | Ask first |
| Moderate comments | 2 | Flag, propose action |
| Escalate fraud | 3 | Always to creator |

**Cost:** ~$15-25/month added (Claude API + Bolek).

---

## Next Steps

1. **Prototype:** Build minimal self-prompting loop for Docker errors
2. **Test:** Run on Kakałowy Sklepik Oracle VPS
3. **Expand:** Add more error types to KNOWN_FIXABLE_ERRORS
4. **Monitor:** Track success rate of auto-fixes
5. **Integrate:** Connect to Bolek for unified control
6. **Scale:** Deploy Store Manager (Kakałowy), Creator Platform (Polutek)

---

**Author Note:** This is a living document. As we build Bolek and autonomous agents, patterns learned here should be fed back into the design. Each use case (deployment, e-commerce store, creator platform) teaches us about agent autonomy levels and escalation patterns.
