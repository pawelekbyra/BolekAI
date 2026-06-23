# ADR-0002: shadcn/ui jako foundation UI Kulfona

## Status

Accepted

## Data

2026-06-24

## Kontekst

Kulfon OS ma przestać wyglądać jak prosty starter chatu i zacząć wyglądać jak prywatne centrum operacyjne użytkownika. Potrzebujemy UI foundation, który pozwoli szybko budować:

- dashboard,
- chat,
- decision inbox,
- approval cards,
- tool call cards,
- memory center,
- integracje,
- settings.

Projekt ma być rozwijany przez ludzi i agentów kodujących, więc komponenty UI powinny być jawne, łatwe do edycji i trzymane w repo.

## Opcje

### Opcja A — własny CSS bez gotowca

Plusy:

- brak nowych zależności,
- pełna kontrola,
- mały start.

Minusy:

- więcej ręcznego kodowania,
- trudniej utrzymać spójność,
- wolniejsza rozbudowa dashboardu,
- większe ryzyko chaotycznego UI.

### Opcja B — shadcn/ui jako foundation

Plusy:

- komponenty są kopiowane jako kod do repo,
- łatwe do edycji przez agentów,
- dobry standard dla React/Next.js,
- wspiera Tailwind i CSS variables,
- nie zamyka projektu w black-box bibliotece,
- dobrze pasuje do command center UI.

Minusy:

- wymaga Tailwind CSS,
- dodaje zależności,
- wymaga spójnej dyscypliny klas i komponentów.

### Opcja C — assistant-ui albo CopilotKit od razu

Plusy:

- mocne gotowce agentowego chatu,
- szybsze wejście w AI-specific UX.

Minusy:

- większy lock-in UX,
- większy skok zależności,
- trudniej oddzielić design foundation od agent runtime,
- na tym etapie może być za wcześnie.

## Decyzja

Wybieramy shadcn/ui jako foundation UI Kulfona.

Assistant-ui albo CopilotKit mogą zostać rozważone później jako warstwa agentowego chatu, ale nie jako pierwszy krok.

## Uzasadnienie

shadcn/ui najlepiej pasuje do filozofii “składaka Terminatora”: bierzemy gotowe, jakościowe komponenty, ale trzymamy je jako kod w repo, dzięki czemu można je łatwo modyfikować i rozwijać przez agentów.

To pozwala zbudować ładny, nowoczesny Kulfon command center bez przepisywania całego produktu i bez zamykania się w dużym frameworku UI.

## Konsekwencje

- Projekt używa Tailwind CSS jako warstwy stylowania UI.
- Komponenty bazowe trafiają do `components/ui`.
- Globalne theme variables trafiają do `app/globals.css`.
- Nowe elementy UI powinny preferować komponenty z `components/ui`.
- Nie dodajemy assistant-ui/CopilotKit bez osobnego ADR.

## Kiedy odwrócić decyzję

Możemy wrócić do tej decyzji, jeśli:

- Tailwind/shadcn okaże się zbyt ciężki,
- komponenty zaczną utrudniać rozwój,
- projekt przejdzie na inny gotowy agent UI,
- pojawi się silniejszy, bardziej pasujący design system,
- utrzymanie UI stanie się zbyt kosztowne.
