# Kulfon OS — Backlog

Ten backlog jest pierwszą listą zadań dla agentów i ludzi. Nie zastępuje GitHub Issues, ale pomaga utrzymać kierunek.

## Zasada pracy

Najpierw fundament. Potem UI. Potem dane. Potem integracje.

Nie dodajemy Gmaila, Calendar, Drive, MCP, n8n ani Supabase, dopóki nie mamy podstawowego Tool Registry, Permission Engine i Audit Log.

## Sprint 0 — Documentation foundation

- [ ] Dodać `AGENTS.md`.
- [ ] Dodać `docs/ROADMAP.md`.
- [ ] Dodać `docs/BACKLOG.md`.
- [ ] Dodać `docs/SECURITY.md`.
- [ ] Dodać `docs/PROMPTBOOK.md`.
- [ ] Dodać `docs/adr/template.md`.
- [ ] Dodać `docs/adr/0001-documentation-first.md`.

Powiązane issue:

- #3 Sprint 0: Add AGENTS.md and docs skeleton for Kulfon OS

## Sprint 1 — Tools, permissions, audit

- [ ] Wprowadzić `ToolRisk`.
- [ ] Wprowadzić manifest narzędzia.
- [ ] Wprowadzić centralny Tool Registry.
- [ ] Nadać risk level obecnym narzędziom.
- [ ] Wprowadzić Permission Engine MVP.
- [ ] Oprzeć approval na risk level lub jednoznacznie zmapować obecny model.
- [ ] Wprowadzić Audit Log MVP.
- [ ] Przenieść obecne GitHub/Vercel/Jules tools do czytelniejszych modułów.

Powiązane issue:

- #4 Sprint 1: Introduce Tool Registry MVP without changing current behavior
- #5 Sprint 1: Introduce Permission Engine MVP for tool risk and approval decisions
- #6 Sprint 1: Add Audit Log MVP for tool calls and approval events
- #7 Sprint 1: Refactor current GitHub, Vercel and Jules tools into registry modules

## Sprint 2 — Command center UI

- [ ] Research: assistant-ui vs CopilotKit vs obecny chat + shadcn/ui.
- [ ] ADR dla UI agenta.
- [ ] Wydzielić Chat jako komponent.
- [ ] Dodać layout z miejscem na sidebar.
- [ ] Dodać Decision Inbox MVP.
- [ ] Dodać Approval Card.
- [ ] Dodać Tool Call Card / Timeline MVP.
- [ ] Dodać Dashboard placeholder.

## Sprint 3 — Data and memory

- [ ] Research: Supabase + Drizzle vs alternatywy.
- [ ] ADR dla bazy danych i auth.
- [ ] Dodać schema draft dla conversations/messages.
- [ ] Dodać schema draft dla audit events.
- [ ] Dodać schema draft dla approval requests.
- [ ] Dodać schema draft dla memory items.
- [ ] Dodać Memory Center placeholder.
- [ ] Dodać manual memory add/edit/delete MVP.

## Sprint 4 — Calendar MVP

- [ ] Research Google Calendar API/OAuth.
- [ ] ADR dla pierwszej życiowej integracji.
- [ ] Dodać Calendar read tool.
- [ ] Dodać plan dnia jako draft.
- [ ] Dodać create event tool z approval.
- [ ] Dodać daily briefing MVP.

## Późniejszy backlog

### Integracje

- [ ] Gmail read.
- [ ] Gmail draft reply.
- [ ] Gmail send tylko po approval.
- [ ] Google Drive search.
- [ ] Contacts.
- [ ] MCP Gateway.
- [ ] n8n workflows.
- [ ] Trigger.dev jobs.

### Produkt

- [ ] Cases/Projects.
- [ ] Daily briefing.
- [ ] Weekly review.
- [ ] Follow-up reminders.
- [ ] Research mode.
- [ ] Memory Center pełne.
- [ ] Audit Timeline UI.
- [ ] Settings / Integrations Center.

### Security

- [ ] Prompt injection tests.
- [ ] Tool abuse tests.
- [ ] Secret redaction tests.
- [ ] Approval regression tests.
- [ ] OAuth scopes review.

### Developer experience

- [ ] Issue templates.
- [ ] PR template.
- [ ] ADR index.
- [ ] Evals folder.
- [ ] CI workflow.

## Zasada priorytetu

Jeżeli zadanie zwiększa bezpieczeństwo, czytelność albo kontrolę nad narzędziami, ma pierwszeństwo przed nową integracją.
