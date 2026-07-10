# BOLEK — Docelowa architektura na stacku Anthropic (2026)

> Roadmapa "stanu idealnego". Nie opisuje obecnego kodu — opisuje, jak Bolek powinien
> wyglądać, gdyby go pisać dziś od zera na najnowszych możliwościach Claude API.
> Kolejność faz = kolejność wdrażania. Każda faza działa samodzielnie.

---

## Zasada nadrzędna

Bolek pozostaje na architekturze: **Cloudflare Worker = interfejs + router + pamięć trwała (D1/KV)**,
a cała "inteligencja" przenosi się maksymalnie na stronę Anthropic:

- pętla narzędziowa → SDK / server-side tools
- pamięć konwersacyjna → memory tool + compaction (Claude sam zarządza)
- ciężka robota w tle → Managed Agents (Anthropic hostuje pętlę i sandbox)
- dokumenty/raporty → Skills + code execution (pliki generowane w sandboxie)

Worker robi coraz mniej, Claude coraz więcej. To jest właściwy kierunek — każda linia
kodu pętli po naszej stronie to linia, którą Anthropic utrzymuje lepiej.

---

## FAZA 0 — Fundament: modele, thinking, wyjścia (1 dzień)

### 0.1 Trzy poziomy modeli zamiast jednego

| Poziom | Model | Kiedy | Koszt (in/out za 1M) |
|---|---|---|---|
| **Szybki** | `claude-haiku-4-5` | klasyfikacja intencji, proste komendy, potwierdzenia | $1 / $5 |
| **Domyślny** | `claude-sonnet-5` | 90% rozmów — near-Opus w kodzie i agentyce, adaptive thinking domyślnie włączone | $3 / $15 (promocyjnie $2/$10 do 2026-08-31) |
| **Ciężki** | `claude-opus-4-8` | analizy Polutek, research wielokrokowy, decyzje finansowe | $5 / $25 |

Routing = osobne tanie wywołanie Haiku ("sklasyfikuj zapytanie: simple/standard/heavy")
**albo** tool `escalate` dostępny dla Sonneta. Drugie prostsze i wystarczy na start.

### 0.2 Adaptive thinking + effort

Na Sonnet 5 thinking jest adaptacyjny **domyślnie** (samo pominięcie parametru = włączone).
Kontrola głębokości przez `output_config.effort`:

```typescript
{
  model: 'claude-sonnet-5',
  // thinking pominięte = adaptive (Sonnet 5); na Opus 4.8 ustawić jawnie:
  // thinking: { type: 'adaptive' },
  output_config: { effort: 'medium' },  // low | medium | high | xhigh | max
}
```

Mapowanie: `low` = szybkie odpowiedzi czatowe, `medium` = codzienna praca,
`high`/`xhigh` = zadania Polutek i wielokrokowe. **Uwaga:** na Sonnet 5 i Opus 4.8
parametry `temperature`/`top_p`/`top_k` oraz `budget_tokens` zwracają 400 — nie używać.

### 0.3 Strict tools + structured outputs

- Każdy tool: `strict: true` + `additionalProperties: false` + pełne `required`
  → koniec z tool callami z brakującymi polami.
- Opisy tooli **preskryptywne co do momentu użycia** ("Wywołaj gdy…", nie "Narzędzie do…").
  Na nowych modelach to mierzalnie podnosi trafność wyboru narzędzi.
- Tam gdzie potrzebny JSON (np. parsowanie intencji): `output_config: { format: { type: 'json_schema', schema } }`
  zamiast proszenia promptem.

### 0.4 Streaming + typowane błędy

- `client.messages.stream()` wszędzie, `max_tokens: 64000` (streaming znosi limit timeoutów).
- Łańcuch wyjątków od najbardziej szczegółowego: `RateLimitError` → `APIStatusError` →
  `APIConnectionError`, każdy z przyjaznym komunikatem na Telegram (zasada "fail gracefully").

---

## FAZA 1 — Ekonomia: caching i kompresja kontekstu (1–2 dni)

### 1.1 Prompt caching (największy pojedynczy zysk)

