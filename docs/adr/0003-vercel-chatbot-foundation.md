# ADR-0003: Vercel Chatbot jako foundation rozmowy Kulfona

## Status

Accepted — kierunek strategiczny przyjęty, implementacja wymaga spike.

## Data

2026-06-24

## Kontekst

Kulfon OS ma być prywatnym centrum operacyjnym użytkownika. Dotychczasowy własny chat działa jako zalążek: ma Vercel AI SDK, prosty UI, narzędzia GitHub/Vercel/Jules i approval flow. Jednak ręczne odtwarzanie pełnego doświadczenia typu ChatGPT byłoby kosztowne i niepotrzebne, jeśli istnieje dobry open-source foundation.

Potrzebujemy gotowca, który daje jak najwięcej z pudełka:

- dopracowany chat UI,
- historię rozmów,
- persistence,
- auth,
- obsługę plików,
- tool calling,
- approval dla narzędzi,
- workspace/artifacts obok rozmowy,
- shadcn/Tailwind,
- Next.js App Router,
- możliwość głębokich własnych przeróbek.

Vercel Chatbot jest obecnie najlepszym kandydatem, bo jest w tym samym świecie technologicznym co obecny Kulfon: Next.js, Vercel AI SDK, shadcn/ui, Tailwind, Server Actions, Auth.js, Drizzle, Postgres i Vercel Blob.

## Źródła i obserwacje

Publiczny template `vercel/chatbot` opisuje się jako pełny, hackowalny Next.js AI chatbot zbudowany przez Vercel. Repo zawiera strukturę typową dla większej aplikacji: `app`, `artifacts`, `components`, `hooks`, `lib`, `tests`, konfigurację Drizzle, Playwright, Vercel i pliki środowiskowe.

Dokumentacja architektury Vercel Chatbot opisuje:

- Next.js App Router z segmentami `(chat)` i `(auth)`,
- AI SDK jako warstwę modeli, tool use, RAG i reasoning,
- Auth.js do uwierzytelniania,
- PostgreSQL + Drizzle do historii rozmów, użytkowników i ustawień,
- Vercel Blob do uploadu plików,
- rekomendację firewall/rate limiting dla endpointów typu `/api/chat`,
- Playwright do testów E2E.

Dokumentacja artifacts opisuje specjalny tryb UI podobny do ChatGPT Canvas / Claude Artifacts. Template ma już typy artifacts: text, code, image i sheet, a także opisany wzorzec dodawania custom artifacts przez katalog `artifacts/<kind>/client.tsx` i `server.ts`.

Dokumentacja tool approval opisuje `needsApproval: true`, pauzę wykonania narzędzia, UI allow/deny, stany approval oraz automatyczną kontynuację rozmowy po zatwierdzeniu.

## Opcje

### Opcja A — kontynuować własny custom chat

Plusy:

- pełna kontrola,
- mało zależności,
- obecny kod jest prosty.

Minusy:

- trzeba ręcznie budować historię rozmów, auth, persistence, attachments, artifacts, lepsze tool states, message editing, retry, branching i wiele elementów UX,
- ryzyko przepisywania tego, co już istnieje,
- większy koszt dojścia do jakości podobnej do ChatGPT.

### Opcja B — assistant-ui jako główny chat UI

Plusy:

- bardzo dobre komponenty chatu,
- gotowe wzorce UI dla aplikacji AI,
- pasuje do React i Vercel AI SDK.

Minusy:

- to głównie warstwa UI chatu,
- nie daje od razu pełnego produktu z auth, db, file storage i artifacts,
- nadal trzeba doprojektować dużą część systemu operacyjnego Kulfona.

### Opcja C — CopilotKit jako główny agentic UI

Plusy:

- mocny kierunek generative UI,
- tool rendering,
- shared state,
- human-in-the-loop.

Minusy:

- większy frameworkowy skok,
- lepszy jako późniejsza warstwa agentic UX niż jako bazowy ChatGPT-like foundation,
- nie zastępuje całej aplikacji z historią, auth, db i artifacts.

### Opcja D — Vercel Chatbot jako foundation

Plusy:

- pełny open-source template,
- ten sam stack co Kulfon,
- Next.js App Router,
- AI SDK,
- shadcn/ui,
- Auth.js,
- PostgreSQL + Drizzle,
- Vercel Blob,
- artifacts/workspace,
- tool approval,
- testy,
- dobra baza do własnych przeróbek.

