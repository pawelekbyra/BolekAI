# Kulfon — architektura docelowa

## Status dokumentu

Ten dokument opisuje architekturę docelową. Obecne repo jest prototypem i nie musi jeszcze spełniać tych założeń.

Celem dokumentu jest ustawienie kierunku refaktoryzacji przed dalszym dopisywaniem funkcji.

## Diagnoza obecnego stanu

Obecny system jest wartościowym prototypem:

- Cloudflare Worker jako backend;
- Telegram i web jako wejścia;
- D1 jako pamięć;
- narzędzia w `src/tools/*`;
- prosty orchestrator;
- podstawowy agent mode;
- pending actions;
- cron dla przypomnień, agent tasks i briefingów;
- Next.js web UI.

To wystarcza do eksperymentu. Nie wystarcza jako finalny fundament prywatnego operatora AI z realnymi uprawnieniami.

Główne ograniczenia obecnej architektury:

- zbyt dużo odpowiedzialności w jednym Workerze;
- brak twardego auth na całym API produktu;
- tool registry bez metadanych ryzyka;
- approval oparty o prosty chatowy confirm;
- D1 jako zbyt lekki system of record dla docelowego OS-a;
- cronowy pseudo-runner zamiast durable workflows;
- brak formalnego policy engine;
- brak pełnego audytu;
- brak wersjonowania promptów;
- brak eval harnessu;
- UI bliższe prototypowi niż Command Center.

## Kierunek docelowy

Docelowo Kulfon powinien być hybrydą:

```text
Owner
  -> Command Center UI
  -> Authenticated App API
  -> Agent Runtime
  -> Policy / Permission / Approval Engine
  -> Durable Workflows
  -> Tool Adapters
  -> Audit + Memory + Postgres
```

Cloudflare może zostać, ale raczej jako edge ingress i webhook layer, nie jako jedyny centralny mózg całego systemu.

## Rekomendowany stack

### Frontend

- Next.js na Vercelu;
- Clerk do auth;
- assistant-ui jako foundation dla chatu i threadów;
- Vercel AI SDK jako transport/streaming layer;
- custom Command Center UI.

### Core backend

- TypeScript / Node runtime;
- OpenAI Responses / Agents jako primary model runtime;
- Anthropic jako secondary provider przez wspólny kontrakt narzędzi;
- Inngest albo Trigger.dev jako durable workflow engine;
- Postgres jako source of truth;
- pgvector lub osobny vector store dla pamięci/dokumentów;
- R2/S3 dla artefaktów, snapshotów i plików.

### Edge / ingress

- Cloudflare Worker dla Telegram webhooka, lekkiego ingressu, cache/fetch i ewentualnych adapterów edge;
- Cloudflare nie powinien być miejscem, gdzie mieszka cała polityka, audyt, workflowy i pamięć docelowego systemu.

## Docelowy podział warstw

### 1. Command Center UI

Odpowiada za:

- chat;
- task inbox;
- approval inbox;
- audit timeline;
- memory center;
- integrations health;
- project dashboard;
- daily briefing;
- agent runs;
- settings i tryby pracy;
- emergency stop.

UI nie powinien wołać nieautoryzowanych endpointów. Każda akcja idzie przez authenticated API.

### 2. Authenticated App API

Odpowiada za:

- sesje użytkownika;
- owner-only guard;
- routing requestów;
- pobieranie kontekstu;
- tworzenie tasków;
- wystawianie statusu workflowów;
- obsługę approvals;
- widoki audytu;
- memory CRUD.

### 3. Agent Runtime

Odpowiada za:

- planowanie;
- wybór narzędzi;
- structured outputs;
- rozmowę z modelami;
- obsługę tool calli;
- weryfikację wyniku;
- przygotowywanie odpowiedzi dla właściciela.

Runtime nie wykonuje narzędzia tylko dlatego, że model je wybrał. Każdy tool call przechodzi przez policy layer.

### 4. Context Builder

