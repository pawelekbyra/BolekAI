# AGENT BOLEK

Osobisty asystent AI. Działa przez Telegram i przeglądarkę. Pamięta wszystko. Zarządza kodem, projektami i życiem. Rośnie bez końca.

---

## Jak to działa

```
Ty (Telegram lub web) → Cloudflare Worker → AI (llama) → Narzędzia → Baza D1
```

Piszesz do Bolka normalnym językiem. On rozumie o co chodzi, wybiera narzędzie i odpowiada. Historia rozmów jest zapisywana — Bolek pamięta poprzednie rozmowy i fakty o Tobie.

---

## Czego potrzebujesz zanim zaczniesz

### 1. Konto Cloudflare (bezpłatne)
Wejdź na https://cloudflare.com i załóż konto. Darmowy plan wystarczy — Workers AI, D1, KV i Cron Triggers są na free.

### 2. Bot na Telegramie (wymagane)
- Otwórz Telegram i wyszukaj **@BotFather**
- Wyślij `/newbot`
- Podaj nazwę bota i username
- Skopiuj token który dostaniesz — będzie potrzebny przy setup

### 3. Node.js (wymagane)
Wersja 18 lub nowsza: https://nodejs.org

### 4. GitHub Token (opcjonalne — potrzebne do zarządzania kodem)
- Wejdź na https://github.com → kliknij swój avatar → **Settings**
- Lewy panel → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
- Kliknij **Generate new token (classic)**
- Zaznacz scope: **repo** (pełny dostęp do repozytoriów)
- Skopiuj token — zaczyna się od `ghp_...`

### 5. Vercel Token (opcjonalne — potrzebne do monitorowania projektów)
- Wejdź na https://vercel.com → kliknij swój avatar → **Settings**
- Lewy panel → **Tokens**
- Kliknij **Create** → podaj nazwę → skopiuj token

### 6. Anthropic API Key (opcjonalne — potrzebne do zlecania zadań kodowania)
- Wejdź na https://console.anthropic.com
- Lewy panel → **API Keys** → **Create Key**
- Skopiuj klucz — zaczyna się od `sk-ant-...`

---

## Pierwsze uruchomienie

```bash
npm install
./setup.sh
```

Skrypt przeprowadzi Cię przez cały proces:
1. Zaloguje do Cloudflare
2. Stworzy bazę D1 i przestrzeń KV
3. Zapyta o token Telegrama (wymagany)
4. Zapyta o tokeny GitHub, Vercel, Anthropic (opcjonalne — Enter żeby pominąć)
5. Wdroży Workera na Cloudflare
6. Ustawi webhook Telegrama

Po zakończeniu napisz do swojego bota — Bolek odpowie.

---

## Migracje bazy danych

Baza danych D1 wymaga uruchomienia migracji — bez tego Bolek nie będzie pamiętał rozmów ani zadań.

**Przy pierwszym uruchomieniu** setup.sh robi to automatycznie.

**Gdy dodajesz nowe funkcje** (nowa migracja w `src/db/migrations/`) musisz ją uruchomić ręcznie:

```bash
# Lokalne testowanie
npm run db:migrate:local

# Produkcja (Cloudflare)
npm run db:migrate:remote
```

Migracje są numerowane i stosowane po kolei — nigdy nie usuwaj starych plików migracji.

**Lista migracji:**
- `001_initial.sql` — wiadomości, zadania, notatki
- `002_memory_reminders.sql` — fakty o właścicielu, przypomnienia

---

## Dodanie tokenów po fakcie

Jeśli pominąłeś tokeny podczas setup lub chcesz je zmienić:

```bash
wrangler secret put GITHUB_TOKEN
wrangler secret put VERCEL_TOKEN
wrangler secret put ANTHROPIC_API_KEY
```

Wrangler zapyta o wartość — wklej token i Enter.

---

## Interfejs webowy

```bash
cd web
npm install
cp .env.local.example .env.local
# Otwórz .env.local i wpisz URL swojego Workera
npm run dev
```

Otwórz http://localhost:3000 — czat z Bolkiem w przeglądarce.

### Gdzie znaleźć URL Workera
Po deploy przez setup.sh lub `npm run deploy` — URL jest wypisany w terminalu. Wygląda tak:
```
https://agent-bolek.<twoj-subdomain>.workers.dev
```

### Deploy web na Vercel
1. Wejdź na https://vercel.com → **New Project** → importuj repo
2. Ustaw **Root Directory** na `web`
3. Dodaj zmienną: `NEXT_PUBLIC_BOLEK_API_URL` = URL Twojego Workera
4. Deploy

---

## Co Bolek umie

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

### Pamięć o Tobie
```
"mam na imię Paweł, pracuję jako developer"
"jestem alergikiem na gluten"
"lubię kawę bez cukru"
```
Bolek zapamiętuje te fakty na zawsze i używa ich w każdej rozmowie.

### GitHub (wymaga GITHUB_TOKEN)
```
"jakie mam repozytoria?"
"pokaż otwarte issues w pawelekbyra/kulfon"
"utwórz issue: błąd logowania na mobile"
"pokaż zawartość pliku src/index.ts w moim repo"
```

