# Bolek Network — mapa repozytoriów i odpowiedzialności

> **Status:** centralna mapa ekosystemu Agenta Bolka.  
> Ten dokument opisuje, jak repozytoria `BolekAI`, `BolekCzat`, `BolekDev`, `BolekKB` i `BolekFlow` mają ze sobą współpracować.

---

## 1. Zasada główna

Bolek nie jest jednym repozytorium.

Bolek to sieć wyspecjalizowanych klocków:

```txt
BolekAI     = mózg
BolekCzat   = twarz / web UI
BolekDev    = coding executor
BolekKB     = wiedza / RAG / dokumenty
BolekFlow   = automatyzacje / workflow
```

Każdy klocek ma jedną główną odpowiedzialność. Nie mieszamy ich, żeby nie zrobić śmietnika.

---

## 2. Repozytoria

### `pawelekbyra/BolekAI`

Rola:

```txt
mózg Bolka
```

Odpowiedzialności:

- Cloudflare Worker,
- Telegram bot,
- D1 memory,
- KV,
- narzędzia,
- Polutek ops,
- mail/support,
- Vercel/Stripe/Clerk/GitHub integrations,
- tryb zgody / agent-mode,
- OpenAI-compatible adapter `/v1/chat/completions` dla BolekCzat.

BolekAI decyduje, kiedy pytać wiedzę, kiedy uruchomić workflow, kiedy zlecić kodowanie i kiedy poprosić użytkownika o zgodę.

---

### `pawelekbyra/BolekCzat`

Rola:

```txt
web UI / twarz Bolka
```

Baza:

```txt
LibreChat
```

Odpowiedzialności:

- rozmowa z Bolkiem przez przeglądarkę,
- historia rozmów,
- auth,
- wygodny chat UX,
- wybór modelu/endpointu, jeśli potrzebne,
- interfejs do BolekAI przez OpenAI-compatible endpoint.

BolekCzat nie dostaje bezpośrednich sekretów Stripe, Clerk, Vercel, Polutek, GitHub ani maila. BolekCzat rozmawia tylko z `BolekAI`.

---

### `pawelekbyra/BolekDev`

Rola:

```txt
coding executor
```

Baza:

```txt
OpenHands / Agent Canvas
```

Odpowiedzialności docelowe:

- przyjmować zadania kodowania,
- klonować/montować repo,
- tworzyć branche,
- edytować kod,
- uruchamiać testy, typecheck, lint, build,
- commitować zmiany,
- otwierać PR-y,
- raportować wynik do BolekAI.

BolekDev nie merge'uje i nie deployuje produkcji bez jawnej zgody użytkownika.

Dokumentacja w repo:

```txt
pawelekbyra/BolekDev/docs/BOLEKDEV-ARCHITECTURE.md
```

---

### `pawelekbyra/BolekKB`

Rola:

```txt
knowledge base / RAG / dokumenty
```

Baza:

```txt
AnythingLLM
```

Odpowiedzialności docelowe:

- dokumenty projektowe,
- PDF-y,
- notatki,
- decyzje architektoniczne,
- stare prompty,
- research,
- dokumentacja Polutka,
- dokumentacja Bolka,
- źródła do odpowiedzi Bolka.

BolekKB nie wykonuje akcji operacyjnych. BolekKB daje kontekst i źródła.

Dokumentacja w repo:

```txt
pawelekbyra/BolekKB/docs/BOLEKKB-ARCHITECTURE.md
```

---

### `pawelekbyra/BolekFlow`

Rola:

```txt
workflow automation
```

Baza:

```txt
n8n
```

Odpowiedzialności docelowe:

- webhooki,
- cykliczne workflow,
- integracje usług,
- triage supportu,
- sync danych,
- powiadomienia,
- human-in-the-loop automations,
- proste automatyzacje operacyjne.

BolekFlow nie jest mózgiem. BolekFlow wykonuje przepływy, a BolekAI podejmuje decyzje i pilnuje approvali.

Dokumentacja w repo:

