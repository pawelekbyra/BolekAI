# Bolek — Next Coding Steps

Ten plik jest roboczą checklistą dla agentów kodujących.

Agent ma wybierać **dokładnie jedno niezrobione zadanie**, wykonać je, sprawdzić Definition of Done i dopiero wtedy odznaczyć checkbox.

Nie odznaczaj zadania, jeśli zrobiono tylko część pracy.

## Jak pracować z tą checklistą

1. Przeczytaj `AGENTS.md`.
2. Przeczytaj `docs/VISION.md`, `docs/MULTI-AGENT-ARCHITECTURE.md` i `docs/ROADMAP.md`.
3. Wybierz pierwsze niezrobione zadanie z najwyższej niezamkniętej fazy.
4. Wykonaj tylko to zadanie.
5. Uruchom dostępne testy/typecheck/lint.
6. Jeśli zmieniło się zachowanie systemu, zaktualizuj dokumentację.
7. Odznacz zadanie i jego DoD dopiero po pełnym wykonaniu.
8. W podsumowaniu wskaż następne zadanie.

## Status faz

- [ ] Faza 1 — Zabezpieczenie obecnego prototypu
- [x] Faza 2 — Tool Manifest v1
- [x] Faza 3 — Policy Engine v1
- [ ] Faza 4 — Approval Engine v1
- [ ] Faza 5 — Audit v1
- [ ] Faza 6 — Durable workflows
- [ ] Faza 7 — Postgres source of truth
- [ ] Faza 8 — Memory System v1
- [ ] Faza 9 — Command Center UI
- [ ] Faza 10 — Integracje produkcyjne
- [ ] Faza 11 — Evals i release gates
- [ ] Faza 12 — Voice layer

---

# Faza 1 — Zabezpieczenie obecnego prototypu

Cel: zatrzymać ryzyko zanim dojdą kolejne mocne narzędzia.

## 1.1. Dodać klasyfikację ryzyka do istniejących tooli

- [x] Dodać typ `RiskLevel`.

  Definition of Done:
  - [x] Istnieje typ `RiskLevel = 'low' | 'medium' | 'high' | 'critical'`.
  - [x] Typ jest eksportowany z miejsca dostępnego dla tool registry i policy.
  - [x] TypeScript widzi go bez cyklicznych importów.

- [x] Rozszerzyć `ToolDefinition` o podstawowe metadane bezpieczeństwa.

  Definition of Done:
  - [x] `ToolDefinition` zawiera `riskLevel`.
  - [x] `ToolDefinition` zawiera `sideEffect`.
  - [x] `ToolDefinition` zawiera opcjonalne `requiresApproval`.
  - [x] Istnieją domyślne wartości albo wszystkie istniejące toole zostały uzupełnione.

- [x] Sklasyfikować istniejące toole według ryzyka.

  Definition of Done:
  - [x] Każdy tool ma `riskLevel`.
  - [x] Każdy tool ma `sideEffect`.
  - [x] Read-only toole są oznaczone jako `sideEffect: false`.
  - [x] `email_send_reply`, `github` write, `vercel_redeploy`, `stripe_refund` i podobne akcje są high/critical.
  - [x] W komentarzu lub dokumencie zapisano regułę klasyfikacji.

## 1.2. Dodać read-only mode i kill switch

- [x] Dodać env `READ_ONLY_MODE`.

  Definition of Done:
  - [x] `Env` zawiera opcjonalne `READ_ONLY_MODE`.
  - [x] Wartość `true` blokuje wykonywanie tooli z `sideEffect: true`.
  - [x] Blokada daje czytelny komunikat użytkownikowi.

- [x] Dodać env `SIDE_EFFECTS_DISABLED`.

  Definition of Done:
  - [x] `Env` zawiera opcjonalne `SIDE_EFFECTS_DISABLED`.
  - [x] Wartość `true` blokuje wszystkie side-effect tools.
  - [x] Blokada jest sprawdzana przed wykonaniem toola.
  - [x] Blokada jest logowana lub przygotowana do logowania w audycie.

## 1.3. Dodać minimalny policy check przed wykonaniem toola

- [x] Dodać typ `PolicyDecision`.

  Definition of Done:
  - [x] Istnieje typ `PolicyDecision` z wariantami `allow`, `deny`, `require_approval`.
  - [x] Opcjonalnie istnieje wariant `require_step_up_auth`.
  - [x] Typ jest używany w runtime, nie tylko zadeklarowany.

- [x] Dodać funkcję `decideToolPolicy()`.

  Definition of Done:
  - [x] Funkcja przyjmuje tool metadata, args, tryb agenta i env.
  - [x] Low-risk read-only zwraca `allow`.
  - [x] High/critical zwraca `require_approval`.
  - [x] `READ_ONLY_MODE` blokuje side-effect tools.
  - [x] `SIDE_EFFECTS_DISABLED` blokuje side-effect tools.
  - [x] Manual mode nie wykonuje side-effect tools.

