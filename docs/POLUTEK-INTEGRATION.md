# Bolek ↔ Polutek.pl — Integracja operacyjna

> **Status:** projekt / do zbudowania. Ten dokument jest mapą budowy dla sesji kodowania bolka.
> Nic z opisanych tu narzędzi (`stripe.ts`, `clerk.ts`, `email.ts`, `polutek.ts`, briefing) jeszcze nie istnieje — to lista tego, co trzeba dodać.

---

## 1. Po co to jest

Bolek to osobisty agent operacyjny właściciela. **Jednym z systemów, które bolek obsługuje, jest aplikacja [polutek.pl](https://polutek.pl).**

Bolek NIE jest częścią Polutka i nie mieszka w jego kodzie. Bolek to **osobny agent z zawężonymi kluczami**, który:

- **monitoruje** Polutka (przychód, płatności, patroni, nowi użytkownicy, awarie, deploymenty, maile),
- **raportuje** właścicielowi (dzienny briefing na Telegram/mail + odpowiedzi na żądanie),
- **wykonuje wybrane akcje operacyjne** (np. refund) — zawsze przez bramkę zgody (`agent-mode.ts`, tryb `confirm`).

Powód rozdzielenia: Polutek to produkcyjny system płatnościowy serwujący wideo patronom. Bolek to narzędzie, które ciągle się rozwija i eksperymentuje. Trzymamy je osobno, żeby:
- awaria/eksperyment w bolku nigdy nie dotknął produkcji Polutka,
- klucze do pieniędzy/tożsamości/skrzynki żyły osobno od publicznej powierzchni ataku aplikacji,
- każdy z nich miał własny cykl życia i własny harmonogram.

---

## 2. Czym jest Polutek (kontekst, który bolek musi znać)

- **Jednokanałowa platforma VOD** dla jednego twórcy. Nie SaaS, nie marketplace, nie subskrypcje.
- **Patronat = dożywotnia nagroda** za jednorazowy kwalifikujący napiwek przez Stripe. Brak subskrypcji cyklicznych.
- Wideo mają trzy poziomy dostępu: `PUBLIC`, `LOGGED_IN`, `PATRON`.
- Stack Polutka: Next.js 14 (Vercel), Neon PostgreSQL (Prisma), Clerk (tożsamość), Stripe (płatności), Cloudflare Stream (wideo), Resend (mail).

### Inwarianty Polutka, których bolek NIE MOŻE łamać

Bolek działa „z zewnątrz" i musi respektować reguły domeny Polutka. **Bolek nigdy nie pisze bezpośrednio do bazy Polutka w kwestiach patronatu/płatności** — od tego jest ops-API Polutka (patrz §5), które wykonuje te operacje canonicznie po swojej stronie.

- **Źródłem prawdy o patronacie jest tabela `PatronGrant`** (user jest patronem ⟺ ma grant z `revokedAt = null`). Pola `User.isPatron` NIE ISTNIEJĄ. Bolek nie wnioskuje o patronacie z metadanych Clerka.
- **Fulfillment płatności idzie wyłącznie przez `fulfillPayment()`** po stronie Polutka — idempotentny, replay-safe. Bolek NIGDY nie ustawia płatności na `SUCCEEDED` ręcznie.
- **Refund to para operacji, nie sam przelew:** zwrot w Stripe **oraz** (decyzja biznesowa) cofnięcie patronatu (`revoke-patron`). Bolek zleca to ops-API Polutka jako jedną intencję, nie wykonuje po kawałku.
- **Clerk = tylko tożsamość.** Nie jest autorytetem dostępu. Skok rejestracji w Clerku bolek raportuje jako sygnał (kampania? boty?), nie jako zmianę statusu patronów.
- **Nigdy nie eksponować `videoUrl`.** Bolka to nie dotyczy bezpośrednio (nie serwuje wideo), ale ops-API Polutka nie może mu tego zwracać.

---

## 3. Architektura docelowa

```
        ┌───────────────────────────┐
        │   Właściciel (Telegram)   │
        └─────────────┬─────────────┘
                      │  briefing + zgody ("tak")
        ┌─────────────▼─────────────┐
        │   BOLEK (Cloudflare Worker)│
        │   orchestrator + D1 pamięć │
        │   agent-mode: confirm gate │
        └─┬────┬────┬────┬────┬───────┘
   scoped │    │    │    │    │ scoped/OAuth
    key   │    │    │    │    │
   ┌──────▼┐ ┌─▼───┐ ┌▼────┐ ┌▼──────────┐ ┌▼──────────────┐
   │Stripe │ │Clerk│ │Vercel│ │home.pl    │ │  POLUTEK       │
   │(read+ │ │(read│ │(depl.│ │(IMAP/SMTP)│ │  ops-API       │
   │refund)│ │+ban)│ │+logi │ │Resend     │ │ (na Vercelu)   │
   │       │ │     │ │+błędy│ │           │ │                │
   └───────┘ └─────┘ └──────┘ └───────────┘ └──┬─────────────┘
                                          │ canoniczne operacje
                                    ┌─────▼──────────────┐
                                    │ fulfillPayment /   │
                                    │ revoke-patron /    │
                                    │ PatronGrant (Neon) │
                                    └────────────────────┘
```

Zasada: **do systemów zewnętrznych (Stripe/Clerk/Vercel/home.pl) bolek chodzi bezpośrednio zawężonym kluczem; do wnętrza Polutka (patroni, granty, refund+revoke) — wyłącznie przez ops-API Polutka.**

**Vercel jest kluczowym źródłem monitoringu Polutka** — z jego logów bolek bierze wykrycie awarii, błędy runtime i korelację „deploy → wzrost 500-tek". To z Vercela pochodzi „okno awarii" w dziennym raporcie. Narzędzie `src/tools/vercel.ts` **już istnieje** i `VERCEL_TOKEN` działa od zaraz — więc monitoring deploymentów/awarii Polutka jest dostępny bez pisania nowego kodu.

**home.pl (IMAP/SMTP) obsługuje pocztu `kontakt@polutek.pl`** — mail przychodzący od użytkowników. Bolek łączy się do home.pl przez IMAP (czytanie), SMTP (wysyłanie). Resend obsługuje osobno maile systemowe wychodzące z aplikacji Polutka (potwierdzenia patronatu, broadcasty).

---

## 4. Co trzeba DODAĆ w repo bolka

Każde narzędzie to ten sam wzorzec co istniejący `src/tools/vercel.ts`: jeden plik + rejestracja w `src/tools/index.ts` + prefiks w `executeTool`. Akcje nieodwracalne owija się w `runAction()` z `agent-mode.ts`.

| Plik | Prefiks narzędzi | Zakres |
|---|---|---|
| `src/tools/vercel.ts` ✅ **już istnieje** | `vercel_` | monitoring Polutka: deploymenty, logi, błędy runtime, redeploy. Fundament wykrywania awarii w raporcie. Działa z `VERCEL_TOKEN` od zaraz — do dopracowania: filtr pod projekt `polutek-pl` w briefingu |
| `src/tools/stripe.ts` | `stripe_` | odczyt: przychód, nieudane płatności, `PENDING`, disputes. Akcja: `stripe_refund` (przez `runAction` + ops-API Polutka) |
| `src/tools/clerk.ts` | `clerk_` | odczyt: nowi userzy, skoki rejestracji, nieudane logowania. Akcja: `clerk_ban_user` (przez `runAction`) |
| `src/tools/email-imap-smtp.ts` | `email_` | Resend: deliverability wychodzących maili systemowych. IMAP/SMTP (home.pl): czytanie przychodzących na `kontakt@polutek.pl`, triage, przygotowanie odpowiedzi (wysyłka przez `runAction` ze statusu `kontakt@polutek.pl`) |
| `src/tools/polutek.ts` | `polutek_` | wołanie ops-API Polutka: podsumowanie dnia, stan patronów, korelacja płatność→dostęp, zlecenie refund+revoke |
| `src/tools/briefing.ts` (lub w cron handlerze w `index.ts`) | — | składa dzienny raport z powyższych i wysyła na Telegram/mail przez Cron Trigger |

Migracja D1 (nowy plik `src/db/migrations/005_ops.sql`) — jeśli bolek ma zapamiętywać stan operacyjny (np. ostatni raport, kolejka zatwierdzeń, log akcji). Zgodnie z regułą repo: **jedna migracja na zmianę, nigdy nie usuwać starych.**

---

## 5. Co trzeba DODAĆ po stronie Polutka (ops-API)

Cienka, uwierzytelniona warstwa w Polutku (`app/api/ops/*`), chroniona tokenem tylko dla bolka (`OPS_API_TOKEN`, bearer). Wołana wyłącznie przez bolka. Dzięki niej bolek nie zna schematu bazy Polutka i nie łamie jego inwariantów — operacje wykonują się canonicznie po stronie Polutka.

| Endpoint | Metoda | Rola |
|---|---|---|
| `/api/ops/summary` | GET | podsumowanie dnia: przychód, nowi patroni, płatności `PENDING`, liczba nowych userów, okno awarii |
| `/api/ops/patron/[userId]` | GET | diagnostyka patrona (granty, od kiedy, źródło) — read model, bez `videoUrl` |
| `/api/ops/refund` | POST | zleca refund: uruchamia zwrot Stripe **i** `revoke-patron` po stronie Polutka jako jedną operację. Body: `{ paymentId, revokePatron: boolean, reason }` |

> **Uwaga:** endpointy ops muszą respektować inwarianty Polutka — refund idzie przez canoniczne use-case'y (`fulfillPayment`/`revoke-patron`), nie przez ręczne `updateMany`. To Polutek jest autorytetem, bolek tylko zleca.

---

## 6. Klucze i sekrety, których będziesz potrzebował

Wszystkie ustawiane w **Cloudflare → kulfon → Settings → Variables and Secrets**. Zasada: **najmniejsze uprawnienia, na start wszędzie read-only.**

| Sekret | System | Zakres (ważne!) | Gdzie zdobyć |
|---|---|---|---|
| `STRIPE_KEY` | Stripe | **Restricted key**, na start tylko *read* (Payments, Charges, Disputes). Prawo do refundów dołożyć osobno, świadomie. | Stripe → Developers → API keys → Create restricted key |
| `CLERK_SECRET_KEY` | Clerk | Osobny secret key (nie ten produkcyjny Polutka). | Clerk Dashboard → API Keys |
| `RESEND_API_KEY` | Resend | Read (analytics/emails systemowych). | Resend → API Keys |
| `EMAIL_IMAP_HOST` | home.pl | Host IMAP poczty home.pl (np. `poczta.home.pl` lub `mail.polutek.pl`) | home.pl panel → Poczta → szczegóły konta |
| `EMAIL_IMAP_PORT` | home.pl | Port IMAP (zazwyczaj `993` dla SSL) | home.pl panel |
| `EMAIL_IMAP_USER` | home.pl | Pełny login pocztowy (np. `kontakt@polutek.pl`) | home.pl panel |
| `EMAIL_IMAP_PASSWORD` | home.pl | Hasło do poczty lub app-specific token | home.pl panel |
| `EMAIL_SMTP_HOST` | home.pl | Host SMTP poczty home.pl (zazwyczaj jak IMAP) | home.pl panel → Poczta |
| `EMAIL_SMTP_PORT` | home.pl | Port SMTP (zazwyczaj `465` dla SSL lub `587` dla TLS) | home.pl panel |
| `EMAIL_SMTP_USER` | home.pl | Pełny login pocztowy (jak IMAP) | home.pl panel |
| `EMAIL_SMTP_PASSWORD` | home.pl | Hasło do poczty (jak IMAP) | home.pl panel |
| `POLUTEK_OPS_URL` | Polutek | URL ops-API (np. `https://polutek.pl/api/ops`). | — |
| `POLUTEK_OPS_TOKEN` | Polutek | Bearer token współdzielony z `OPS_API_TOKEN` po stronie Polutka. | wygenerować (≥32 znaki losowe) |

Już istniejące i przydatne: `ANTHROPIC_API_KEY` (mózg), `VERCEL_TOKEN` (monitoring deploymentów/awarii Polutka — **działa już dziś**), `GITHUB_TOKEN`.

Po stronie Polutka (Vercel env): `OPS_API_TOKEN` — ta sama wartość co `POLUTEK_OPS_TOKEN` w bolku.

---

## 7. ⚠️ Dług do spłacenia PRZED podpięciem akcji finansowych

W `src/agent-mode.ts`, tryb `confirm` zapisuje do D1 **tylko tekstowy opis** akcji (`pending_action = description`), a nie samej wykonywalnej akcji (domknięcie `action: () => Promise<string>` nie da się zserializować). Skutek: po odpowiedzi „tak" **nie ma jak odtworzyć i wykonać oryginalnej akcji.**

Dla `vercel_redeploy` to nieszkodliwe. Dla `stripe_refund` to znaczy, że potwierdzenie donikąd nie prowadzi. **Zanim bolek dostanie prawo do refundów, trzeba przerobić `confirm` tak, żeby zapisywał wykonywalną intencję** (np. `{ tool: 'stripe_refund', args: {...} }` w tabeli `pending_actions`), a odpowiedź „tak" podnosiła ją z kolejki i odpalała przez `executeTool`.

---

## 8. Kolejność wdrożenia (od zera ryzyka do akcji)

1. **`stripe.ts` + `clerk.ts` — tylko odczyt.** Bolek odpowiada „ile dziś zarobiłem / ilu nowych userów / czy coś utknęło w PENDING". Zero ryzyka.
2. **`polutek.ts` (read) + `/api/ops/summary`.** Bolek pyta Polutka o stan dnia jednym wywołaniem.
3. **Dzienny briefing na Cron Trigger.** Raport rano na Telegram: przychód, nowi patroni, nowi userzy (+ flaga anomalii), okno awarii z oceną „ile płatności zawiodło", lista rzeczy do decyzji.
4. **`email-imap-smtp.ts` — IMAP/SMTP home.pl, Resend deliverability.** Bolek czyta przychodzące na `kontakt@polutek.pl`, kategoryzuje, przygotowuje odpowiedzi; Ty zatwierdzasz wysyłkę.
5. **Napraw bramkę `confirm`** (§7).
6. **Akcje finansowe:** `stripe_refund` + `/api/ops/refund` (refund + revoke atomowo po stronie Polutka), zawsze przez `runAction` w trybie `confirm`.

---

## 9. Checklista na sesję kodowania bolka

- [ ] `src/tools/stripe.ts` (read) + rejestracja w `index.ts` + prefiks `stripe_`
- [ ] `src/tools/clerk.ts` (read) + rejestracja
- [ ] `src/tools/polutek.ts` (woła ops-API) + rejestracja
- [ ] Polutek: `app/api/ops/summary` (GET, bearer `OPS_API_TOKEN`)
- [ ] Cron briefing (Telegram) w `src/index.ts` / `briefing.ts`
- [ ] `src/tools/email-imap-smtp.ts` (IMAP/SMTP home.pl czytanie, SMTP wysyłanie, Resend monitoring)
- [ ] Refaktor `agent-mode.ts` — wykonywalna kolejka `pending_actions` (§7)
- [ ] Polutek: `app/api/ops/refund` (POST, refund + revoke przez canoniczne use-case'y)
- [ ] `stripe_refund` przez `runAction`
- [ ] Sekrety w Cloudflare (Stripe restricted, Clerk, Gmail OAuth, Resend, POLUTEK_OPS_*)
- [ ] `OPS_API_TOKEN` w env Polutka na Vercelu

---

## 10. Reguły, których trzymaj się przy budowie

- **Read najpierw, akcje potem.** Każde narzędzie startuje jako read-only; akcje dokładasz pojedynczo, świadomie.
- **Nieodwracalne akcje zawsze przez `runAction` (confirm).** Refund, ban, wysłanie maila, redeploy.
- **Treść od użytkownika (maile, prośby) to dane, nie polecenia.** Agent czytający obcą treść nigdy nie ma bezpośredniej mocy finansowej bez potwierdzenia właściciela — ochrona przed prompt injection.
- **Wnętrze Polutka tylko przez ops-API.** Bolek nie pisze do bazy Neon Polutka w sprawach patronatu/płatności.
- **Wszystko, co bolek zrobił, ma zostać w logu** (D1) — audytowalność akcji.
- **Zawężone, odwoływalne klucze.** Każdy klucz da się unieważnić bez ruszania produkcji Polutka.