Minusy:

- większy kod do przejęcia,
- możliwa konieczność migracji struktury repo,
- trzeba zdecydować, czy forkować template, czy importować moduły,
- trzeba przenieść DNA Kulfona ostrożnie, bez utraty dokumentacji i approval philosophy.

## Decyzja

Przyjmujemy Vercel Chatbot jako strategiczny foundation dla rozmowy Kulfona.

Nie oznacza to natychmiastowego wyrzucenia obecnego kodu. Oznacza to, że dalsze duże inwestycje w ręczne budowanie własnego ChatGPT-like chatu zostają wstrzymane do czasu spike.

Najbliższy krok to spike techniczny:

1. porównać obecne repo Kulfona z `vercel/chatbot`,
2. zdecydować, czy lepszy jest fork/template migration, czy selektywny import modułów,
3. rozpisać mapowanie funkcji Kulfona na strukturę Vercel Chatbot,
4. przygotować plan migracji narzędzi GitHub/Vercel/Jules,
5. przygotować plan przeniesienia system promptu i approval philosophy,
6. zaplanować custom artifacts Kulfona.

## Kierunek docelowy

Kulfon powinien stać się:

```txt
Vercel Chatbot foundation
+ Kulfon personality
+ Kulfon system prompt
+ GitHub/Vercel/Jules tools
+ permission/approval philosophy
+ custom artifacts
+ system spraw
+ pamięć użytkownika
+ dashboard operacyjny
```

## Custom artifacts Kulfona

Vercel Chatbot artifacts powinny zostać wykorzystane jako baza dla:

- Plan Artifact,
- Decision Artifact,
- Project/Case Artifact,
- Jules Task Artifact,
- Research Artifact,
- Memory Artifact,
- Audit Artifact.

To pozwoli Kulfonowi planować i pracować obok rozmowy, zamiast tylko odpowiadać tekstem.

## Tool approval

Własny approval flow Kulfona powinien zostać porównany z mechanizmem `needsApproval` w Vercel Chatbot.

Docelowo Kulfon powinien utrzymać zasadę:

> Analiza może być automatyczna. Konsekwencje wymagają kontroli.

Jeżeli mechanizm Vercel Chatbot spełnia nasze wymagania, powinien stać się bazą dla approval UI i tool states. Jeśli nie, należy go rozszerzyć o Kulfon Permission Engine.

## Konsekwencje

- Zamrażamy dalsze duże prace nad własnym chat UI do czasu spike.
- PR-y dotyczące custom shella traktujemy jako przejściowe albo inspiracyjne, nie jako ostateczny kierunek rozmowy.
- Następny duży krok to analiza `vercel/chatbot` i plan migracji.
- Dokumentacja Kulfona pozostaje nadrzędnym DNA projektu.
- Migracja nie może usunąć zasad bezpieczeństwa, approval ani architektury dokumentacja-first.

## Kryteria sukcesu spike

Spike kończy się decyzją:

1. Forkujemy / restartujemy Kulfona na Vercel Chatbot,
2. albo importujemy z Vercel Chatbot wybrane moduły,
3. albo rezygnujemy z tej ścieżki, jeśli koszt migracji jest większy niż korzyść.

Spike musi odpowiedzieć na pytania:

- Jak przenieść system prompt Kulfona?
- Jak przenieść GitHub/Vercel/Jules tools?
- Jak zachować approval philosophy?
- Jak wykorzystać artifacts dla planów i decyzji?
- Jakie zmienne środowiskowe będą potrzebne?
- Jakie ryzyka niesie migracja?
- Jaki jest minimalny PR, który potwierdzi wykonalność?

## Czego nie robić teraz

- Nie dodawać CopilotKit przed spike.
- Nie dodawać assistant-ui przed spike.
- Nie budować ręcznie pełnej historii rozmów.
- Nie budować ręcznie artifacts/canvas.
- Nie przepisywać obecnego repo bez planu migracji.
- Nie usuwać dokumentacji Kulfona.
- Nie usuwać approval flow.

## Następny krok

Utworzyć issue:

```txt
Spike: Evaluate Vercel Chatbot as Kulfon conversation foundation
```

Wynikiem issue powinien być plan migracji oraz rekomendacja: fork/template migration vs selective import.
