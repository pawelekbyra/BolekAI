# AGENT BOLEK — Personal AI Operations Platform

Osobisty asystent AI. Działa przez Telegram i głos. Pamięta wszystko. Zarządza kodem, projektami i życiem. Rośnie bez końca.

**12 faz — UKOŃCZONE.** Od zabezpieczenia po głos. Każda akcja wymaga zgody. Wszystko audytowane.

👉 **[Dokumentacja systemu: `docs/SYSTEM.md`](docs/SYSTEM.md)** ← Start here

Obsługuje też aplikację **[polutek.pl](https://polutek.pl)** — monitoring (Stripe, Clerk, Vercel, mail), dzienny raport i refundy za bramką zgody. **[`docs/POLUTEK-INTEGRATION.md`](docs/POLUTEK-INTEGRATION.md)**.

---

## Architektura

Bolek to **sieć wyspecjalizowanych serwisów**, nie monolith.

```
                  ┌─────────────────────────┐
                  │  BolekAI (Cloudflare)   │
                  │  Mózg + Orchestrator    │
                  └──────┬────┬────┬────────┘
                         │    │    │
           ┌─────────────┘    │    └─────────────┐
           ▼                  ▼                  ▼
      ┌─────────────┐   ┌──────────────┐   ┌──────────────┐
      │ BolekCzat   │   │ BolekFlow    │   │  BolekKB     │
      │ (web UI)    │   │ (workflows)  │   │ (knowledge)  │
      └─────────────┘   └──────────────┘   └──────────────┘
```

**Jak to działa:**

Ty (Telegram lub BolekCzat) → piszesz do Bolka normalnym językiem → Agent parsuje intent → wybiera narzędzia (wbudowane lub serwisy) → woła ich przez HTTP → agreguje wyniki → odpowiada Ci.

Historia rozmów + pamięć o Tobie przechowywane w D1 — Bolek pamięta wszystko.

**Plan integracji:** 📖 **[`docs/MULTI-AGENT-ARCHITECTURE.md`](docs/MULTI-AGENT-ARCHITECTURE.md)** — szczegółowy opis tri-tier architektury.

---

## Czego potrzebujesz

### 1. Konto Cloudflare (bezpłatne)
Już skonfigurowane — Worker `kulfon` działa na `kulfon.pawel-perfect.workers.dev`.

### 2. Bot Telegram
Już działa — [@agent_bolek_bot](https://t.me/agent_bolek_bot)

### 3. Claude API (opcjonalne, ale zalecane)
Workers AI (darmowy) ma niestabilne modele. Claude Haiku jest niezawodny i tani (~$5 starczy na miesiące).
- Wejdź na **console.anthropic.com** → Billing → dodaj $5
- API Keys → Create Key
- Cloudflare → kulfon → Settings → Variables and Secrets → dodaj `ANTHROPIC_API_KEY`

Bolek automatycznie przełącza się na Claude gdy klucz jest dostępny.

### 4. GitHub Token (opcjonalne — do zarządzania kodem)
- github.com → Settings → Developer settings → Personal access tokens → Tokens (classic)
- Scope: **repo**
- Cloudflare → kulfon → Settings → Variables and Secrets → dodaj `GITHUB_TOKEN`

### 5. Vercel Token (opcjonalne — do monitorowania projektów)
- vercel.com → Settings → Tokens → Create
- Cloudflare → kulfon → Settings → Variables and Secrets → dodaj `VERCEL_TOKEN`

### 6. LibreChat / BolekCzat adapter
- `BOLEK_OPENAI_ADAPTER_KEY` — wymagany bearer token dla endpointu `/v1/chat/completions`
- `BOLEK_CORS_ORIGIN` — opcjonalny, pojedynczy dozwolony origin dla BolekCzat/LibreChat

Przykład konfiguracji LibreChat: Base URL `https://kulfon.pawel-perfect.workers.dev/v1`, endpoint `/chat/completions`, model `bolek`, API key ustawiony na wartość `BOLEK_OPENAI_ADAPTER_KEY`. Szczegóły: [`docs/LIBRECHAT-INTEGRATION.md`](docs/LIBRECHAT-INTEGRATION.md).

### 7. Tryb read-only bezpieczeństwa
- `READ_ONLY_MODE=true` — blokuje wykonanie każdego narzędzia oznaczonego jako `sideEffect: true` w registry tooli.
- Narzędzia read-only (`sideEffect: false`) nadal mogą działać, więc Bolek może czytać, wyszukiwać i raportować bez wykonywania akcji zmieniających stan.
- Blokada zwraca czytelny komunikat zamiast wykonywać akcję. Używaj tego trybu, gdy chcesz bezpiecznie monitorować system bez maili, commitów, refundów, redeployów i zapisów.

---

## Obecna konfiguracja

| Co | Wartość |
|---|---|
| Worker URL | `https://kulfon.pawel-perfect.workers.dev` |
| Telegram bot | [@agent_bolek_bot](https://t.me/agent_bolek_bot) |
| Baza D1 | `bolek-memory` |
| KV | `bolek-kv` |
| Model AI | Claude Haiku (gdy klucz) / llama-3.2-3b (fallback) |
| Webhook | `/webhook/zajebiscie` |
| Planowany web UI | `pawelekbyra/BolekCzat` przez OpenAI-compatible adapter `/v1/chat/completions` |

---

## Co Bolek umie

### Rozmowa i pamięć
Bolek pamięta historię rozmów i fakty o Tobie na zawsze:
```
"mam na imię Paweł, pracuję jako developer"
"jestem alergikiem na gluten"
"lubię kawę bez cukru"
```

### Zadania
```
"dodaj zadanie: zadzwonić do dentysty"
"co mam do zrobienia?"
"oznacz zadanie 3 jako zrobione"
```

### Notatki
```
"zapisz notatkę: pomysł na biznes — sklep z..."
"znajdź notatki o projekcie X"
```

### Przypomnienia
```
"przypomnij mi jutro o 9:00 o spotkaniu z Markiem"
"za 2 godziny przypomnij mi wziąć leki"
"jakie mam przypomnienia?"
```
Bolek sam napisze do Ciebie o wyznaczonej godzinie przez Telegram.

### Internet
```
"sprawdź najnowsze informacje o Cloudflare Workers"
"wyszukaj opinie o narzędziu X"
"streść stronę https://example.com/artykul"
```
Bolek umie wyszukiwać aktualne informacje w sieci i pobierać treść konkretnych stron WWW. Używa internetu szczególnie wtedy, gdy pytanie dotyczy newsów, cen, dokumentacji, ofert lub faktów które mogły się zmienić.

### GitHub (wymaga GITHUB_TOKEN)
```
"jakie mam repozytoria?"
"pokaż otwarte issues w pawelekbyra/kulfon"
"utwórz issue: błąd logowania na mobile"
"pokaż zawartość pliku src/index.ts"
```

### Vercel (wymaga VERCEL_TOKEN)
```
"jakie mam projekty na Vercel?"
"pokaż ostatnie deploymenty projektu kulfon"
"sprawdź logi z ostatniego deploymentu"
"są jakieś błędy runtime?"
```

### Zadania kodowania (wymaga ANTHROPIC_API_KEY)
```
"napisz endpoint /health do workera"
"zrób review tego kodu: [wklej kod]"
"dodaj obsługę błędów do funkcji fetchUser i commituj do repo"
```


### Poczta i support Polutka
```
"pokaż ostatnie maile supportowe"
"zrób triage skrzynki kontakt@polutek.pl"
"odpisz klientowi na ten wątek: ..."
```
Bolek potrafi monitorować wiadomości przez Resend Receiving, kategoryzować support i wysyłać odpowiedzi po bramce zgody. Wymaga `RESEND_API_KEY` oraz `EMAIL_SUPPORT_FROM` do wysyłki.

### Polutek ops-API (read-only)
```
"podsumuj dzisiaj Polutka"
"sprawdź status patrona user_123"
```
Narzędzia `polutek_daily_summary` i `polutek_patron_status` wołają wyłącznie uwierzytelnione ops-API Polutka (`POLUTEK_OPS_URL` + `POLUTEK_OPS_TOKEN`). Bolek nie pisze bezpośrednio do bazy Polutka i dodatkowo usuwa z odpowiedzi ewentualne pola `videoUrl`. Poranny briefing Polutka składa dane z Polutek ops, Stripe, Clerk i Vercel, wysyła je raz dziennie na `POLUTEK_BRIEFING_CHAT_ID`, a podgląd jest dostępny pod `/api/briefing/polutek/preview`.

### LibreChat / BolekCzat web UI (planowane)
```
BolekCzat / LibreChat → kulfon /v1/chat/completions → Bolek
```
Obecny prosty web chat zostaje na razie kompatybilnym klientem `/api/chat`, ale docelowy produktowy interfejs webowy ma żyć w osobnym repo `pawelekbyra/BolekCzat`. `kulfon` wystawi OpenAI-compatible adapter, aby LibreChat mógł używać Bolka jako custom endpointu bez dostępu do sekretów narzędziowych.

### Tryb pracy agenta
```
"działaj autonomicznie"     → sam wykonuje akcje, tylko raportuje wynik
"pytaj mnie o zgodę"        → przed każdą akcją czeka na Twoje "tak"
"tryb manualny"             → tylko analizuje i sugeruje, nic nie wykonuje
```

### Postacie i debaty
```
"Marek, Asia, Zofia — czy powinienem szukać inwestora?"
"zorganizuj debatę na temat: praca zdalna vs biuro"
```
Cztery postacie z osobowościami (Marek, Asia, Stary, Zofia) dyskutują i argumentują.

---

## Jak rozwijać Bolka

Pełny tutorial dodawania nowej umiejętności (przykład: moduł finansów) i opis migracji bazy danych żyją w **[`DEVELOPMENT.md`](DEVELOPMENT.md)** — sekcje "Adding a Built-in Tool" i "Database Migrations". To jest jedyne kanoniczne źródło tego przykładu, żeby nie utrzymywać dwóch kopii tego samego kodu w dwóch plikach.

Skrócona wersja: nowy tool = nowy plik w `src/tools/`, rejestracja w `src/tools/index.ts`, migracja w `src/db/migrations/`. Orchestrator podłącza go automatycznie.
