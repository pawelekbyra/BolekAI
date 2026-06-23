# ADR-0001: Documentation-first jako sposób rozwoju Kulfona

## Status

Accepted

## Data

2026-06-24

## Kontekst

Kulfon OS ma być rozwijany przez człowieka i agentów kodujących: ChatGPT, Codex, Jules oraz przyszłe narzędzia agentowe.

Projekt ma rosnąć etapami z minimalistycznego startera w prywatne centrum operacyjne użytkownika. Bez silnej dokumentacji istnieje duże ryzyko chaosu: agenci będą robić zbyt szerokie zmiany, dublować decyzje, omijać zasady bezpieczeństwa albo dodawać integracje w złej kolejności.

Potrzebujemy sposobu pracy, w którym dokumentacja jest źródłem prawdy dla ludzi i agentów.

## Opcje

### Opcja A — kod-first

Najpierw implementujemy funkcje, a dokumentację dopisujemy później.

Plusy:

- szybki start kodowania,
- mniej pracy na początku.

Minusy:

- duże ryzyko chaosu,
- trudniejsze prowadzenie agentów,
- decyzje architektoniczne giną w rozmowach,
- większe ryzyko niespójnych refaktorów.

### Opcja B — documentation-first

Najpierw utrzymujemy manifest, dokumenty operacyjne, roadmapę, backlog i ADR-y. Kod powstaje małymi ticketami zgodnymi z dokumentacją.

Plusy:

- agenci mają jasny kontekst,
- łatwiej robić małe PR-y,
- decyzje są śledzone,
- bezpieczeństwo jest zapisane od początku,
- projekt może rosnąć bez utraty kierunku.

Minusy:

- wolniejszy start,
- wymaga dyscypliny aktualizacji dokumentów,
- istnieje ryzyko nadmiernego dokumentowania.

## Decyzja

Wybieramy documentation-first.

`README.md` jest głównym manifestem projektu. `AGENTS.md` jest krótką instrukcją operacyjną dla agentów. `docs/` zawiera roadmapę, backlog, security, promptbook i ADR-y.

Każda większa zmiana architektoniczna powinna mieć ADR albo aktualizację dokumentacji.

## Uzasadnienie

Kulfon ma być budowany przez prompty i agentów kodujących. Dokumentacja jest więc częścią systemu wykonawczego, nie dodatkiem.

Documentation-first zmniejsza ryzyko chaotycznej automatyzacji, ułatwia prowadzenie Julesa/Codexa i pozwala budować projekt małymi krokami.

To szczególnie ważne, bo Kulfon docelowo będzie dotykał narzędzi zewnętrznych, danych prywatnych, pamięci, automatyzacji i approval flow.

## Konsekwencje

- README pozostaje głównym DNA projektu.
- Agenci mają czytać README i AGENTS.md przed pracą.
- Roadmapa i backlog muszą być aktualizowane wraz z rozwojem.
- Większe decyzje technologiczne wymagają ADR.
- PR-y dotykające architektury, integracji, danych albo bezpieczeństwa powinny aktualizować dokumentację.

## Kiedy odwrócić decyzję

Tej decyzji nie należy odwracać lekko.

Można ją zmienić tylko wtedy, gdy:

- projekt przestanie być rozwijany przez agentów,
- dokumentacja stanie się ciężarem większym niż korzyścią,
- pojawi się lepszy system utrzymywania kontekstu projektowego,
- README i docs przestaną być aktualizowane i zaczną wprowadzać w błąd.
