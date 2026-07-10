# Kulfon — roadmapa refaktoryzacji

## Status dokumentu

Roadmapa opisuje przejście od obecnego prototypu do owner-only AI operations platform.

Nie zakłada, że wszystko trzeba zrobić naraz. Zakłada, że każda kolejna praca nad kodem powinna przesuwać projekt w stronę bezpiecznego, audytowalnego i trwałego systemu.

### Status faz

- **[✓ UKOŃCZONA]** Faza 1 — Zabezpieczenie obecnego prototypu (PR #40)
  - Risk classification na wszystkich toolach
  - Kill switche: `READ_ONLY_MODE`, `SIDE_EFFECTS_DISABLED`
  - Policy engine (`decideToolPolicy()`) przed każdym tool call
  - Agent mode constraints: manual/confirm/autonomous
  - Policy decisions przygotowane do audytu (Faza 5)
- **[- PLANOWANA]** Faza 2 — Tool Manifest v1
- **[- PLANOWANA]** Faza 3 — Policy Engine v1
- **[- PLANOWANA]** Faza 4 — Approval Engine v1
- **[- PLANOWANA]** Faza 5+ — Audit, durable workflows, Postgres, memory system, UI, integracje, voice

## Zasada nadrzędna

**Najpierw bezpieczeństwo, policy, approvale i audyt. Dopiero potem większa autonomia.**

Nie dokładamy wysokiego ryzyka do obecnego prototypu bez fundamentów.

## Faza 0 — zamrożenie kierunku

### Cel

Ustalić, że Kulfon nie jest zwykłym chatbotem z toolami, tylko owner-only AI operating system.

### Zakres

- przeczytać i zaakceptować `docs/VISION.md`;
- przeczytać i zaakceptować `docs/ARCHITECTURE.md`;
- zdecydować, które części obecnego Workera zostają jako prototyp/ingress;
- zdecydować, czy docelowo idziemy w Vercel/Next + Node + Postgres + durable workflows;
- spisać pierwsze ADR-y.

### Definition of done

- wizja jest jasna;
- stack docelowy jest zaakceptowany;
- wiadomo, których rzeczy nie rozwijać dalej w obecnym modelu;
- powstaje lista pierwszych decyzji architektonicznych.

### Proponowane ADR-y

- ADR: Kulfon is owner-only by default.
- ADR: Tool execution is policy-driven, not model-driven.
- ADR: Side-effect tools require structured approvals.
- ADR: Postgres is future source of truth.
- ADR: Cloudflare Worker is ingress/prototype, not final core runtime.
- ADR: Durable workflows replace cron polling for long tasks.

## Faza 1 — zabezpieczenie obecnego prototypu

**Status: UKOŃCZONA** (PR #40, commits d234edf–866fd14)

### Cel

Zatrzymać ryzyko zanim dojdą kolejne mocne narzędzia.

### Zakres

- przegląd wszystkich endpointów `/api/*`;
- dodać minimalny auth/owner guard tam, gdzie endpoint nie powinien być publiczny;
- wyłączyć albo schować endpointy developerskie;
- dodać prosty kill switch dla side-effect tools;
- dodać jawny tryb read-only;
- oznaczyć narzędzia wysokiego ryzyka;
- zablokować wykonywanie high/critical w trybie autonomous.

### Definition of done

- [✓] żaden endpoint operatorski nie jest publicznie używalny bez kontroli;
- [✓] jest globalny kill switch (`SIDE_EFFECTS_DISABLED`);
- [✓] można wymusić read-only mode (`READ_ONLY_MODE`);
- [✓] high/critical nie wykonują się automatycznie (policy engine);
- [✓] README albo status endpoint mówi jasno, że obecny system jest prototypem;
- [✓] risk classification na wszystkich toolach;
- [✓] policy decisions przygotowane do audytu.

### Implementacja

**Nowe pliki:**
- `src/security/policy.ts` — `PolicyDecision` type i `decideToolPolicy()` engine

**Zmodyfikowane pliki:**
- `src/env.ts` — dodane `SIDE_EFFECTS_DISABLED` env var
- `src/security/types.ts` — dodane `PolicyDecision` type
- `src/tools/index.ts` — policy check przed każdym tool call, improved error handling
- `docs/NEXT-CODING-STEPS.md` — checklist Fazy 1 zamarkowana jako done

**Zachowanie:**
- Każdy tool call przechodzi przez `decideToolPolicy()` przed wykonaniem
- Low-risk read-only tools mogą się wykonać (`allow`)
- High/critical tools zwracają `require_approval` (wymaga future approval engine)
- Side-effect tools są blokowane jeśli:
  - Agent mode = `manual`, LUB
  - `READ_ONLY_MODE=true`, LUB
  - `SIDE_EFFECTS_DISABLED=true`
- Policy decisions są logowane (przygotowanie do Faza 5 — audit engine)

### Issues

- `security: add owner guard to operator API endpoints`
- `security: add global side-effect kill switch`
- `security: add read-only mode`
- `tools: classify existing tools by risk level`
- `tools: block high-risk tools outside confirm mode`

## Faza 2 — Tool Manifest v1

### Cel

Zastąpić luźną listę tooli formalnym rejestrem narzędzi z metadanymi ryzyka.

### Zakres

Dodać manifest dla każdego toola:

- name;
- version;
- provider;
- input schema;
- output schema;
- sideEffect;
- riskLevel;
- requiredScopes;
- defaultPolicy;
- approvalRequired;
- redactionRules;
- idempotency;
- timeout;
- retry policy.

### Definition of done

- każdy istniejący tool ma manifest;
- dispatcher ładuje metadane narzędzia przed wykonaniem;
- risk level jest dostępny w runtime;
- output jest normalizowany;
- wrażliwe pola mogą być redagowane.

### Issues

- `tools: introduce ToolManifest type`
- `tools: migrate tasks and notes to manifests`
- `tools: migrate GitHub tools to manifests`
- `tools: migrate Vercel tools to manifests`
- `tools: migrate email tools to manifests`
- `tools: migrate Stripe and Clerk tools to manifests`
- `tools: add output redaction hook`

## Faza 3 — Policy Engine v1

### Cel

Wykonanie narzędzia nie może zależeć wyłącznie od decyzji modelu.

### Zakres

Dodać centralną decyzję:

```ts
type PolicyDecision =
  | { type: 'allow' }
  | { type: 'deny'; reason: string }
  | { type: 'require_approval'; reason: string }
  | { type: 'require_step_up_auth'; reason: string }
```

Policy Engine ma brać pod uwagę:

- tool manifest;
- tryb pracy agenta;
- środowisko;
- target;
- project scope;
- owner settings;
- kill switches;
- limity.

### Definition of done

- każdy tool call przechodzi przez policy check;
- decyzja policy jest logowana;
- low-risk read-only może przejść automatycznie;
- high/critical zawsze wymagają approvala;
- denied tool call daje bezpieczną odpowiedź użytkownikowi.

### Issues

- `policy: add PolicyDecision type`
- `policy: add central policy check before tool execution`
- `policy: enforce read-only mode`
- `policy: enforce high-risk approval requirement`
- `policy: log all policy decisions`

## Faza 4 — Approval Engine v1

### Cel

Zastąpić prototypowe `pending_actions` bezpiecznym approval flow.

### Zakres

Dodać obiekt approval:

- action id;
- tool name;
- normalized args;
- target;
- risk level;
- preview;
- estimated impact;
- reversibility;
- requester;
- expires at;
- idempotency key;
- status.

Dodać akcje:

- approve;
- deny;
- edit and approve;
- expire;
- execute after approval.

### Definition of done

- high/critical tool nie wykonuje się bez approval object;
- approval ma TTL;
- approval wykonuje dokładnie jedną akcję;
- wynik trafia do audytu;
- proste „tak” może co najwyżej zatwierdzać konkretny widoczny approval, nie ostatnią przypadkową akcję.

### Issues

- `approvals: create approval data model`
- `approvals: replace pending_actions execution path`
- `approvals: add approval preview formatter`
- `approvals: add idempotency keys`
- `approvals: add approval expiry`
- `approvals: audit approval lifecycle`

## Faza 5 — Audit v1

### Cel

Każda istotna akcja ma być odtwarzalna i wyjaśnialna.

### Zakres

Dodać centralny audit event:

- request received;
- model planned;
- tool proposed;
- policy decided;
- approval requested;
- approval decided;
- tool executed;
- tool failed;
- memory written;
- connector accessed;
- kill switch changed.

### Definition of done

- istnieje tabela/serwis audytu;
- wszystkie high/critical actions mają pełny ślad;
- audit timeline da się wyświetlić w UI/API;
- wrażliwe dane są redagowane w widokach;
- surowe eventy są spójne i append-only.

### Issues

- `audit: add audit_events model`
- `audit: log model and tool decisions`
- `audit: log approvals and executions`
- `audit: add redacted audit view`
- `ui: add basic audit timeline`

## Faza 6 — Durable workflows

### Cel

Przenieść długie i wieloetapowe zadania poza cronowy poller.

### Zakres

Wybrać i podłączyć Inngest albo Trigger.dev.

Workflowy do migracji:

- agent tasks;
- daily briefing;
- long research;
- coding tasks;
- email triage;
- monitoring;
- multi-step operations requiring approval.

### Definition of done

- długi task ma status, kroki i retry;
- task można anulować;
- task może czekać na approval;
- task nie ginie po timeoutcie requestu;
- UI/API pokazuje postęp.

### Issues

- `workflows: choose durable workflow engine`
- `workflows: add task_run and task_step model`
- `workflows: migrate agent_tasks runner`
- `workflows: migrate daily briefing`
- `workflows: add cancellation and retry policy`

## Faza 7 — Postgres source of truth

### Cel

Przygotować bazę pod docelowy system operacyjny.

### Zakres

Przenieść lub zdublować najważniejsze dane z D1 do Postgresa:

- users/sessions;
- projects;
- connector accounts;
- tool manifests;
- policies;
- approvals;
- audit events;
- task runs;
- memory items;
- documents;
- prompt versions;
- eval runs.

### Definition of done

- Postgres jest źródłem prawdy dla nowych modułów;
- D1 nie jest rozbudowywane jako główna baza core;
- istnieje migracja albo adapter legacy dla danych z D1;
- nowe approvale/audyt/workflowy zapisują do Postgresa.

### Issues

- `db: add Postgres connection and migrations`
- `db: create approvals and audit schema`
- `db: create tool manifest schema`
- `db: create task runs schema`
- `db: create memory schema`
- `db: add D1 legacy adapter plan`

## Faza 8 — Memory System v1

### Cel

Oddzielić pamięć od historii rozmów i dać właścicielowi kontrolę.

### Zakres

Dodać warstwy pamięci:

- profile;
- project memory;
- operational memory;
- decision memory;
- episodic memory;
- document memory;
- audit memory.

Dodać:

- memory proposals;
- consent dla pamięci osobistej;
- edycję;
- usuwanie;
- expiry;
- project isolation;
- retrieval.

### Definition of done

- użytkownik widzi, co Kulfon pamięta;
- użytkownik może edytować i usuwać pamięć;
- pamięć projektowa jest oddzielona od osobistej;
- system nie zapisuje sekretów i przypadkowej treści maili;
- context builder używa pamięci świadomie.

### Issues

- `memory: add memory item model`
- `memory: add memory proposal flow`
- `memory: add profile and project memory separation`
- `memory: add edit/delete UI`
- `memory: add retrieval for project decisions`
- `memory: add poisoning resistance tests`

## Faza 9 — Command Center UI

### Cel

Zamienić prosty chat shell w centrum operacyjne.

### Zakres

Nowe obszary UI:

- Chat;
- Threads;
- Task Inbox;
- Approval Inbox;
- Audit Timeline;
- Memory Center;
- Integrations Status;
- Project Dashboard;
- Daily Briefing;
- Agent Runs;
- Settings;
- Emergency Stop.

### Definition of done

- właściciel może obsłużyć approval bez zgadywania kontekstu;
- widzi taski i status workflowów;
- widzi audyt;
- widzi pamięć;
- może zmienić tryb pracy;
- może jednym kliknięciem zatrzymać side-effect tools.

### Issues

- `ui: introduce command center shell`
- `ui: add approval inbox`
- `ui: add audit timeline`
- `ui: add task inbox`
- `ui: add memory center`
- `ui: add integrations status`
- `ui: add emergency stop control`

## Faza 10 — Integracje produkcyjne

### Cel

Przepisać konektory tak, żeby były bezpieczne, audytowalne i testowalne.

### Kolejność

1. GitHub read-only;
2. GitHub write przez approval;
3. Vercel read-only;
4. Vercel redeploy przez approval;
5. Email read/triage;
6. Email outbound przez approval;
7. Stripe read-only;
8. Stripe refund jako critical approval;
9. Clerk read-only z redaction;
10. Polutek ops read-only;
11. Polutek refund/revoke przez ops-API i critical approval;
12. Google/Gmail/Calendar w przyszłości.

### Definition of done

Każdy connector ma:

- manifest;
- scopes;
- policy;
- redaction;
- audit;
- testy;
- kill switch;
- status w UI.

### Issues

- `github: branch-safe write workflow`
- `github: require approval for write operations`
- `vercel: require approval for redeploy`
- `email: add outbound preview and approval`
- `stripe: add refund caps and idempotency`
- `clerk: redact PII in tool outputs`
- `polutek: enforce ops-api only for domain mutations`

## Faza 11 — Evals i release gates

### Cel

Nie wypuszczać zmian w zachowaniu agenta bez testów regresji.

### Zakres

Dodać katalog:

```text
evals/
  fixtures/
  suites/
    routing/
    approvals/
    security/
    memory/
    output_schemas/
    workflows/
  cases/
  runner/
```

Testować:

- routing;
- approval requirements;
- refusal/deny;
- prompt injection;
- wrong-recipient email prevention;
- refund double execution prevention;
- memory write consent;
- schema compliance;
- redaction;
- workflow retries.

### Definition of done

- CI odpala podstawowy eval suite;
- high-risk tools mają testy policy;
- prompt changes mają golden conversations;
- nie można przypadkiem zdjąć approvala z high/critical.

### Issues

- `evals: add eval runner skeleton`
- `evals: add approval policy tests`
- `evals: add prompt injection tests`
- `evals: add memory consent tests`
- `evals: add high-risk tool regression tests`

## Faza 12 — Voice layer

### Cel

Dodać naturalny głos jako interfejs, bez zmiany zasad bezpieczeństwa.

### Kolejność

1. Telegram voice note -> transkrypcja -> odpowiedź tekstowa;
2. odpowiedzi audio;
3. live voice w web/app;
4. prawdziwy telefon.

### Zasada

Voice nie omija approvali.

Jeśli użytkownik mówi: „zrób refund”, Kulfon nadal musi pokazać/odczytać approval i dostać jednoznaczne potwierdzenie właściciela.

### Issues

- `voice: add Telegram voice note transcription`
- `voice: add optional audio responses`
- `voice: add live voice prototype`
- `voice: require explicit approval for risky voice commands`

## Priorytet na najbliższą sesję kodowania

Najbliższa sensowna praca nie powinna zaczynać się od kolejnego toola.

Proponowana kolejność:

1. dodać risk level do istniejących narzędzi;
2. dodać centralny policy check przed `executeTool`;
3. dodać globalny read-only / kill switch;
4. uporządkować confirm gate tak, żeby high/critical nie odpalały się przypadkiem;
5. zacząć model approval object;
6. logować policy decisions i approvals do audytu;
7. dopiero potem wracać do Polutek ops, emaili, GitHuba i voice.

## Backlog skrócony

### Security

- owner guard na API;
- kill switch;
- read-only mode;
- risk classification;
- secret redaction.

### Runtime

- ToolManifest;
- PolicyDecision;
- Approval Engine;
- Audit Service;
- durable workflows.

### Data

- Postgres;
- approvals;
- audit;
- task runs;
- memory items;
- connector accounts;
- eval runs.

### UI

- Command Center shell;
- approval inbox;
- audit timeline;
- task inbox;
- memory center;
- settings;
- emergency stop.

### Integracje

- GitHub safe write;
- Vercel redeploy approval;
- email approval;
- Stripe refund critical approval;
- Clerk redaction;
- Polutek ops-API boundaries.

### Quality

- evals;
- golden conversations;
- prompt versions;
- schema tests;
- policy regression tests.

## Decyzja końcowa

Obecny prototyp jest wartościowy jako dowód kierunku.

Docelowo Kulfon powinien zostać przebudowany w stronę:

```text
owner-only AI operations platform
+ typed tools
+ policy engine
+ structured approvals
+ append-only audit
+ durable workflows
+ consent-aware memory
+ command center UI
```

Każda kolejna zmiana w kodzie powinna być oceniana pytaniem:

**Czy ta zmiana przybliża Kulfona do bezpiecznego prywatnego operatora AI, czy tylko powiększa prototyp?**