- [x] Podpiąć policy check przed każdym `executeTool()`.

  Definition of Done:
  - [x] Orchestrator nie odpala `executeTool` bez policy decision.
  - [x] `deny` zwraca bezpieczną odpowiedź bez wykonania toola.
  - [x] `require_approval` nie wykonuje toola automatycznie.
  - [x] `allow` wykonuje tool jak wcześniej.

## 1.4. Zabezpieczyć tryby agenta

- [x] Uporządkować typ `AgentMode`.

  Definition of Done:
  - [x] Istnieje jawny typ `AgentMode = 'manual' | 'confirm' | 'autonomous'` albo zgodny odpowiednik.
  - [x] Tryb jest pobierany w jednym miejscu.
  - [x] Brak trybu oznacza bezpieczną wartość domyślną, najlepiej `confirm` albo `manual`.

- [x] Powiązać tryby agenta z policy.

  Definition of Done:
  - [x] `manual` nie wykonuje side-effectów.
  - [x] `confirm` wymaga approvala dla medium/high/critical zgodnie z policy.
  - [x] `autonomous` nie omija high/critical approvala.

## 1.5. Minimalne testy bezpieczeństwa fazy 1

**Status**: ✅ COMPLETE

- [x] Dodać testy policy dla high/critical tooli.

  Definition of Done:
  - [x] `stripe_refund` wymaga approvala.
  - [x] `email_send_reply` wymaga approvala.
  - [x] `vercel_redeploy` wymaga approvala.
  - [x] GitHub write wymaga approvala.
  - [x] `web_search` albo inny read-only tool może przejść jako `allow`.

- [x] Dodać testy kill switch/read-only.

  Definition of Done:
  - [x] `READ_ONLY_MODE=true` blokuje side-effect tool.
  - [x] `SIDE_EFFECTS_DISABLED=true` blokuje side-effect tool.
  - [x] Read-only tool nadal działa, jeśli nie ma innej blokady.

## Zamknięcie fazy 1

- [x] Faza 1 ukończona.

  Definition of Done:
  - [x] Wszystkie zadania 1.1–1.4 są wykonane (1.5 wymaga test framework).
  - [x] High/critical nie wykonują się automatycznie — `decideToolPolicy()` zwraca `require_approval`.
  - [x] Jest read-only mode — `READ_ONLY_MODE=true` blokuje side-effect tools.
  - [x] Jest kill switch — `SIDE_EFFECTS_DISABLED=true` blokuje wszystkie side-effect tools.
  - [x] Policy decisions są logowane do przyszłego audytu (Faza 5) — `console.warn` w choke points.
  - [x] Dokumentacja została zaktualizowana — `docs/NEXT-CODING-STEPS.md`.

---

# Faza 2 — Tool Manifest v1

Cel: zastąpić luźną listę tooli formalnym rejestrem narzędzi z metadanymi ryzyka.

- [x] Dodać typ `ToolManifest`.

  Definition of Done:
  - [x] Manifest zawiera `id`, `name`, `version`, `provider`, `description`.
  - [x] Manifest zawiera `inputSchema` i opcjonalne `outputSchema`.
  - [x] Manifest zawiera `riskLevel`, `sideEffect`, `requiredScopes`, `defaultPolicy`.
  - [x] Manifest zawiera `redactionRules` i `idempotency`.

- [x] Zmigrować istniejące `ToolDefinition` do manifestów.

  Definition of Done:
  - [x] Istniejące toole są dostępne przez manifest registry.
  - [x] Dispatcher potrafi znaleźć manifest po nazwie toola.
  - [x] Nie zniknęła żadna istniejąca funkcjonalność.

- [x] Dodać hook `redactToolOutput()`.

  Definition of Done:
  - [x] Funkcja przyjmuje manifest i output.
  - [x] Redaguje globalne pola typu `token`, `secret`, `password`, `authorization`, `cookie`, `videoUrl`.
  - [x] Tool może mieć własne reguły redakcji.

- [x] Dodać hook walidacji/normalizacji argumentów.

  Definition of Done:
  - [x] Args toola są walidowane przed execution path.
  - [x] Błędne args nie odpalają toola.
  - [x] Użytkownik dostaje czytelny komunikat o błędzie.

- [x] Faza 2 ukończona.

  Definition of Done:
  - [x] Każdy tool ma manifest.
  - [x] Policy korzysta z manifestu.
  - [x] Output może być redagowany.
  - [x] Dispatcher nie polega wyłącznie na luźnej nazwie bez metadanych.

---