```txt
pawelekbyra/BolekFlow/docs/BOLEKFLOW-ARCHITECTURE.md
```

---

## 3. Docelowa architektura

```txt
                  ┌──────────────────────┐
                  │  BolekCzat / Telegram │
                  │  UI / rozmowa         │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │       BolekAI         │
                  │  mózg / decyzje       │
                  │  tools / memory       │
                  │  approval gate        │
                  └──────┬──────┬───────┬┘
                         │      │       │
             ┌───────────┘      │       └───────────┐
             ▼                  ▼                   ▼
     ┌──────────────┐   ┌──────────────┐    ┌──────────────┐
     │   BolekKB    │   │  BolekFlow   │    │   BolekDev   │
     │ wiedza/RAG   │   │ workflow     │    │ kodowanie    │
     └──────────────┘   └──────────────┘    └──────────────┘
             │                  │                   │
             ▼                  ▼                   ▼
       docs / źródła      usługi / webhooki     GitHub PR-y
```

---

## 4. Jak mają rozmawiać

### BolekCzat → BolekAI

Przez OpenAI-compatible endpoint:

```txt
POST /v1/chat/completions
```

BolekCzat używa `BolekAI` jako custom endpointu.

---

### BolekAI → BolekKB

Przyszłe narzędzia:

```txt
kb_search
kb_fetch_document
kb_ingest_document
kb_list_collections
kb_summarize_sources
```

BolekAI pyta BolekKB o kontekst, ale sam decyduje, jak go użyć.

---

### BolekAI → BolekFlow

Przyszłe narzędzia:

```txt
flow_run_workflow
flow_get_run_status
flow_cancel_run
flow_list_workflows
flow_trigger_webhook
```

BolekFlow automatyzuje proces, ale mutujące akcje wracają do approval gate.

---

### BolekAI → BolekDev

Przyszłe narzędzia:

```txt
dev_create_task
dev_get_task_status
dev_cancel_task
dev_fetch_task_report
```

BolekDev wykonuje pracę kodową, ale merge/deploy wymaga zgody użytkownika.

---

## 5. Bezpieczeństwo

Zasady dla całej sieci:

- `BolekAI` jest właścicielem decyzji i approval gate.
- UI (`BolekCzat`) nie dostaje sekretów operacyjnych.
- `BolekKB` nie wykonuje akcji, tylko udostępnia wiedzę.
- `BolekFlow` nie omija zgody dla mutujących akcji.
- `BolekDev` pracuje przez branch/PR, nie direct push do main.
- Merge, deploy, refund, revoke patrona, wysyłka ważnych maili i zmiana cen wymagają jawnej zgody.
- Każdy klocek powinien mieć minimalne uprawnienia.
- Każdy krytyczny proces powinien mieć audit trail.

---

## 6. Kolejność integracji

Nie integrować wszystkiego naraz.

Zalecana kolejność:

```txt
1. BolekAI: stabilny `/v1/chat/completions` adapter.
2. BolekCzat: LibreChat jako web UI do BolekAI.
3. BolekKB: testowa baza wiedzy i ręczne dokumenty.
4. BolekFlow: pierwszy bezpieczny workflow bez sekretów.
5. BolekDev: pierwszy ręczny coding task → branch → PR.
6. BolekAI: narzędzia kb_*, flow_*, dev_*.
7. BolekCzat: wygodne panele/statusy dla workflow, wiedzy i coding tasks.
```

---

## 7. Co nie jest celem teraz

Na tym etapie nie robimy:

- autonomicznego merge/deploy,
- automatycznych refundów bez zgody,
- centralnego wrzucenia wszystkich sekretów do jednego repo,
- przepisywania upstream LibreChat/n8n/AnythingLLM/OpenHands od zera,
- głębokiego brandingu przed działającym przepływem,
- mieszania ról repozytoriów.

---

## 8. Zdanie nadrzędne

```txt
BolekAI myśli.
BolekCzat pokazuje.
BolekKB pamięta dokumenty.
BolekFlow automatyzuje.
BolekDev koduje.
Paweł zatwierdza ryzykowne akcje.
```