Odpowiada za składanie kontekstu:

- ostatni thread;
- profil właściciela;
- kontekst projektu;
- aktywne taski;
- istotne dokumenty;
- wynik retrieval;
- ostatnie decyzje;
- ograniczenia policy.

Context Builder musi odróżniać zaufane instrukcje systemowe od nieufnej treści zewnętrznej.

### 5. Policy Engine

Odpowiada za decyzję:

```text
allow | deny | require_approval | require_step_up_auth | require_budget | require_time_window
```

Policy Engine bierze pod uwagę:

- użytkownika;
- projekt;
- narzędzie;
- klasę ryzyka;
- target;
- środowisko, np. production/staging;
- koszt;
- limity;
- historię approvals;
- tryb pracy agenta;
- kill switches.

### 6. Permission Engine

Odpowiada za scope'y i dostęp do connectorów:

- GitHub account / repo whitelist;
- Vercel project whitelist;
- Stripe restricted key;
- Clerk read scope;
- email account scope;
- Polutek ops API scope;
- Google/Gmail/Calendar scopes w przyszłości.

### 7. Approval Engine

Zastępuje prototypowe `pending_actions`.

Approval powinien być rekordem danych, a nie tekstem w czacie.

Przykład kształtu:

```ts
type Approval = {
  id: string
  status: 'pending' | 'approved' | 'denied' | 'expired' | 'executed' | 'failed'
  toolName: string
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  normalizedArgs: unknown
  targets: string[]
  preview: string
  estimatedImpact: string
  reversibility: 'reversible' | 'partially_reversible' | 'irreversible'
  requestedBy: 'agent' | 'owner'
  approvedBy?: string
  expiresAt: string
  idempotencyKey: string
}
```

### 8. Tool Registry

Obecny registry powinien zostać zastąpiony manifestami narzędzi.

Każdy tool powinien mieć:

```ts
type ToolManifest = {
  id: string
  name: string
  version: string
  provider: string
  description: string
  inputSchema: unknown
  outputSchema: unknown
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  sideEffect: boolean
  requiredScopes: string[]
  defaultPolicy: 'allow' | 'deny' | 'approval_required'
  approvalTemplate?: string
  redactionRules: string[]
  idempotency: 'required' | 'recommended' | 'not_applicable'
  timeoutMs: number
  retryPolicy: string
}
```

### 9. Durable Workflow Engine

Długie zadania nie powinny żyć w request-response loopie.

Workflowy powinny obsługiwać:

- research;
- analizę dokumentów;
- prace codingowe;
- triage maili;
- daily briefings;
- monitoring;
- wieloetapowe taski wymagające approvali;
- retry;
- cancellation;
- timeouty;
- checkpointy;
- status w UI.

### 10. Audit Service

Każdy ważny event idzie do audytu:

- user request;
- model decision;
- tool proposal;
- policy decision;
- approval request;
- approval decision;
- execution result;
- error;
- memory write;
- connector access;
- kill switch event.

Audyt powinien być append-only. Widoki audytu mogą być redagowane, ale surowa historia powinna być kompletna i kontrolowana.

### 11. Memory Service

Pamięć powinna być oddzielona od historii rozmowy.

Warstwy pamięci:

- conversation memory;
- user profile memory;
- project memory;
- operational memory;
- decision memory;
- episodic memory;
- semantic/document memory;
- audit memory.

Memory Service musi obsługiwać:

- propozycje zapisu;
- zgodę na pamięć osobistą;
- edycję;
- usunięcie;
- wygaszanie;
- retrieval;
- izolację per projekt;
- protection przed memory poisoning.

## Lifecycle requestu

```text
User input
  -> auth check
  -> context build
  -> policy pre-check
  -> model / planner
  -> planned answer or tool call
  -> schema validation
  -> policy decision
  -> allow / deny / approval
  -> execution or approval inbox
  -> verifier
  -> response
  -> audit append
  -> optional memory proposal
```

