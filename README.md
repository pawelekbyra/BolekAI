# AGENT BOLEK

Osobisty asystent AI. Działa przez Telegram i interfejs webowy. Pamięta wszystko. Rośnie bez końca.

---

## Jak to działa

```
Ty (Telegram lub web) → Cloudflare Worker → AI (Workers AI / llama) → Tools → D1 (baza)
```

Piszesz do Bolka po ludzku. On rozumie intencję, wybiera narzędzie (zadania, notatki, itp.) i odpowiada. Historia rozmów jest zapisywana — Bolek pamięta co mówiłeś.

---

## Zanim zaczniesz — potrzebujesz kont

### 1. Cloudflare (bezpłatne)
- Załóż konto: https://cloudflare.com
- Nie potrzebujesz płatnego planu — free tier wystarczy
- Workers AI, D1, KV, Cron Triggers — wszystko na free

### 2. Telegram Bot
- Otwórz Telegram → wyszukaj **@BotFather**
- Wyślij `/newbot`
- Podaj nazwę: `Bolek` i username: `twoj_bolek_bot`
- Skopiuj token który dostaniesz (wygląda jak: `123456:ABC-DEF...`)

### 3. Node.js
- https://nodejs.org — wersja 18 lub nowsza

---

## Uruchomienie (jedną komendą)

```bash
npm install
./setup.sh
```

Skrypt zrobi wszystko automatycznie:
- Stworzy bazę D1 i KV na Cloudflare
- Zapyta o token Telegrama
- Zdeployuje Workera
- Ustawi webhook Telegrama

Po zakończeniu napisz do swojego bota — Bolek odpowie.

---

## Interfejs webowy

Osobna aplikacja Next.js w katalogu `web/`.

```bash
cd web
npm install
cp .env.local.example .env.local
# Edytuj .env.local — wpisz URL swojego Workera
npm run dev
```

Otwórz http://localhost:3000 — czat z Bolkiem w przeglądarce.

### Deploy na Vercel (opcjonalnie)
1. Wejdź na https://vercel.com → New Project → importuj to repo
2. Ustaw **Root Directory** na `web`
3. Dodaj zmienną środowiskową: `NEXT_PUBLIC_BOLEK_API_URL` = URL Twojego Workera
4. Deploy

---

## Zmienne środowiskowe

### Worker (ustawiane przez `wrangler secret put`)
| Zmienna | Opis | Skąd |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Token bota | BotFather na Telegramie |
| `TELEGRAM_WEBHOOK_SECRET` | Losowy string zabezpieczający webhook | Setup skrypt generuje automatycznie |

### Worker (w `wrangler.toml`)
| Zmienna | Opis |
|---|---|
| `AI_MODEL` | Model AI (domyślnie `@cf/meta/llama-3.1-8b-instruct`) |

### Web (w `web/.env.local`)
| Zmienna | Opis |
|---|---|
| `NEXT_PUBLIC_BOLEK_API_URL` | URL Twojego Cloudflare Workera |

---

## Struktura projektu

```
src/
  index.ts          # Worker — routes (Telegram webhook + /api/chat)
  env.ts            # Typy Cloudflare bindings
  telegram.ts       # Adapter Telegrama
  orchestrator.ts   # Mózg agenta — AI + tool calling
  memory.ts         # Odczyt/zapis historii z D1
  tools/
    index.ts        # Rejestr narzędzi
    tasks.ts        # Zadania (dodaj / lista / zrobione)
    notes.ts        # Notatki (zapisz / szukaj)
  db/migrations/
    001_initial.sql # Schemat bazy

web/                # Interfejs webowy (Next.js)
  app/
    page.tsx        # Główny czat
    layout.tsx
  lib/utils.ts

setup.sh            # Skrypt pierwszego uruchomienia
wrangler.toml       # Konfiguracja Cloudflare
```

---

## Jak rozwijać Bolka

### Dodanie nowego narzędzia

1. Stwórz plik `src/tools/twoja-domena.ts`:

```typescript
import type { ToolDefinition } from './index'

export const mojeTools: ToolDefinition[] = [
  {
    name: 'finance_add_expense',
    description: 'Zapisz wydatek użytkownika',
    parameters: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Kwota w PLN' },
        category: { type: 'string', description: 'Kategoria (jedzenie, transport, itp.)' },
      },
      required: ['amount'],
    },
  },
]

export async function executeMojTool(name: string, args: unknown, db: D1Database) {
  // logika
}
```

2. Zarejestruj w `src/tools/index.ts`:

```typescript
import { mojeTools, executeMojTool } from './twoja-domena'

export const tools = [...taskTools, ...noteTools, ...mojeTools]

export async function executeTool(name, args, db) {
  if (name.startsWith('finance_')) return executeMojTool(name, args, db)
  // ...
}
```

3. Dodaj migrację jeśli potrzebujesz nowej tabeli: `src/db/migrations/002_finance.sql`

4. `npm run deploy` — Bolek od razu umie nową rzecz.

### Zmiana modelu AI

W `wrangler.toml` zmień `AI_MODEL`:

```toml
[vars]
AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast"  # większy, mądrzejszy
```

Albo podepnij zewnętrzne API (Claude, GPT) — wystarczy podmienić funkcję `runAI` w `orchestrator.ts`.

### Proaktywne zachowania (Cron)

Odkomentuj w `wrangler.toml`:

```toml
[[triggers.crons]]
crons = ["0 7 * * *"]
```

Dodaj handler w `src/index.ts`:

```typescript
export default {
  ...app,
  async scheduled(event, env) {
    // wyślij poranny briefing, sprawdź deadline'y, itp.
  }
}
```

---

## Pomysły na rozbudowę

| Moduł | Co robi |
|---|---|
| `reminders.ts` | Przypomnij mi o X za N godzin |
| `finance.ts` | Budżet, wydatki, kategorie |
| `habits.ts` | Śledzenie nawyków (siłownia, woda, sen) |
| `journal.ts` | Dziennik osobisty z nastrojem |
| `contacts.ts` | Notatki o ludziach, historia kontaktu |
| `goals.ts` | Cele długoterminowe z postępem |
| `voice.ts` | Transkrypcja wiadomości głosowych (Workers AI Whisper) |

---

## Ten projekt nie ma końca

Bolek to platforma, nie aplikacja. Każdy nowy obszar życia = nowy plik z narzędziami. Nie ma architektury do przepisywania, nie ma limitu możliwości.

Rozwijaj go z AI — opisz co chcesz dodać, AI napisze kod, Ty deploy'ujesz.
