# Kulfon Agent

Czysty starter prywatnego agenta developerskiego zbudowanego na Next.js, Vercel AI SDK i Gemini API z Google AI Studio.

## Co już jest

- **Next.js 15** (App Router)
- **Vercel AI SDK 4** (Core + React)
- **Gemini 2.0 Flash** (domyślnie)
- **Warstwa Approval**: Akcje zapisujące (np. tworzenie issue) wymagają potwierdzenia użytkownika w UI i są bezpiecznie wykonywane przez Server Actions.
- **Narzędzia GitHub**: Informacje o repo, lista issue, tworzenie issue.
- **Narzędzia Jules**: Specjalny format issue (`createJulesTaskIssue`) dla Agenta Julesa.
- **Narzędzia Vercel**: Lista deploymentów (Vercel jest obecnie w trybie tylko do odczytu dla bezpieczeństwa).

## Szybki Start

1.  **Klonowanie i instalacja**:
    ```bash
    pnpm install
    ```
2.  **Konfiguracja zmiennych**:
    Skopiuj `.env.example` do `.env.local` i uzupełnij tokeny (patrz sekcja poniżej).
3.  **Uruchomienie**:
    ```bash
    pnpm dev
    ```
    Aplikacja dostępna pod `http://localhost:3000`.

## Konfiguracja Tokenów

### 1. Google AI Studio (Gemini)
- Wejdź na [Google AI Studio](https://aistudio.google.com/).
- Kliknij **"Get API key"**.
- Skopiuj klucz do `GOOGLE_GENERATIVE_AI_API_KEY`.
- (Opcjonalnie) Ustaw `GEMINI_MODEL=gemini-2.0-flash` (lub inny dostępny).

### 2. GitHub Token
- Przejdź do [GitHub Personal Access Tokens (fine-grained)](https://github.com/settings/tokens?type=beta).
- Wygeneruj nowy token z uprawnieniami **Read & Write** dla:
  - `Issues`
  - `Metadata` (zazwyczaj wymagane domyślnie)
  - `Pull Requests` (opcjonalnie)
- Ustaw `GITHUB_TOKEN`, `GITHUB_OWNER` (Twoja nazwa użytkownika) i `GITHUB_REPO` (nazwa repo).

### 3. Vercel Token
- Przejdź do [Vercel Tokens](https://vercel.com/account/tokens).
- Wygeneruj nowy token.
- Ustaw `VERCEL_TOKEN`.
- `VERCEL_PROJECT_ID` i `VERCEL_TEAM_ID` znajdziesz w ustawieniach projektu na Vercel (opcjonalne dla ogólnych akcji, ale zalecane).

## Deploy na Vercel

1.  Zainstaluj Vercel CLI: `npm i -g vercel`.
2.  Zaloguj się: `vercel login`.
3.  Uruchom `vercel` w folderze projektu.
4.  Dodaj wszystkie powyższe zmienne środowiskowe w panelu Vercel (`Project Settings > Environment Variables`).
5.  Zrób redeploy.

## Prompty Testowe

Po uruchomieniu spróbuj:
- *"Jakie mamy otwarte issue?"*
- *"Pokaż ostatnie deploymenty na Vercel."*
- *"Utwórz issue dla Julesa: dodaj ciemny motyw do interfejsu. Kryteria: toggle w rogu, localStorage."* (wymaga potwierdzenia w UI).

## Bezpieczeństwo i Approval Layer

- System posiada bezpieczną warstwę potwierdzeń dla akcji zapisujących.
- Narzędzia wymagające zgody są definiowane w `lib/approval.ts`.
- Serwer usuwa funkcję `execute` przed wysłaniem definicji do AI, co wymusza reakcję interfejsu.
- Po kliknięciu "Potwierdź", klient wywołuje **Server Action** (`lib/actions.ts`), który bezpiecznie wykonuje operację na serwerze (zachowując sekrety w bezpiecznym środowisku).
- Nie dodawaj sekretów do systemu kontroli wersji.