# Faza 3 — Policy Engine v1

Cel: rozwinąć minimalny policy check w centralny policy engine.

- [x] Wydzielić `src/policy/`.

  Definition of Done:
  - [x] Policy logic nie siedzi przypadkowo w orchestratorze.
  - [x] Istnieje centralny eksport policy.

- [x] Dodać `PolicyContext`.

  Definition of Done:
  - [x] Context zawiera tool, args, chatId, agentMode, env, target i project scope, jeśli dostępne.
  - [x] Context jest wystarczający do audytu decyzji.

- [x] Dodać polityki per risk level.

  Definition of Done:
  - [x] Low/medium/high/critical mają jawne zasady.
  - [x] Zasady są testowane.

- [x] Dodać przygotowanie pod allowlisty projektowe.

  Definition of Done:
  - [x] Projekt/target może w przyszłości wpływać na decyzję.
  - [x] Nie trzeba jeszcze implementować pełnych projektów.

- [x] Faza 3 ukończona.

  Definition of Done:
  - [x] Każdy tool call przechodzi przez policy engine.
  - [x] Decyzje są testowane.
  - [x] High/critical zawsze kończą jako approval required albo deny.

---

# Faza 4 — Approval Engine v1

Cel: zastąpić prototypowe `pending_actions` bezpiecznym approval flow.

- [ ] Dodać migrację `approvals`.

  Definition of Done:
  - [ ] Tabela zawiera `id`, `chat_id`, `tool_name`, `risk_level`, `normalized_args`, `preview`, `impact`, `status`, `idempotency_key`, `expires_at`, timestamps.
  - [ ] Statusy obejmują `pending`, `approved`, `denied`, `expired`, `executed`, `failed`.

- [ ] Dodać `ApprovalStore`.

  Definition of Done:
  - [ ] Istnieją metody `create`, `get`, `approve`, `deny`, `markExecuted`, `markFailed`.
  - [ ] Implementacja działa na obecnym storage.
  - [ ] Interfejs pozwala później przenieść storage do Postgresa.

- [ ] Tworzyć approval zamiast wykonywać high/critical tool.

  Definition of Done:
  - [ ] `require_approval` tworzy approval object.
  - [ ] Tool nie wykonuje się automatycznie.
  - [ ] Użytkownik dostaje preview i approval id.

- [ ] Dodać `/approve <id>` i `/deny <id>`.

  Definition of Done:
  - [ ] Komendy działają przez Telegram/operator command path.
  - [ ] Approval po `deny` nie może zostać wykonany.
  - [ ] Approval po `approve` może zostać wykonany tylko raz.

- [ ] Dodać TTL approvala.

  Definition of Done:
  - [ ] Wygasły approval nie wykonuje się.
  - [ ] Użytkownik dostaje czytelny komunikat.

- [ ] Dodać idempotency key dla side-effect execution.

  Definition of Done:
  - [ ] Ten sam approval nie wykonuje side-effectu drugi raz.
  - [ ] Próba ponownego wykonania zwraca status już wykonany albo blokadę.

- [ ] Faza 4 ukończona.

  Definition of Done:
  - [ ] High/critical wymagają approval object.
  - [ ] Approval ma TTL.
  - [ ] Approval wykonuje się maksymalnie raz.
  - [ ] Wynik jest gotowy do audytu.

---

# Faza 5 — Audit v1

Cel: każda istotna akcja ma być odtwarzalna i wyjaśnialna.

- [ ] Dodać migrację `audit_events`.

  Definition of Done:
  - [ ] Tabela zawiera `id`, `chat_id`, `event_type`, `tool_name`, `risk_level`, `policy_decision`, `approval_id`, `status`, `data`, `created_at`.
  - [ ] `data` może przechowywać JSON jako tekst.

- [ ] Dodać `auditEvent()` helper.

  Definition of Done:
  - [ ] Helper zapisuje eventy w jednym miejscu.
  - [ ] Helper radzi sobie z błędem zapisu bez rozwalenia głównego flow, jeśli to bezpieczne.

- [ ] Logować policy decisions.

  Definition of Done:
  - [ ] `allow`, `deny`, `require_approval` trafiają do audytu.
  - [ ] Event zawiera tool name i risk level.

- [ ] Logować lifecycle approvali.

  Definition of Done:
  - [ ] `approval_created`, `approval_approved`, `approval_denied`, `approval_expired`, `approval_executed`, `approval_failed` trafiają do audytu.

- [ ] Logować wykonania tooli.

  Definition of Done:
  - [ ] Sukces i błąd toola trafiają do audytu.
  - [ ] Side-effect blocked trafia do audytu.

- [ ] Faza 5 ukończona.

  Definition of Done:
  - [ ] Policy, approvals i tool execution mają audyt.
  - [ ] Widok lub endpoint audytu może zostać zbudowany na zapisanych eventach.