## Lifecycle tool calla

```text
Model emits structured tool call
  -> validate schema
  -> load tool manifest
  -> classify risk
  -> check scopes
  -> policy decision
  -> execute only if allowed
  -> normalize output
  -> redact output
  -> audit event
  -> return result to model/runtime
```

## Lifecycle approvala

```text
Action proposed
  -> approval object created
  -> owner sees preview, target, risk and impact
  -> owner approves, denies or edits
  -> execution token with TTL is created
  -> action executes once with idempotency key
  -> result is audited
```

## Klasy ryzyka narzędzi

### Low

Read-only:

- search;
- fetch;
- odczyt repo;
- odczyt deploymentów;
- odczyt statusu;
- odczyt notatek;
- podsumowania.

Może być autonomiczne, jeśli connector i projekt na to pozwalają.

### Medium

Niski side effect albo prywatny zapis:

- zapis taska;
- zapis notatki;
- draft maila;
- propozycja issue;
- aktualizacja pamięci projektowej.

Zwykle confirm lub allow w zaufanym projekcie.

### High

Realny skutek zewnętrzny:

- wysłanie maila;
- GitHub write;
- utworzenie PR-a;
- redeploy;
- ban usera;
- zmiana ustawień integracji.

Zawsze approval.

### Critical

Ryzyko finansowe, produkcyjne lub masowe:

- refund;
- revoke patron;
- zmiany produkcyjnego env;
- usunięcia;
- masowe akcje;
- operacje na danych klientów.

Zawsze explicit owner approval, step-up auth, limit i idempotency key.

## Cloudflare vs Vercel / Node

### Cloudflare zostaje dobre dla

- Telegram webhook;
- lekkich publicznych endpointów ingress;
- cache;
- edge fetch;
- prostych adapterów;
- forwardowania eventów do core backendu.

### Cloudflare nie powinien być jedynym miejscem dla

- pełnego auth produktu;
- policy engine;
- approval engine;
- durable long-running workflows;
- głównej bazy pamięci;
- pełnego audytu;
- Command Center UI.

### Vercel / Node lepsze dla

- Next.js app;
- authenticated Command Center;
- streaming AI UI;
- integracji z Clerk;
- durable workflow orchestration;
- Postgres/pgvector;
- rozbudowanego runtime'u modelowego;
- evals i observability.

## Minimalna architektura po refaktorze v1

Pierwsza sensowna wersja po refaktorze nie musi mieć wszystkiego.

Musi mieć:

1. auth na UI i API;
2. owner-only mode;
3. tool manifest z risk level;
4. policy decision przed każdym tool call;
5. approval object dla high/critical;
6. audit event dla każdej akcji;
7. durable task runner dla długich zadań;
8. kill switch;
9. read-only connector status;
10. memory z możliwością edycji/usunięcia.

## Anty-wzorce

Nie robić:

- kolejnych publicznych endpointów bez auth;
- kolejnych tooli bez risk metadata;
- side-effectów na podstawie samego tekstowego „tak”;
- autonomicznych refundów;
- autonomicznych maili;
- autonomicznych deployów production;
- zapisywania wszystkiego do pamięci bez consentu;
- mieszania audytu z kontekstem dla modelu;
- traktowania treści maila/WWW jako zaufanej instrukcji;
- dokładania funkcji bez evalów bezpieczeństwa.

## Decyzja architektoniczna

Core Kulfona ma iść w stronę:

```text
Next.js/Vercel + Clerk + assistant-ui + Vercel AI SDK
+ Node/TypeScript Agent Runtime
+ OpenAI primary / Anthropic fallback
+ Inngest/Trigger durable workflows
+ Postgres/pgvector source of truth
+ audit + approvals + policy engine
+ minimalny Cloudflare ingress
```

Obecny Worker może zostać jako prototyp i jako część ingressu, ale nie powinien być dalej rozbudowywany jako jedyny fundament docelowego systemu.
