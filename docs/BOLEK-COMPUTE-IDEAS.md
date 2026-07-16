# Bolek dostaje komputer — od pomysłu do działającego systemu (sesja 2026-07-15/16)

## Status dokumentu

Zaczęło się jako notatka z brainstormu. Od nocy 2026-07-15/16 **cała ta sekcja jest zbudowana, wdrożona i zweryfikowana end-to-end** — nie tylko zaplanowana. Oznaczenia jak w `ROADMAP.md`. Sekcja "Odchylenia od pierwotnego planu" niżej dokumentuje uczciwie, gdzie rzeczywista implementacja różni się od tego, co było pierwotnie zaprojektowane.

Kontekst: Bolek żyje na Cloudflare Workers — szybkie, tanie, ale sandboxowane (brak trwałego dysku, brak procesów, brak SSH). Ta sesja szukała odpowiedzi na pytanie "jak dać Bolkowi realną moc wykonawczą, nie tracąc bezpieczeństwa, które już ma".

## [✓ ZBUDOWANE] Bolek jako serwer MCP

Cały istniejący rejestr narzędzi Bolka (`src/tools/index.ts`) jest wystawiony jako serwer MCP (`src/mcp.ts`, Streamable HTTP na Fetch API, bez Express/Node bridge) pod:

- `POST /mcp` — auth przez nagłówek `Authorization: Bearer BOLEK_API_KEY` (Claude Code: `claude mcp add --transport http`)
- `POST /mcp/:secret` — auth przez sekret w ścieżce URL, dla klientów bez pola na własne nagłówki (claude.ai custom connector)

Efekt: Claude Code (lokalnie) i claude.ai (przeglądarka) mogą wołać narzędzia Bolka wprost — pobierać dane (Vercel, Stripe, Polutek) albo zlecać zadania (`task_add`, `note_save`) — bez przechodzenia przez Telegram. Wszystkie wywołania idą przez ten sam silnik polityk co zawsze: `executeTool()`, `decideToolPolicy()`, `/approve` na Telegramie dla ryzykownych akcji.

To zamyka pętlę: **Ty ↔ Bolek ↔ Claude (Telegram, Claude Code, claude.ai)** — jedna pamięć (D1), jeden rejestr narzędzi, trzy wejścia.

## [✓ ZBUDOWANE] Raport odwiedzin Polutka

Codziennie o 9:00 czasu warszawskiego (`src/visits-report.ts`, z automatycznym uwzględnieniem DST przez `Intl.DateTimeFormat`) Bolek liczy wczorajszy dzień kalendarzowy z Vercel Web Analytics (`vercel_get_pageviews` tool, `/v1/query/web-analytics/visits/count`) i wysyła podsumowanie na Telegram.

## [✓ ZBUDOWANE] Bolek dostaje własny komputer — zdalny Claude Code

Zamiast dorzucać Bolkowi pojedyncze narzędzia jedno po drugim (jak wcześniej: Vercel, Stripe, GitHub...), dostał dostęp do **pełnego agenta kodującego** na zawsze-włączonej maszynie — realnie tę samą moc, jaką ma Claude Code w interaktywnej sesji, tylko wywoływaną z Telegrama. Zweryfikowane end-to-end w nocy 2026-07-16: prawdziwe zadanie ("napisz kalkulator w Pythonie") przeszło przez Telegram → policy engine → `/approve <id>` → VM → plik zapisany na dysku (zweryfikowany ręcznie) → wynik i koszt ($0.0249, Haiku) z powrotem na Telegram.

### Architektura (wdrożona)

1. **Maszyna**: Oracle Cloud Free Tier VM (`141.253.103.172`, 2 vCPU, 11GB RAM, Ubuntu 22.04) — współdzielona z żywym sklepem produkcyjnym (`sklepik`: Rails/Puma + Sidekiq + Postgres + Redis + nginx w Dockerze)
2. **Silnik**: Node.js 22 + Claude Code CLI w trybie **headless/print** (`claude -p "prompt" --model haiku --dangerously-skip-permissions --output-format json`)
3. **Ciągłość rozmowy**: wrapper obsługuje `sessionId` → `--resume <session-id>`; `vm_claude_code` (`src/tools/vm-claude-code.ts`) przyjmuje opcjonalny `sessionId` i zwraca nowy w wyniku, do przekazania w kolejnym wywołaniu
4. **Ekspozycja**: `bolek-agent.service` (systemd, `~/bolek-agent/server.js`) na `127.0.0.1:8899` → Cloudflare Tunnel → Bolek woła `${VM_AGENT_URL}/task` zwykłym `fetch()` z nagłówkiem `X-Auth-Token`
5. **Narzędzie w rejestrze**: `vm_claude_code` — `riskLevel: 'high'`, `requiresApproval: true`, ten sam wzorzec `runAction()` co `coding_task`. Domyślny model: Haiku (tanio); `model: 'sonnet'` dostępny jako argument dla zadań wymagających więcej rozumowania
6. **Sekrety Cloudflare**: `VM_AGENT_URL`, `VM_AGENT_TOKEN` (ten sam token co `WRAPPER_AUTH_TOKEN` w `.env` na VM)