Cache to **prefix match** — kolejność renderowania: `tools` → `system` → `messages`.
Jeden breakpoint na końcu system promptu cache'uje tools+system razem; drugi na ostatnim
bloku historii cache'uje rozmowę przyrostowo:

```typescript
system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
messages: [...history, lastUserTurn]  // breakpoint na ostatnim bloku ostatniej tury
```

Reguły żelazne:
- **System prompt zamrożony** — żadnych dat, imion, liczników interpolowanych do środka.
  Dynamiczny kontekst (fakty z D1, data) idzie do wiadomości użytkownika, na koniec.
- **Tools posortowane deterministycznie** (po nazwie) — zmiana kolejności = cache miss.
- Weryfikacja: `usage.cache_read_input_tokens > 0`. Zero przy powtórzeniach = szukać
  "cichego unieważniacza".
- Ekonomia: zapis 1.25×, odczyt 0.1× — zwraca się od drugiej wiadomości.

### 1.2 Compaction (beta) — koniec ręcznego przycinania historii

Zamiast własnego okna historii z D1: beta `compact-2026-01-12` +
`context_management: { edits: [{ type: 'compact_20260112' }] }`. API samo streszcza
starszy kontekst gdy zbliża się do progu. **Krytyczne:** odsyłać całe `response.content`
(bloki compaction muszą wrócić), nie sam tekst.

D1 zostaje jako **archiwum** (zasada "never delete memory") — do API idzie okno + bloki
compaction, do D1 pełny zapis.

### 1.3 Context editing dla długich pętli narzędziowych

Beta `context-management-2025-06-27`, strategia `clear_tool_uses_20250919` — stare wyniki
tooli są czyszczone z kontekstu zanim urosną. Ważne przy web search / code execution,
których wyniki bywają wielkie.

---

## FAZA 2 — Supermoce: server-side tools (2–3 dni)

### 2.1 Web search + web fetch z dynamic filtering

```typescript
tools: [
  { type: 'web_search_20260209', name: 'web_search', max_uses: 8 },
  { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 8 },
]
```

Wersje `_20260209` (Sonnet 5 / Opus 4.8) mają wbudowane **dynamic filtering** — Claude
filtruje wyniki kodem zanim trafią do kontekstu. Zastępuje w całości własny research tool.
Wymaga obsługi `stop_reason: 'pause_turn'` w pętli (dołożyć assistant turn i kontynuować).

### 2.2 Code execution — sandbox Pythona za darmo*

```typescript
tools: [{ type: 'code_execution_20260120', name: 'code_execution' }]
```

- Python 3.11 + pandas/matplotlib/openpyxl w izolowanym kontenerze Anthropic.
- Kontener trwa 30 dni i można go **reużywać** (`container_id`) — Bolek dostaje trwały
  "komputer" między rozmowami.
- Use-case'y: analiza CSV z banku, wykresy wydatków, obliczenia finansowe Polutek.
- *Darmowe przy użyciu z web search; inaczej $0.05/h po 1550 darmowych godzinach/mies.

### 2.3 Memory tool — pamięć zarządzana przez Claude'a

```typescript
tools: [{ type: 'memory_20250818', name: 'memory' }]
```

Client-side: Claude wydaje komendy (`view`/`create`/`str_replace`/`delete`), Worker
wykonuje je na katalogu `/memories` trzymanym w **D1 lub KV**. Claude sam decyduje co
zapamiętać i sam to odczytuje w kolejnych sesjach — dokładnie filozofia "memory compounds",
ale bez ręcznego `fact_save`/`fact_get`. Obecne fakty z D1 migrują do plików pamięci.

### 2.4 Tool search — skalowanie do dziesiątek tooli

Gdy tooli będzie 20+: `{ type: 'tool_search_tool_regex_20251119' }` + `defer_loading: true`
na rzadziej używanych. Claude doładowuje schematy na żądanie — kontekst mały, cache
nietknięty (schematy są **dopisywane**, nie podmieniane). To odblokowuje zasadę
"everything is a plugin" bez sufitu.

### 2.5 Programmatic tool calling — kompozycja bez round-tripów

