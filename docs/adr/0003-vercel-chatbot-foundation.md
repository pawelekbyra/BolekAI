# ADR-0003: Vercel Chatbot jako foundation rozmowy Kulfona

## Status

Proposed

## Data

2026-06-24

## Kontekst

Kulfon OS ma być prywatnym centrum operacyjnym użytkownika. Do tej pory rozwój szedł w stronę własnego chatu i własnego command center UI.

Po ocenie kierunku produktowego zapadła decyzja, że nie chcemy ręcznie odtwarzać pełnego doświadczenia ChatGPT od zera, jeśli istnieje gotowy, dobrze utrzymywany fundament, który można dostosować do Kulfona.

Vercel Chatbot jest oficjalnym, open-source template’em opartym o Next.js i AI SDK. Zawiera wiele elementów, które Kulfon musiałby zbudować samodzielnie:

- Next.js App Router,
- Vercel AI SDK,
- shadcn/ui i Tailwind,
- Auth.js,
- persistence w PostgreSQL przez Drizzle,
- storage plików przez Vercel Blob,
- historię rozmów,
- attachmenty,
- artifacts/workspace,
- tool approval,
- testy E2E.

Dla Kulfona szczególnie ważne są dwa mechanizmy:

1. **Artifacts** — workspace obok chatu podobny do ChatGPT Canvas / Claude Artifacts. Może stać się bazą dla Plan Artifact, Decision Artifact, Project Artifact i Jules Task Artifact.
2. **Tool Approval** — mechanizm wymagający zgody użytkownika przed wykonaniem wrażliwych narzędzi. Jest zgodny z filozofią Kulfona: analiza automatyczna, konsekwencje po zgodzie.

## Problem

Obecny własny chat Kulfona działa, ale dalsze ręczne dokładanie wszystkich funkcji typu:

- historia rozmów,
- logowanie,
- pliki,
- artifacts/canvas,
- approval states,
- retry/regenerate/edit,
- persistence,
- multi-model routing,
- testy,

może być stratą czasu i odejściem od zasady „składaka Terminatora”.

Kulfon powinien budować własną przewagę na osobowości, narzędziach, permission engine, systemie spraw, pamięci i decyzjach, a nie na ręcznym pisaniu generycznego chat UI.

## Decyzja

Traktujemy Vercel Chatbot jako głównego kandydata na foundation rozmowy Kulfona.

To nie jest jeszcze decyzja o pełnej migracji. To jest decyzja o wykonaniu spike, który porówna dwie strategie:

1. **Fork/template-first** — oprzeć nową wersję Kulfona na Vercel Chatbot i przenieść do niego DNA Kulfona.
2. **Import-parts** — zostawić obecne repo i przenieść wybrane moduły z Vercel Chatbot.

Do zakończenia spike nie rozwijamy agresywnie własnego custom chat UI jako docelowego kierunku.

## Opcje rozważone

### Opcja A — dalej pisać własny chat

Plusy:

- pełna kontrola,
- mała liczba zależności,
- mniej migracji teraz.

Minusy:

- duży koszt odtworzenia funkcji ChatGPT,
- wolniejszy rozwój,
- ryzyko słabszego UX,
- więcej własnego kodu do utrzymania.

### Opcja B — Vercel Chatbot fork/template-first

Plusy:

- najbliższy stackowi Kulfona,
- gotowy chat foundation,
- historia rozmów,
- auth,
- baza,
- file storage,
- artifacts,
- tool approval,
- shadcn/ui,
- AI SDK,
- testy.

Minusy:

- większa migracja,
- więcej zależności,
- konieczność przeniesienia dokumentacji i narzędzi Kulfona,
- ryzyko walki z gotową strukturą template’u.

### Opcja C — import wybranych modułów z Vercel Chatbot

Plusy:

- mniejsza zmiana repo,
- można migrować stopniowo,
- zachowujemy obecny kierunek UI.

Minusy:

- ryzyko rozjechania zależności,
- trudniejsze utrzymanie,
- można skończyć z niepełną kopią template’u.

### Opcja D — LibreChat / Open WebUI

Plusy:

- bardzo pełne produkty,
- dużo funkcji gotowych.

Minusy:

- mniej pasują do obecnego stacku Next.js/Vercel/shadcn,
- bardziej są osobnymi platformami niż foundation do własnego Kulfon OS,
- trudniej wpleść własną architekturę i dokumentację-first.

## Rekomendacja robocza

Wykonać spike dla Vercel Chatbot.

W spike preferować strategię fork/template-first, jeśli okaże się, że:

- da się łatwo przenieść system prompt Kulfona,
- da się przenieść GitHub/Vercel/Jules tools,
- da się zachować approval philosophy,
- da się zbudować Kulfon artifacts,
- koszt migracji jest niższy niż dalsze ręczne budowanie własnego chatu.

## Konsekwencje

- PR #12 z własnym AppShell traktujemy jako eksperyment/przejściowy shell, nie jako ostateczny direction.
- Nie dokładamy kolejnych dużych funkcji do własnego chatu, dopóki spike nie zakończy się decyzją.
- Priorytetem staje się issue #13: ocena Vercel Chatbot jako conversation foundation.
- Następna większa implementacja powinna wynikać z wyniku spike.

## Ryzyka

- Vercel Chatbot może wymagać większej migracji niż zakładamy.
- Gotowy template może narzucać strukturę, która utrudni Kulfon OS.
- Auth/database/storage mogą zwiększyć próg uruchomienia projektu.
- Zmiana foundation może unieważnić część niedawnego custom UI.
- Trzeba pilnować, żeby nie zgubić zasad Kulfona: approval-first, dokumentacja-first, permission engine i własna osobowość.

## Kryteria powodzenia spike

Spike jest udany, jeśli odpowie na pytania:

1. Czy Vercel Chatbot nadaje się jako foundation rozmowy Kulfona?
2. Czy wybrać fork/template-first czy import-parts?
3. Jak przenieść obecne narzędzia Kulfona?
4. Jak przenieść system prompt i dokumentację?
5. Jak zbudować Kulfon artifacts?
6. Jakie zmienne środowiskowe, baza i storage będą potrzebne?
7. Jaki jest pierwszy PR migracyjny?

## Źródła

- https://github.com/vercel/chatbot
- https://chatbot.ai-sdk.dev/docs/architecture
- https://chatbot.ai-sdk.dev/docs/customization/artifacts
- https://chatbot.ai-sdk.dev/docs/customization/tool-approval

## Powiązane

- Issue #13: Spike: Evaluate Vercel Chatbot as Kulfon conversation foundation
- ADR-0002: shadcn/ui jako foundation UI Kulfona