### ⚠️ Świadomy kompromis bezpieczeństwa

`claude -p` na VM działa z **`--dangerously-skip-permissions`** — bez pytania o zgodę na żadną komendę wewnątrz samej sesji Claude Code.

To stoi w bezpośrednim napięciu z zasadą nadrzędną z `ROADMAP.md`: *"Najpierw bezpieczeństwo, policy, approvale i audyt. Dopiero potem większa autonomia."* Mitygacja: `vm_claude_code` samo w sobie jest **`riskLevel: 'high'` + `requiresApproval: true`** w rejestrze Bolka — czyli każde wywołanie tego narzędzia (nie każda komenda wewnątrz niego) wymaga jawnego `/approve <id>` właściciela na Telegramie, zanim cokolwiek ruszy na VM. To jest bramka na poziomie "czy w ogóle to zadanie ma się wykonać", nie na poziomie pojedynczej komendy w środku — świadomie grubsza granulacja niż reszta polityki Bolka, zaakceptowana jako kompromis dla tego konkretnego narzędzia.

### Odchylenia od pierwotnego planu (uczciwie spisane)

- **Izolacja maszynowa NIE została wdrożona.** Plan zakładał osobnego użytkownika systemowego bez sudo, bez dostępu do `~/sklepik`. Właściciel świadomie zdecydował się na użycie istniejącego konta `ubuntu` (ma sudo, ma dostęp do kontenerów sklepiku) zamiast tego — "sklepik to też eksperyment, nie przejmuj się". To jest realna, otwarta ekspozycja: proces na VM ma techniczną możliwość dotknięcia produkcyjnego sklepu, nawet jeśli w praktyce tego nie robi.
- **Tunel to Cloudflare Quick Tunnel (`cloudflared tunnel --url`), nie tunel nazwany/uwierzytelniony.** Szybkie do postawienia (zero konfiguracji konta), ale bez gwarancji uptime i bez własnego uwierzytelnienia na poziomie tunelu (bezpieczeństwo opiera się wyłącznie na `X-Auth-Token`). Adres zmienia się przy restarcie tunelu. Do zamiany na nazwany tunel przed poleganiem na tym na poważnie.
- **Brak automatycznego push na GitHub.** Plan zakładał, że `vm_claude_code` po skończeniu sam wypycha kod i wysyła link. W praktyce wynik wraca synchronicznie w odpowiedzi HTTP (działa dla zadań mieszczących się w limicie czasu wrappera, ~280s) — kod zostaje na dysku VM, nie trafia automatycznie do repo.
- **Brak asynchronicznego "zaczynam, dam znać":** to samo co wyżej — na razie tylko zadania mieszczące się w jednym request/response, nie ma jeszcze wzorca "odpowiedz od razu, dosłij wynik osobno" dla dłuższych zadań.

### Realistyczne oczekiwania (potwierdzone w praktyce)

- Nie jest to "jedno zdanie → gotowa aplikacja" bez nadzoru — pierwsze prawdziwe użycie wymagało dwóch poprawek błędów w samym Bolku (patrz "Corrections (2026-07-16)" w `docs/SYSTEM.md`), zanim przepływ zatwierdzania w ogóle zadziałał
- Wymaga osobnego `ANTHROPIC_API_KEY` na VM (osobny od tego w sekretach Cloudflare) — potwierdzone, że to nie konkuruje z limitem Pro/Max właściciela, bo to osobna, płatna z góry pula API

## Dlaczego to jest fajne (potwierdzone, nie tylko teoria)

Każde narzędzie dodane do rejestru Bolka pojawia się automatycznie w Telegramie, Claude Code i claude.ai — bo wszystkie trzy kanały czytają ten sam rejestr przez ten sam silnik polityk. `vm_claude_code` jest teraz kolejnym wpisem w tej samej liście, odblokowującym całą kategorię zadań (pisanie kodu, admin serwerów) zamiast pojedynczych API — i to nie jest już hipoteza, tylko coś co faktycznie przeszło przez cały przepływ od wiadomości na Telegramie do pliku na dysku.