`allowed_callers: ['code_execution_20260120']` na własnych toolach → Claude pisze skrypt,
który woła tools w pętli **wewnątrz sandboxa**; do kontekstu wraca tylko wynik końcowy.
Idealne do "sprawdź wszystkie subskrypcje i policz sumę" — N wywołań, jeden kontekst.

### 2.6 MCP connector — gotowe integracje bez pisania tooli

Beta `mcp-client-2025-11-20`: hostowane serwery MCP (GitHub, Linear, Notion, Stripe…)
podpinane bezpośrednio do Messages API:

```typescript
mcp_servers: [{ type: 'url', url: 'https://mcp.example.com/sse', name: 'github' }],
tools: [{ type: 'mcp_toolset', mcp_server_name: 'github' }]
```

Nowa integracja = wpis w konfigu zamiast nowego pliku toola.

---

## FAZA 3 — Deliverables i tryby pracy (2 dni)

### 3.1 Skills — dokumenty jako pliki, nie ściany tekstu

Beta `code-execution-2025-08-25` + `skills-2025-10-02`:

```typescript
container: { skills: [{ type: 'anthropic', skill_id: 'xlsx', version: 'latest' }] },
tools: [{ type: 'code_execution_20260521', name: 'code_execution' }]
```

Daily briefing jako **PDF**, raport finansowy Polutek jako **XLSX**, prezentacja jako
**PPTX** — plik ląduje w kontenerze, Worker pobiera przez Files API i wysyła na Telegram
jako dokument. Skills dostępne: `pdf`, `xlsx`, `docx`, `pptx`.

### 3.2 Batches API — nocna robota za pół ceny

Wszystko co nie jest interaktywne (nocne podsumowania dnia, klasyfikacja zaległych
notatek, analiza tygodniowa) → `client.messages.batches.create()`. **−50% kosztów**,
wyniki do 24h, odpalane z Cron Triggera.

### 3.3 Task budgets — bezpiecznik na długie pętle

Beta `task-budgets-2026-03-13`: `output_config.task_budget: { type: 'tokens', total: 64000 }`
(min. 20k). Model **widzi** odliczanie i sam domyka pracę, zamiast być ucinany przez
`MAX_TOOL_ITERATIONS`. Zamiennik sztywnego limitu iteracji.

### 3.4 Mid-conversation system messages (Opus 4.8)

Na trasach Opus: instrukcje operatorskie w trakcie sesji jako `{ role: 'system', ... }`
w `messages` — bez unieważniania cache i bez podszywania się pod usera. Use-case:
przełączenie Bolka w tryb "confirm-all" gdy rozmowa schodzi na płatności.

---

## FAZA 4 — Managed Agents: ciężka robota poza Workerem (1 tydzień)

Cloudflare Worker ma limity CPU/czasu — długie zadania agentyczne tam nie żyją.
**Managed Agents** = Anthropic hostuje pętlę agenta + kontener z bashem, plikami,
code execution. Worker tylko zleca i odbiera wyniki.

### Architektura docelowa

```
Telegram ──▶ BolekAI Worker (router, szybkie odpowiedzi, pamięć)
                 │
                 ├── zwykła rozmowa → Messages API (Fazy 0–3)
                 │
                 └── ciężkie zlecenie → Managed Agents session
                        │  "przeaudytuj wydatki Polutek z Q2"
                        │  "zbadaj i porównaj 5 opcji X"
                        ▼
                 webhook (session idle) → Worker → wynik na Telegram
```

### Elementy

1. **Agent** (raz, wersjonowany, YAML w repo + `ant beta:agents create`):
   `bolek-heavy` — Opus 4.8, pełny toolset (`agent_toolset_20260401`), skills xlsx/pdf.
2. **Environment** (raz): `cloud`, networking `limited` z allowlistą (Stripe, Clerk,
   polutek.pl, api.github.com).
3. **Vaults** na sekrety Polutek: credentials typu `environment_variable`
   (np. `STRIPE_API_KEY` z `allowed_hosts: ["api.stripe.com"]`) — **klucz nigdy nie
   wchodzi do sandboxa**, podstawiany dopiero na egress. To rozwiązuje wymóg
   "scoped keys" z POLUTEK-INTEGRATION lepiej niż cokolwiek po naszej stronie.
