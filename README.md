# AGENT BOLEK

Osobisty asystent AI. Działa przez Telegram i przeglądarkę. Pamięta wszystko. Rośnie bez końca.

---

## Jak to działa

```
Ty (Telegram lub web) → Cloudflare Worker → AI (llama) → Narzędzia → Baza D1
```

Piszesz do Bolka normalnym językiem. On rozumie o co chodzi, wybiera odpowiednie narzędzie (zadania, notatki, itp.) i odpowiada. Historia rozmów jest zapisywana — Bolek pamięta poprzednie rozmowy.

---

## Czego potrzebujesz zanim zaczniesz

### 1. Konto Cloudflare (bezpłatne)
Wejdź na https://cloudflare.com i załóż konto. Darmowy plan w zupełności wystarczy — Workers AI, D1, KV i Cron Triggers są dostępne za darmo.

### 2. Bot na Telegramie
- Otwórz Telegram i wyszukaj **@BotFather**
- Wyślij `/newbot`
- Podaj nazwę: `Bolek` i username: `twoj_bolek_bot`
- Skopiuj token który dostaniesz — będzie potrzebny przy uruchomieniu

### 3. Node.js
Wersja 18 lub nowsza: https://nodejs.org

---

## Uruchomienie

```bash
npm install
./setup.sh
```

Skrypt zrobi wszystko sam:
- Stworzy bazę danych i przestrzeń KV na Cloudflare
- Zapyta o token Telegrama
- Wdroży Workera na Cloudflare
- Ustawi webhook Telegrama automatycznie

Po zakończeniu napisz do swojego bota — Bolek odpowie.

---

## Interfejs webowy (czat w przeglądarce)

```bash
cd web
npm install
cp .env.local.example .env.local
# Otwórz .env.local i wpisz URL swojego Workera
npm run dev
```

Otwórz http://localhost:3000 — czat z Bolkiem w przeglądarce.

### Wdrożenie na Vercel (żeby działało publicznie)
1. Wejdź na https://vercel.com → New Project → wybierz to repo
2. Ustaw **Root Directory** na `web`
3. Dodaj zmienną środowiskową: `NEXT_PUBLIC_BOLEK_API_URL` = URL Twojego Workera z Cloudflare
4. Kliknij Deploy

---

## Zmienne środowiskowe

### Worker (ustawiasz przez terminal: `wrangler secret put NAZWA`)
| Zmienna | Opis | Skąd wziąć |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Token bota Telegram | Od @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | Losowe hasło zabezpieczające | Setup skrypt generuje automatycznie |

### Web (plik `web/.env.local`)
| Zmienna | Opis |
|---|---|
| `NEXT_PUBLIC_BOLEK_API_URL` | Adres URL Twojego Workera na Cloudflare |

---

## Struktura projektu

```
src/
  index.ts          # Główny Worker — odbiera Telegram i /api/chat z web
  env.ts            # Definicje typów Cloudflare
  telegram.ts       # Obsługa wiadomości z Telegrama
  orchestrator.ts   # Mózg Bolka — AI + wybór narzędzi
  memory.ts         # Zapis i odczyt historii rozmów
  tools/
    index.ts        # Rejestr wszystkich narzędzi
    tasks.ts        # Zadania: dodaj / lista / oznacz jako zrobione
    notes.ts        # Notatki: zapisz / wyszukaj
  db/migrations/
    001_initial.sql # Schemat bazy danych

web/                # Interfejs webowy (Next.js)
  app/page.tsx      # Strona z czatem

setup.sh            # Skrypt pierwszego uruchomienia
wrangler.toml       # Konfiguracja Cloudflare
```

---

## Jak rozwijać Bolka

### Dodanie nowego narzędzia (nowej umiejętności)

Przykład — moduł finansów:

**1. Utwórz `src/tools/finance.ts`:**

```typescript
import type { ToolDefinition } from './index'

export const financeTools: ToolDefinition[] = [
  {
    name: 'finance_add_expense',
    description: 'Zapisz wydatek użytkownika',
    parameters: {
      type: 'object',
      properties: {
        amount:   { type: 'number', description: 'Kwota w PLN' },
        category: { type: 'string', description: 'Kategoria np. jedzenie, transport' },
        note:     { type: 'string', description: 'Opcjonalny opis' },
      },
      required: ['amount'],
    },
  },
]

export async function executeFinanceTool(name: string, args: unknown, db: D1Database) {
  const a = args as { amount: number; category?: string; note?: string }
  if (name === 'finance_add_expense') {
    await db.prepare('INSERT INTO expenses (amount, category, note) VALUES (?, ?, ?)')
      .bind(a.amount, a.category ?? null, a.note ?? null).run()
    return { ok: true }
  }
}
```

**2. Zarejestruj w `src/tools/index.ts`:**

```typescript
import { financeTools, executeFinanceTool } from './finance'

export const tools = [...taskTools, ...noteTools, ...financeTools]

export async function executeTool(name, args, db) {
  if (name.startsWith('finance_')) return executeFinanceTool(name, args, db)
  // ...
}
```

**3. Dodaj migrację `src/db/migrations/002_finance.sql`:**

```sql
CREATE TABLE IF NOT EXISTS expenses (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  amount   REAL NOT NULL,
  category TEXT,
  note     TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**4. Wdróż:**

```bash
npm run db:migrate:remote
npm run deploy
```

Gotowe — Bolek od razu umie zapisywać wydatki.

---

### Zmiana modelu AI

W `wrangler.toml`:

```toml
[vars]
AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
```

Albo podepnij Claude lub GPT — wystarczy podmienić funkcję `runAI` w `src/orchestrator.ts`.

### Proaktywne działania (np. poranny briefing)

Odkomentuj w `wrangler.toml`:

```toml
[[triggers.crons]]
crons = ["0 7 * * *"]
```

Dodaj handler w `src/index.ts`:

```typescript
export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env) {
    // Bolek sam wysyła poranne podsumowanie zadań, itp.
  }
}
```

---

## Pomysły co można dodać

| Moduł | Co robi |
|---|---|
| `reminders.ts` | Przypomnij mi o X za N godzin |
| `finance.ts` | Budżet, wydatki, kategorie |
| `habits.ts` | Śledzenie nawyków: siłownia, woda, sen |
| `journal.ts` | Dziennik osobisty |
| `contacts.ts` | Notatki o ludziach, historia kontaktu |
| `goals.ts` | Długoterminowe cele z postępem |
| `voice.ts` | Transkrypcja wiadomości głosowych z Telegrama |
| `search.ts` | Bolek może googlować żeby odpowiedzieć |

---

## Ten projekt nie ma końca

Bolek to platforma, nie aplikacja. Każdy nowy obszar życia to nowy plik z narzędziami — bez przepisywania czegokolwiek, bez decyzji architektonicznych.

Rozwijaj go razem z AI: opisz co chcesz dodać, AI napisze kod, Ty deploy'ujesz jedną komendą.
