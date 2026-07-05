# Agent Bolek ↔ LibreChat / BolekCzat

> **Status:** decyzja architektoniczna / plan do wdrożenia.  
> Bolek zostaje backendem i agentem operacyjnym. LibreChat, w forku `pawelekbyra/BolekCzat`, ma zostać docelowym web UI.

---

## 1. Decyzja

Nie rozwijamy dalej obecnego prostego web chatu w `kulfon` jako głównego interfejsu.

Docelowy kierunek:

```txt
pawelekbyra/kulfon
= mózg Bolka
= Cloudflare Worker
= Telegram bot
= D1 memory
= narzędzia
= Polutek ops
= agent-mode / bramka zgody
= /api/chat
= przyszły adapter OpenAI-compatible

pawelekbyra/BolekCzat
= fork LibreChat
= produkcyjny web UI
= historia rozmów
= auth
= sidebar
= agent/chat UX
= custom endpoint do Bolka
```

LibreChat ma być **twarzą Bolka**, a nie zamiennikiem Bolka.

---

## 2. Czego NIE robimy

- Nie vendorujemy LibreChat do repo `kulfon`.
- Nie przepisujemy Telegrama, narzędzi, pamięci D1 ani integracji Polutka do LibreChat.
- Nie dajemy LibreChatowi bezpośrednich sekretów Stripe, Clerk, Vercel, Resend, home.pl ani Polutka.
- Nie pozwalamy LibreChatowi omijać `agent-mode` i bramki zgody.
- Nie traktujemy LibreChat jako źródła prawdy o akcjach operacyjnych.

---

## 3. Dlaczego osobne repo

LibreChat jest dużą aplikacją produktową z własną strukturą, konfiguracją, klientem, API, Dockerem i bazą.

`kulfon` jest lekkim Cloudflare Workerem i osobistym agentem.

Trzymanie ich osobno daje:

- łatwiejsze aktualizacje z upstream LibreChat,
- mniejsze ryzyko rozwalenia Bolka podczas prac UI,
- prostszy deployment,
- jasny podział odpowiedzialności,
- możliwość wymiany UI bez ruszania mózgu Bolka.

---

## 4. Most: OpenAI-compatible adapter w kulfonie

Żeby LibreChat mógł gadać z Bolkiem, `kulfon` powinien wystawić endpoint zgodny z OpenAI Chat Completions API:

```txt
POST /v1/chat/completions
```

Planowany base URL produkcyjny:

```txt
https://kulfon.pawel-perfect.workers.dev/v1
```

Planowany model:

```txt
bolek
```

Planowany sekret:

```txt
BOLEK_OPENAI_ADAPTER_KEY
```

LibreChat będzie skonfigurowany jako custom OpenAI-compatible endpoint:

```txt
Name: Agent Bolek
Base URL: https://kulfon.pawel-perfect.workers.dev/v1
Chat endpoint: /chat/completions
Model: bolek
API key: BOLEK_OPENAI_ADAPTER_KEY
```

---

## 5. Wymagania adaptera

Adapter w `kulfon` powinien:

1. Przyjmować OpenAI-compatible body:

```ts
{
  model?: string;
  messages: Array<{
    role: "system" | "user" | "assistant" | "tool";
    content: string | Array<unknown> | null;
    name?: string;
    tool_call_id?: string;
  }>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  metadata?: Record<string, unknown>;
}
```

2. Obsługiwać `stream: true` jako SSE w formacie OpenAI chat completion chunks.

3. Obsługiwać `stream: false` lub brak `stream` jako pełną odpowiedź JSON.

4. Wewnątrz używać istniejącej logiki Bolka, tej samej co `/api/chat`, zamiast tworzyć drugi mózg.

5. Zachować istniejący `/api/chat` bez zmian.

6. Mapować wiadomości defensywnie:
   - `user` i `assistant` zachować w kolejności,
   - `system` potraktować jako kontekst, jeśli obecny silnik Bolka to wspiera,
   - `tool`/nietypowe role nie mogą wywoływać narzędzi ani omijać permission modelu.

7. Chronić endpoint bearer tokenem:

```txt
Authorization: Bearer <BOLEK_OPENAI_ADAPTER_KEY>
```

8. Nie logować sekretów.

9. Nie zwracać sekretów, stack trace ani danych narzędziowych.

10. Dodać CORS tylko wąsko, np. przez:

```txt
BOLEK_CORS_ORIGIN
```

---

## 6. Bezpieczeństwo

LibreChat jest tylko interfejsem.

Bolek pozostaje autorytetem dla:

- pamięci,
- narzędzi,
- Telegrama,
- Polutek ops,
- akcji mutujących,
- zgód użytkownika,
- reguł bezpieczeństwa.

W szczególności:

- refundy nadal idą przez bramkę zgody,
- operacje Polutka nadal idą przez ops-API,
- LibreChat nie dostaje bezpośredniego dostępu do Stripe/Clerk/Vercel/Polutek,
- klient web nie może samodzielnie wywoływać narzędzi Bolka z pominięciem backendu.

---

## 7. Repo BolekCzat

Fork LibreChat:

```txt
https://github.com/pawelekbyra/BolekCzat
```

Docelowe zmiany w tym repo:

- nazwa aplikacji: `Agent Bolek`,
- domyślny endpoint: `Agent Bolek`,
- domyślny model: `bolek`,
- polski welcome message,
- ciemny, produktowy chat UI,
- zachowane auth i historia rozmów,
- brak bezpośrednich sekretów operacyjnych,
- dokumentacja deploymentu Docker/Railway/Fly/Render/VPS.

---

## 8. Kolejność prac

### Krok 1 — kulfon

Dodać adapter:

```txt
POST /v1/chat/completions
```

w `pawelekbyra/kulfon`.

Walidacja:

```bash
npm run typecheck
```

oraz testy, jeśli istnieją lub zostaną dodane.

### Krok 2 — BolekCzat

Skonfigurować LibreChat fork jako UI Bolka:

```txt
pawelekbyra/BolekCzat
```

Ustawić custom endpoint do `kulfon`.

### Krok 3 — deployment

LibreChat/BolekCzat raczej nie traktujemy jako prostego Vercel deploy.

Preferowane hosty:

- Railway,
- Fly.io,
- Render,
- VPS/Docker,
- inny Docker-capable host.

### Krok 4 — głębsza personalizacja

Dopiero po działającym połączeniu:

- branding,
- panel Polutek Ops,
- skróty do GitHuba/Vercela/Stripe,
- osobne tryby agentów,
- postacie,
- przyszłe MCP/tool UI.

---

## 9. Minimalny prompt dla agenta kodującego

```txt
Work in pawelekbyra/kulfon.

Add an OpenAI-compatible Chat Completions adapter for Agent Bolek at POST /v1/chat/completions so LibreChat can use Bolek as a custom endpoint.

Reuse the existing /api/chat internals. Preserve Telegram, tools, D1 memory, Polutek ops and agent-mode confirmation gate. Do not expose secrets. Protect the new endpoint with BOLEK_OPENAI_ADAPTER_KEY bearer auth. Support stream=true as OpenAI-style SSE chunks and stream=false as OpenAI-style JSON. Add docs and validation.
```