4. **Webhooks** zamiast pollingu: `session.status_idled` → endpoint na Workerze →
   powiadomienie na Telegram. Weryfikacja podpisu przez `client.beta.webhooks.unwrap()`.
5. **Scheduled deployments** zamiast części Cron Triggerów: daily briefing i tygodniowy
   audyt Polutek jako `deployments.create({ schedule: { type: 'cron', expression: '0 7 * * *',
   timezone: 'Europe/Warsaw' } })` — każde odpalenie tworzy sesję samo, z pełnym zapisem
   przebiegu (`deployment_runs`).
6. **Outcomes** dla zadań z mierzalnym "done": `user.define_outcome` + rubryka —
   harness sam iteruje aż raport spełni kryteria.

### Confirm gate zostaje po naszej stronie

Akcje typu refund: tool **custom** (client-side) na agencie CMA → event
`agent.custom_tool_use` → Worker wysyła pytanie na Telegram → user potwierdza →
`user.custom_tool_result`. Sandbox nie ma klucza do wykonania refundu bez nas.

---

## FAZA 5 — Multi-agent (opcjonalna, gdy urośnie)

CMA ma natywny tryb `multiagent: { type: 'coordinator', agents: [...] }` — koordynator
deleguje do wyspecjalizowanych subagentów (research / finanse / kod), każdy z własnym
kontekstem, wspólny filesystem. To naturalna realizacja docs/MULTI-AGENT-ARCHITECTURE.md
bez utrzymywania własnych serwisów BolekCzat/BolekFlow — chyba że te serwisy mają inne
racje bytu (własne UI, własne dane).

---

## Tabela priorytetów

| # | Co | Zysk | Wysiłek | Zależności |
|---|---|---|---|---|
| 1 | Prompt caching + zamrożony system prompt | 💰💰💰 koszt −60–90% | S | — |
| 2 | Sonnet 5 + adaptive thinking + effort | 🧠 jakość skokowo | S | — |
| 3 | Strict tools + preskryptywne opisy | 🎯 mniej błędnych calli | S | — |
| 4 | Web search/fetch 20260209 | 🌍 research bez kodu | S | pause_turn |
| 5 | Typowane błędy + streaming 64k | 🛡 stabilność | S | — |
| 6 | Memory tool | 🧬 pamięć samozarządzająca | M | D1 backend |
| 7 | Compaction + context editing | ♾ długie rozmowy | M | — |
| 8 | Code execution + container reuse | 🔧 obliczenia/pliki | M | — |
| 9 | Skills (pdf/xlsx) + Files API | 📄 raporty jako pliki | M | 8 |
| 10 | Batches na nocne zadania | 💰 −50% na tle | M | — |
| 11 | Task budgets | ⏱ eleganckie limity | S | 2 |
| 12 | Tool search + defer_loading | 📦 skala tooli | M | dużo tooli |
| 13 | MCP connector | 🔌 gotowe integracje | M | — |
| 14 | Managed Agents + vaults + webhooki | 🚀 ciężka robota poza Workerem | L | 1–5 |
| 15 | Scheduled deployments | ⏰ cron po stronie Anthropic | S | 14 |
| 16 | Outcomes + multi-agent | 🏁 jakość mierzalna | L | 14 |

S = godziny, M = ~1 dzień, L = kilka dni.

---

## Czego świadomie NIE robimy

- **Fable 5** (`claude-fable-5`) — $10/$50, wymóg 30-dniowej retencji, classifiery
  refusal. Za drogi i za ciężki na osobistego agenta; Opus 4.8 w zupełności.
- **Fast mode** — premium pricing za szybkość, Telegram nie potrzebuje.
- **Własna pętla narzędziowa jako długoterminowa inwestycja** — utrzymujemy ją tylko
  tam, gdzie potrzebny customowy streaming SSE; wszędzie indziej server-side tools
  i CMA robią pętlę za nas.
- **Przepisywanie interfejsu** — Telegram + Worker + D1/KV zostają. Wymieniamy silnik,
  nie karoserię.
