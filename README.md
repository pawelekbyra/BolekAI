# AGENT BOLEK

Osobisty asystent AI. Działa przez Telegram i przeglądarkę. Pamięta wszystko. Zarządza kodem, projektami i życiem. Rośnie bez końca.

Obsługuje też aplikację **[polutek.pl](https://polutek.pl)** — monitoring (Stripe, Clerk, Vercel, mail), dzienny raport i wybrane akcje operacyjne (np. refund) za bramką zgody. Pełna mapa budowy: **[`docs/POLUTEK-INTEGRATION.md`](docs/POLUTEK-INTEGRATION.md)**.

---

## Jak to działa

```
Ty (Telegram lub web) → Cloudflare Worker (kulfon) → AI (Claude lub llama) → Narzędzia → Baza D1
```

Piszesz do Bolka normalnym językiem. On rozumie o co chodzi, wybiera narzędzie i odpowiada. Historia rozmów jest zapisywana — Bolek pamięta poprzednie rozmowy i fakty o Tobie.

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

export const tools = [...existingTools, ...financeTools]

export async function executeTool(name, args, db, chatId, env) {
  if (name.startsWith('finance_')) return executeFinanceTool(name, args, db)
  // ...
}
```

**3. Dodaj migrację `src/db/migrations/005_finance.sql`:**

```sql
CREATE TABLE IF NOT EXISTS expenses (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  amount     REAL NOT NULL,
  category   TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**4. Uruchom migrację przez Cloudflare MCP lub dashboard D1.**

Gotowe — Bolek od razu umie nową rzecz.

---

## Migracje bazy danych

Migracje są numerowane i stosowane po kolei. Nigdy nie usuwaj starych plików.

**Lista migracji:**
- `001_initial.sql` — wiadomości, zadania, notatki
- `002_memory_reminders.sql` — fakty o właścicielu, przypomnienia
- `003_agents.sql` — agenci (Mailer, Researcher, Coder, Analyst) i kolejka zadań
- `004_characters.sql` — postacie (Marek, Asia, Stary, Zofia), debaty

Nową migrację uruchamiasz przez Cloudflare dashboard → D1 → bolek-memory → Query.

---

## Zmienne środowiskowe

Wszystkie ustawiane w Cloudflare → kulfon → Settings → Variables and Secrets.

| Zmienna | Wymagana | Do czego |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | TAK | Odbieranie i wysyłanie wiadomości |
| `TELEGRAM_WEBHOOK_SECRET` | TAK | Zabezpieczenie webhooka |
| `ANTHROPIC_API_KEY` | zalecane | Claude jako mózg Bolka (niezawodny) |
| `GITHUB_TOKEN` | nie | Zarządzanie repozytoriami |
| `VERCEL_TOKEN` | nie | Monitoring projektów i deploymentów |

---

## Struktura projektu

```
src/
  index.ts            # Worker — routes + cron handler (przypomnienia)
  env.ts              # Typy zmiennych środowiskowych
  telegram.ts         # Obsługa wiadomości z Telegrama
  orchestrator.ts     # Mózg Bolka — AI + wybór narzędzi + pamięć
  memory.ts           # Historia rozmów z D1
  tools/
    index.ts          # Rejestr wszystkich narzędzi
    tasks.ts          # Zadania
    notes.ts          # Notatki
    facts.ts          # Fakty o właścicielu (długoterminowa pamięć)
    reminders.ts      # Przypomnienia z timerem
    github.ts         # GitHub API
    vercel.ts         # Vercel API
    coding.ts         # Zlecanie zadań kodowania Claude AI
    agents.ts         # Multi-agent system
    characters.ts     # Postacie z osobowościami
  agents/
    characters.ts     # Definicje postaci (Marek, Asia, Stary, Zofia)
    debate.ts         # System debat między postaciami
    runner.ts         # Egzekutor zadań agentów
  db/migrations/
    001_initial.sql
    002_memory_reminders.sql
    003_agents.sql
    004_characters.sql

web/                  # Interfejs webowy (Next.js)
  app/
    page.tsx          # Czat w przeglądarce
    agents/page.tsx   # Dashboard agentów
    characters/page.tsx # Feed postaci

wrangler.toml         # Konfiguracja Cloudflare
```

---

## Architektura AI

Bolek obsługuje dwa silniki AI wymienialnie:

**Claude API** (zalecany) — gdy ustawiony `ANTHROPIC_API_KEY`:
- Model: Claude Haiku (szybki i tani)
- Niezawodne tool calling
- Lepsza polszczyzna i rozumienie kontekstu

**Workers AI** (fallback, darmowy) — gdy brak klucza:
- Model: llama-3.2-3b-instruct
- Bez gwarancji dostępności
- Wystarczy do testów

Zmiana silnika = jedna zmienna w Cloudflare, zero zmian w kodzie.

---

## Ten projekt nie ma końca

Bolek to platforma, nie aplikacja. Każdy nowy obszar życia = nowy plik w `src/tools/`. Bez przepisywania architektury, bez limitów.

Rozwijaj go razem z AI — opisz co chcesz dodać, AI napisze kod, nowa wersja deployuje się automatycznie przy każdym pushu do `main`.
