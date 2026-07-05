# CODEX-PROMPT — Start Here

> Copy the text below and send it to Codex to start implementation.

---

## Prompt for Codex

```
You are working in repository /home/user/BolekAI on branch claude/multi-repo-agent-j3bo9v.

Read the file CODEX-INSTRUCTIONS.md in this repo.

Implement BolekAI according to those instructions, in order:

Phase 1: Memory System
- Task 1.1: D1 schema (conversations, messages, facts, tasks)
- Task 1.2: Memory helper class with CRUD operations

Phase 2: Tool Handlers
- Task 2.1: Tool type system
- Task 2.2: Tasks tool handler
- Task 2.3: Knowledge tool handler
- Task 2.4: Tool registry and dispatcher

Phase 3: External Service Integration
- Task 3.1: Robust HTTP client with retry logic

Phase 4: Testing
- Task 4.1: Unit tests for all tools

Phase 5: Integration & Polish
- Task 5.1: Orchestrator tool dispatch
- Task 5.2: Logging and error handling

Each task in CODEX-INSTRUCTIONS.md includes:
- Exact file path to modify/create
- Complete code snippets to copy
- Test examples
- Specific commit message

After completing each task:
1. Commit with the provided message
2. Continue to next task
3. After all tasks: git push -u origin claude/multi-repo-agent-j3bo9v

If you get stuck:
- Read DEVELOPMENT.md
- Check CLAUDE.md for architecture
- Read the error message carefully
- Look at similar code in the repo

Start with Phase 1, Task 1.1 (D1 Schema).
```

---

## How to Use

1. Copy the prompt above (the code block)
2. Send it to Codex
3. Codex will read CODEX-INSTRUCTIONS.md and start implementing
4. Monitor progress - it should complete multiple tasks per turn

---

## What Codex Will Do

- ✅ Create D1 schema with memory tables
- ✅ Implement Memory class with all CRUD operations
- ✅ Create tool handlers (tasks, knowledge)
- ✅ Build tool registry and dispatcher
- ✅ Implement HTTP clients for external services
- ✅ Write comprehensive unit tests
- ✅ Add logging throughout
- ✅ Commit and push changes

---

## Expected Output

By end of Codex's work:
- `src/db/schema.sql` — D1 schema with tables
- `src/memory.ts` — Memory helper class
- `src/types.ts` — TypeScript types
- `src/tools/types.ts` — Tool definitions
- `src/tools/tasks.ts` — Tasks tool handler
- `src/tools/knowledge.ts` — Knowledge tool handler
- `src/tools/index.ts` — Tool registry and dispatcher
- `src/tools/external/http-client.ts` — HTTP client with retry
- `src/tools/external/*.test.ts` — Unit tests
- `src/logger.ts` — Structured logging

All committed to `claude/multi-repo-agent-j3bo9v` branch.

---

## Timeline

Codex should complete:
- Phase 1 (Memory): 1-2 turns
- Phase 2 (Tools): 2-3 turns
- Phase 3 (External): 1 turn
- Phase 4 (Testing): 1 turn
- Phase 5 (Polish): 1 turn

Total: ~6-8 turns, probably 30-60 minutes depending on Codex speed.
