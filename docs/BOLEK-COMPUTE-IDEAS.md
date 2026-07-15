# Bolek dostaje komputer — pomysły z sesji 2026-07-15

## Status dokumentu

Notatka z brainstormu, nie specyfikacja gotowa do wdrożenia. Część rzeczy poniżej jest **już zbudowana i wdrożona**, część to **pomysły do zrobienia**. Oznaczenia jak w `ROADMAP.md`.

Kontekst: Bolek żyje na Cloudflare Workers — szybkie, tanie, ale sandboxowane (brak trwałego dysku, brak procesów, brak SSH). Ta sesja szukała odpowiedzi na pytanie "jak dać Bolkowi realną moc wykonawczą, nie tracąc bezpieczeństwa, które już ma".

## [✓ ZBUDOWANE] Bolek jako serwer MCP

Cały istniejący rejestr narzędzi Bolka (`src/tools/index.ts`) jest wystawiony jako serwer MCP (`src/mcp.ts`, Streamable HTTP na Fetch API, bez Express/Node bridge) pod:

- `POST /mcp` — auth przez nagłówek `Authorization: Bearer BOLEK_API_KEY` (Claude Code: `claude mcp add --transport http`)
- `POST /mcp/:secret` — auth przez sekret w ścieżce URL, dla klientów bez pola na własne nagłówki (claude.ai custom connector)

Efekt: Claude Code (lokalnie) i claude.ai (przeglądarka) mogą wołać narzędzia Bolka wprost — pobierać dane (Vercel, Stripe, Polutek) albo zlecać zadania (`task_add`, `note_save`) — bez przechodzenia przez Telegram. Wszystkie wywołania idą przez ten sam silnik polityk co zawsze: `executeTool()`, `decideToolPolicy()`, `/approve` na Telegramie dla ryzykownych akcji.

To zamyka pętlę: **Ty ↔ Bolek ↔ Claude (Telegram, Claude Code, claude.ai)** — jedna pamięć (D1), jeden rejestr narzędzi, trzy wejścia.

## [✓ ZBUDOWANE] Raport odwiedzin Polutka

Codziennie o 9:00 czasu warszawskiego (`src/visits-report.ts`, z automatycznym uwzględnieniem DST przez `Intl.DateTimeFormat`) Bolek liczy wczorajszy dzień kalendarzowy z Vercel Web Analytics (`vercel_get_pageviews` tool, `/v1/query/web-analytics/visits/count`) i wysyła podsumowanie na Telegram.

## [- POMYSŁ] Bolek dostaje własny komputer — zdalny Claude Code

**To jest ten zajebisty pomysł.** Zamiast dorzucać Bolkowi pojedyncze narzędzia jedno po drugim (jak dziś: Vercel, Stripe, GitHub...), dajemy mu dostęp do **pełnego agenta kodującego** na zawsze-włączonej maszynie — czyli realnie tę samą moc, jaką ma teraz Claude Code w tej sesji, tylko wywoływaną z Telegrama.

### Architektura (zaplanowana, nie wdrożona)

1. **Maszyna**: Oracle Cloud Free Tier VM (`141.253.103.172`, 2 vCPU, 11GB RAM, Ubuntu 22.04) — już istnieje, ale współdzielona z żywym sklepem produkcyjnym (`sklepik`: Rails/Puma + Sidekiq + Postgres + Redis + nginx w Dockerze, z backupami i watchdogiem na cronie)
2. **Izolacja** — Bolek NIE dostaje konta `ubuntu` (ma sudo, dostęp do kontenerów sklepiku). Osobny user systemowy bez sudo, bez dostępu do `~/sklepik`, ewentualnie osobny kontener Docker bez sieci do reszty
3. **Silnik**: Node.js + Claude Code CLI w trybie **headless/print** (`claude -p "prompt" --output-format json`), nie live-session-hijacking przez tmux (to było pierwotne złe podejście — kruche, brak sposobu na ominięcie promptów o zgodę)
4. **Ciągłość rozmowy**: `--resume <session-id>`, Bolek trzyma session ID w D1 tak jak dziś trzyma historię czatu
5. **Ekspozycja**: mały serwer HTTP na VM (nowy user) → Cloudflare Tunnel → Bolek woła go zwykłym `fetch()`. Brak SSH-z-Workera (Workers nie mają pełnego klienta SSH), brak otwierania portów na Oracle firewallu
6. **Nowe narzędzie**: `vm_claude_code` w rejestrze Bolka, wołające tunel
7. **Asynchroniczność**: pisanie appki trwa minuty, nie sekundy — Bolek musi odpowiedzieć od razu ("zaczynam") i dosłać wynik osobnym komunikatem, nie blokować na jednej odpowiedzi Telegrama
8. **Dostarczenie wyniku**: `vm_claude_code` po skończeniu pushuje kod na GitHub (Bolek ma już `github_*` tools) i wysyła link — nie zostawiać kodu tylko na dysku serwera

### ⚠️ Świadomy kompromis bezpieczeństwa

Zdecydowano (2026-07-15, decyzja właściciela): uruchamiać `claude -p` z **`--dangerously-skip-permissions`**, czyli bez pytania o zgodę na żadną komendę.

To stoi w bezpośrednim napięciu z zasadą nadrzędną z `ROADMAP.md`: *"Najpierw bezpieczeństwo, policy, approvale i audyt. Dopiero potem większa autonomia."* Cały dotychczasowy Bolek (`decideToolPolicy`, `/approve`, audit log) filtruje ryzykowne akcje pojedynczo, po nazwie narzędzia i argumentach. `vm_claude_code` z pominiętymi uprawnieniami to **jedna wielka dziura w tym modelu** — cokolwiek zostanie poproszone, wykona się w całości, bez żadnej bramki pośredniej.

Mitygacja przyjęta na start: **izolacja maszynowa** (osobny user/kontener bez dostępu do sklepiku) zamiast izolacji na poziomie komend. Jeśli to się rozrośnie poza eksperyment, warto wrócić do wariantu z allowlistą w `settings.json` Claude Code zamiast pełnego `--dangerously-skip-permissions`.

### Realistyczne oczekiwania

- To nie jest "jedno zdanie → gotowa aplikacja". Działa iteracyjnie, tak jak zwykła sesja Claude Code — pierwsza wersja, potem doprecyzowania przez kolejne wiadomości na tej samej `--resume` sesji
- Wymaga osobnego `ANTHROPIC_API_KEY` (nie da się odczytać tego już zapisanego jako sekret Cloudflare — sekrety `wrangler secret` są jednokierunkowe)

## Dlaczego to jest fajne (podsumowanie)

Każde narzędzie dodane do rejestru Bolka pojawia się automatycznie w Telegramie, Claude Code i claude.ai — bo wszystkie trzy kanały czytają ten sam rejestr przez ten sam silnik polityk. `vm_claude_code` byłby tylko kolejnym wpisem w tej samej liście, ale odblokowującym całą kategorię zadań (pisanie kodu, admin serwerów) zamiast pojedynczych API. Jedna zmiana w jednym miejscu, korzyść w trzech miejscach naraz.