### Vercel (wymaga VERCEL_TOKEN)
```
"jakie mam projekty na Vercel?"
"pokaż ostatnie deploymenty projektu kulfon"
"sprawdź logi z ostatniego deploymentu"
"są jakieś błędy runtime w projekcie kulfon?"
"zrób redeploy"
```

### Zadania kodowania (wymaga ANTHROPIC_API_KEY)
```
"napisz endpoint /health do projektu kulfon w pliku src/health.ts"
"zrób review tego kodu: [wklej kod]"
"dodaj obsługę błędów do funkcji fetchUser i zapisz w repo pawelekbyra/kulfon w pliku src/utils.ts"
```
Bolek zleca zadanie Claude AI, dostaje kod i opcjonalnie sam commituje go do repozytorium.

### Tryb pracy agenta
```
"działaj autonomicznie"     → Bolek sam wykonuje akcje i tylko raportuje wynik
"pytaj mnie o zgodę"        → przed każdą akcją (commit, redeploy itp.) czeka na Twoje "tak"
"tryb manualny"             → tylko analizuje i sugeruje, nic nie wykonuje
```
Domyślny tryb to "pytaj o zgodę" — bezpieczny start.

---

## Struktura projektu

```
src/
  index.ts            # Worker — routes + cron handler (przypomnienia)
  env.ts              # Typy zmiennych środowiskowych
  telegram.ts         # Obsługa wiadomości z Telegrama
  orchestrator.ts     # Mózg Bolka — AI + wybór narzędzi + pamięć
  memory.ts           # Historia rozmów z D1
  agent-mode.ts       # Tryb pracy: autonomous / confirm / manual
  tools/
    index.ts          # Rejestr wszystkich narzędzi
    tasks.ts          # Zadania
    notes.ts          # Notatki
    facts.ts          # Fakty o właścicielu (długoterminowa pamięć)
    reminders.ts      # Przypomnienia z timerem
    github.ts         # GitHub API
    vercel.ts         # Vercel API
    coding.ts         # Zlecanie zadań kodowania Claude AI
  db/migrations/
    001_initial.sql   # Wiadomości, zadania, notatki
    002_memory_reminders.sql  # Fakty, przypomnienia

web/                  # Interfejs webowy (Next.js)
  app/page.tsx        # Czat w przeglądarce

setup.sh              # Skrypt pierwszego uruchomienia
wrangler.toml         # Konfiguracja Cloudflare
```

---

## Jak rozwijać Bolka

### Dodanie nowej umiejętności

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
      },
      required: ['amount'],
    },
  },
]

export async function executeFinanceTool(name: string, args: unknown, db: D1Database) {
  const a = args as { amount: number; category?: string }
  if (name === 'finance_add_expense') {
    await db.prepare('INSERT INTO expenses (amount, category) VALUES (?, ?)')
      .bind(a.amount, a.category ?? null).run()
    return { ok: true }
  }
}
```

**2. Zarejestruj w `src/tools/index.ts`:**

```typescript
import { financeTools, executeFinanceTool } from './finance'

export const tools = [..., ...financeTools]

export async function executeTool(name, args, db, chatId, env) {
  if (name.startsWith('finance_')) return executeFinanceTool(name, args, db)
  // ...
}
```

**3. Dodaj migrację `src/db/migrations/003_finance.sql`:**

```sql
CREATE TABLE IF NOT EXISTS expenses (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  amount     REAL NOT NULL,
  category   TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**4. Uruchom migrację i deploy:**

```bash
npm run db:migrate:remote
npm run deploy
```

Gotowe — Bolek od razu umie nową rzecz.

---

### Zmiana modelu AI

W `wrangler.toml`:

```toml
[vars]
AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
```

Dostępne modele Workers AI: https://developers.cloudflare.com/workers-ai/models/

### Podłączenie zewnętrznego modelu (Claude, GPT)

Podmień funkcję `runAI` w `src/orchestrator.ts` — reszta systemu zostaje bez zmian.

---

## Zmienne środowiskowe — pełna lista

| Zmienna | Wymagana | Skąd | Do czego |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | TAK | @BotFather na Telegramie | Odbieranie i wysyłanie wiadomości |
| `TELEGRAM_WEBHOOK_SECRET` | TAK | Generuje setup.sh | Zabezpieczenie webhooka |
| `GITHUB_TOKEN` | nie | github.com → Settings → Developer settings → PAT (scope: repo) | Zarządzanie repozytoriami |
| `VERCEL_TOKEN` | nie | vercel.com → Settings → Tokens | Monitoring projektów i deploymentów |
| `ANTHROPIC_API_KEY` | nie | console.anthropic.com → API Keys | Zlecanie zadań kodowania Claude AI |

Ustawianie po fakcie:
```bash
wrangler secret put NAZWA_ZMIENNEJ
```

---

## Ten projekt nie ma końca

Bolek to platforma, nie aplikacja. Każdy nowy obszar życia = nowy plik w `src/tools/`. Bez przepisywania architektury, bez limitów.

Rozwijaj go razem z AI — opisz co chcesz dodać, AI napisze kod, Ty uruchamiasz dwie komendy.
