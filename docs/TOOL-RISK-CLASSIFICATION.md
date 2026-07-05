# Tool risk classification v1

This document records the first classification rule used by the prototype `ToolDefinition` registry. It is intentionally conservative: if a tool can mutate local storage, call an external service with durable effects, trigger asynchronous work, or affect production/business systems, it is not treated as read-only.

## Classification rule

- `low` + `sideEffect: false` — read-only lookup, status, listing, fetch, search, or summarization. These tools must not intentionally write durable state or trigger external actions.
- `medium` + `sideEffect: true` — local/user-scoped writes or bounded state changes such as notes, tasks, reminders, knowledge-base writes, character messages, or sending a message to the chat service. These actions are reversible or low blast-radius, but still change state.
- `high` + `sideEffect: true` + `requiresApproval: true` — actions that can create external work, write to GitHub, redeploy infrastructure, send email, or execute workflows. These can affect projects, users, or production systems and must not run autonomously.
- `critical` + `sideEffect: true` + `requiresApproval: true` — financial, destructive, credential/security, or similarly irreversible production operations. `stripe_refund` is classified as critical because it can move money and revoke patron access through Polutek ops.

## Current high/critical examples

- `email_send_reply` is high risk because it sends external communication.
- `github_create_issue` and `github_push_file` are high risk because they write to a repository.
- `vercel_redeploy` is high risk because it changes production deployment state.
- `flow_execute_workflow` is high risk because a workflow can perform downstream side effects.
- `stripe_refund` is critical risk because it performs a financial operation and may revoke access.

## Notes for future phases

`READ_ONLY_MODE=true` is now enforced in the central `executeTool()` dispatcher for every tool with `sideEffect: true`. Kill-switch and full policy-engine enforcement are added by later tasks in `docs/NEXT-CODING-STEPS.md`.