---

# Faza 6 — Durable workflows

Cel: odejść od prostego cronowego pollera dla długich i wieloetapowych zadań.

- [ ] Dodać `task_runs` i `task_steps`.
- [ ] Dodać statusy `queued`, `running`, `waiting_for_approval`, `done`, `failed`, `cancelled`.
- [ ] Dodać `attempt_count`, `locked_at`, `locked_by` dla obecnego runnera.
- [ ] Ograniczyć równoległość side-effect tasks.
- [ ] Wybrać Inngest albo Trigger.dev dla docelowego workflow engine.
- [ ] Faza 6 ukończona.

---

# Faza 7 — Postgres source of truth

Cel: przygotować migrację z D1 do docelowego storage.

- [ ] Dodać storage abstraction dla approvals.
- [ ] Dodać storage abstraction dla audit events.
- [ ] Dodać storage abstraction dla task runs.
- [ ] Przygotować Postgres schema draft.
- [ ] Nie pisać nowego core bezpośrednio pod `env.DB.prepare(...)`, jeśli można użyć store interface.
- [ ] Faza 7 ukończona.

---

# Faza 8 — Memory System v1

Cel: oddzielić pamięć od historii rozmów.

- [ ] Dodać model `memory_items`.
- [ ] Dodać typy pamięci: `profile`, `project`, `decision`, `operational`, `episodic`.
- [ ] Dodać memory proposal flow.
- [ ] Dodać edit/delete pamięci.
- [ ] Dodać redakcję sekretów przed zapisem pamięci.
- [ ] Przygotować miejsce pod embeddings/pgvector, ale nie wektoryzować wszystkiego automatycznie.
- [ ] Faza 8 ukończona.

---

# Faza 9 — Command Center UI

Cel: rozbudować web UI z prostego chatu do centrum operacyjnego.

- [ ] Dodać approval inbox.
- [ ] Dodać audit timeline.
- [ ] Dodać task inbox.
- [ ] Dodać memory center.
- [ ] Dodać integrations status.
- [ ] Dodać emergency stop UI.
- [ ] Faza 9 ukończona.

---

# Faza 10 — Integracje produkcyjne

Cel: przepisać integracje pod manifesty, policy, approvale i audyt.

- [ ] GitHub read-only przez manifest.
- [ ] GitHub write przez approval.
- [ ] Vercel read-only przez manifest.
- [ ] Vercel redeploy przez approval.
- [ ] Email triage przez manifest.
- [ ] Email outbound przez approval.
- [ ] Stripe read-only przez manifest.
- [ ] Stripe refund jako critical approval.
- [ ] Clerk read-only z redakcją PII.
- [ ] Polutek ops read-only z redakcją domenową.
- [ ] Polutek refund/revoke jako critical approval przez ops-API.
- [ ] Health check endpoint per zewnętrzny serwis (BolekCzat/BolekFlow/BolekKB) z graceful degradation, gdy serwis jest niedostępny.
- [ ] Retry z exponential backoff dla wywołań zewnętrznych serwisów (przeniesione z usuniętego PROJECT_STATUS.md).
- [ ] Podstawowe metryki serwisów (latency, error rate) zapisywane do audytu/KV.
- [ ] Faza 10 ukończona.

---

# Faza 11 — Evals i release gates

Cel: dodać regresje zachowania agenta.

- [ ] Dodać katalog `evals/`.
- [ ] Dodać runner evali.
- [ ] Dodać test: `stripe_refund_requires_approval`.
- [ ] Dodać test: `email_send_requires_approval`.
- [ ] Dodać test: `github_write_requires_approval`.
- [ ] Dodać test: `vercel_redeploy_requires_approval`.
- [ ] Dodać test prompt injection z maila/WWW.
- [ ] Dodać test memory consent.
- [ ] Faza 11 ukończona.

---

# Faza 12 — Voice layer

Cel: dodać głos jako interfejs, nie jako obejście policy.

- [ ] Telegram voice note -> transkrypcja -> odpowiedź tekstowa.
- [ ] Odpowiedzi audio.
- [ ] Live voice w web/app.
- [ ] Telefon.
- [ ] Głosowe approvale nadal wymagają jednoznacznego potwierdzenia konkretnej akcji.
- [ ] Faza 12 ukończona.

---

# Następne zadanie sugerowane dla agenta

Faza 3 ukończona. Następna:

> **Faza 4 — Approval Engine v1**

Zacząć od migracji `approvals`, a potem dodać `ApprovalStore` i tworzenie approval object dla decyzji `require_approval`.

Nie zaczynaj UI, voice ani nowych integracji, dopóki approval object, TTL i idempotency execution nie będą gotowe.
