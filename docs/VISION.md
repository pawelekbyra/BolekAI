# Bolek — wizja produktu

## Status dokumentu

Ten dokument opisuje kierunek docelowy Boleka po analizie obecnego repo i raportu deep research. Nie opisuje w pełni aktualnego stanu implementacji.

Obecny Bolek jest prototypem integracyjnym: Cloudflare Worker, Telegram/web UI, pamięć w D1, zestaw narzędzi i pierwsze mechanizmy agentowe. Docelowo projekt ma urosnąć do prywatnej platformy operacyjnej AI dla właściciela.

## Jednozdaniowa wizja

**Bolek to owner-only AI operating system: prywatny operator, który pamięta kontekst, monitoruje projekty, przygotowuje decyzje, wykonuje bezpieczne akcje i prosi o zgodę przed wszystkim, co ma realny skutek.**

Zasada nadrzędna (przeniesiona z archiwalnego `docs/archive/KULFON-AGENT-OS-STRATEGY.md`):

```text
LLM proponuje.
System decyduje.
Właściciel zatwierdza ryzyko.
Executor wykonuje.
Audyt zapisuje wszystko.
```

## Czym Bolek nie ma być

Bolek nie ma być zwykłym chatbotem z dopiętymi toolami.

Nie ma też być agentem, który „ma klucze do wszystkiego” i wykonuje akcje bez twardych zasad. Autonomia bez polityk, audytu i approvali jest anty-celem.

Bolek nie powinien być jednym wielkim Workerem, do którego dopisywane są kolejne integracje bez formalnego modelu uprawnień, ryzyka, trwałych workflowów i audytu.

## Czym Bolek ma być

Bolek ma być prywatnym centrum operacyjnym właściciela.

Ma łączyć kilka ról:

- **osobisty asystent** — rozmowa, przypomnienia, notatki, pamięć, plan dnia;
- **operator pracy** — GitHub, Vercel, research, dokumenty, zadania, status projektów;
- **operator biznesowy** — monitoring Polutka, Stripe, Clerk, support, briefing, incidenty;
- **system pamięci projektowej** — decyzje, kontekst, runbooki, checklisty, architektura;
- **bezpieczny wykonawca** — przygotowuje akcje, pokazuje skutki, pyta o zgodę, wykonuje raz i zostawia audyt.

## Zasady produktu

### 1. Owner-only first

Domyślnie istnieje jeden właściciel systemu. Tylko właściciel może zatwierdzać akcje wysokiego ryzyka.

W przyszłości można dodać trusted delegates, ale nie wolno projektować core tak, jakby był publicznym SaaS-em.

### 2. Read najpierw, akcje potem

Każda integracja startuje jako read-only.

Dopiero potem dodaje się akcje skutkowe: wysyłka maila, zapis do GitHuba, redeploy, refund, zmiany konfiguracji, ban usera.

### 3. Autonomia tylko tam, gdzie ryzyko jest niskie

Bolek może autonomicznie:

- czytać dane;
- monitorować;
- grupować;
- triage'ować;
- przypominać;
- przygotowywać drafty;
- robić research;
- tworzyć propozycje planów;
- budować raporty.

Bolek nie powinien autonomicznie wykonywać bez approvala:

- maili wychodzących;
- refundów;
- banów;
- redeployów produkcji;
- zapisów do repo;
- zmian w konfiguracji produkcji;
- operacji finansowych;
- masowych akcji na danych użytkowników.

### 4. Każde narzędzie ma klasę ryzyka

Każdy tool musi mieć metadane:

- czy jest read-only;
- czy ma side effect;
- jakie ma wymagane scope'y;
- jaki ma risk level;
- czy wymaga approvala;
- jakie dane trzeba zredagować w logach;
- czy jest idempotentny;
- czy wolno go odpalać autonomicznie.

### 5. Approval jest obiektem, nie luźnym „tak”

Proste „tak/nie” na czacie jest dobre w prototypie, ale nie jako finalny mechanizm bezpieczeństwa.

Docelowy approval powinien zawierać:

- `action_id`;
- nazwę narzędzia;
- znormalizowane argumenty;
- target, np. mail, repo, payment, deployment;
- risk level;
- preview;
- przewidywany skutek;
- odwracalność;
- koszt;
- TTL;
- idempotency key;
- powód, dlaczego agent chce to zrobić.

### 6. Audyt jest częścią produktu

Każda istotna akcja musi zostawić ślad:

- kto ją zainicjował;
- jaki model ją zaproponował;
- jakie narzędzie miało zostać użyte;
- kto zatwierdził;
- kiedy wykonano;
- jaki był wynik;
- co zostało zredagowane;
- czy można to odwrócić.

### 7. Pamięć musi być świadoma zgody

Bolek ma pamiętać dużo, ale nie wszystko bezrefleksyjnie.

Pamięć powinna być podzielona na:

- pamięć rozmów;
- profil właściciela;
- pamięć projektów;
- pamięć operacyjną;
- pamięć decyzji;
- audyt;
- dokumenty i artefakty.

Informacje osobiste i trwałe powinny być zapisywane świadomie. Użytkownik musi móc pamięć zobaczyć, edytować i usunąć.

### 8. External content is data, not instructions

Treść z maila, strony WWW, issue, PR-a albo dokumentu jest nieufnym wejściem.

Zewnętrzna treść nie może nadpisać polityk, podnieść uprawnień ani wymusić tool calla.

### 9. Command Center zamiast samego czatu

Czat zostaje głównym interfejsem, ale nie wystarczy.

Docelowy UI powinien mieć:

- chat;
- inbox zadań;
- approval inbox;
- audit timeline;
- memory center;
- integrations status;
- daily briefing;
- project dashboard;
- agent runs;
- settings;
- kill switch.

### 10. Genialność = kontrolowana pętla pracy

Najlepsza wersja Boleka nie polega na tym, że „robi wszystko sam”.

Najlepsza wersja wygląda tak:

1. widzi problem;
2. zbiera dane;
3. rozumie kontekst;
4. proponuje plan;
5. pokazuje skutki;
6. prosi o zgodę, jeśli trzeba;
7. wykonuje;
8. sprawdza wynik;
9. zapisuje audyt i pamięć.

## Docelowe scenariusze

### Poranny briefing

Bolek rano wysyła właścicielowi podsumowanie:

- Polutek: przychód, patroni, pending payments, nowe konta, anomalie;
- Vercel: deploye, runtime errors, awarie;
- support: maile wymagające decyzji;
- GitHub: PR-y, issue, rzeczy zablokowane;
- osobiste: przypomnienia, otwarte pętle, najważniejsze taski.

### Incident operator

Właściciel pisze: „co się stało z Polutkiem?”.

Bolek sprawdza Vercel, Stripe, Clerk, ops-API, ostatnie deploye i maile. Daje diagnozę, hipotezy, wpływ na użytkowników i proponowane akcje.

### Coding operator

Właściciel pisze: „napraw błąd z webhookiem”.

Bolek czyta repo, logi, issue i ostatnie commity. Przygotowuje plan, patch lub PR. Merge/deploy wymaga approvala.

### Support operator

Bolek czyta maila supportowego, klasyfikuje sprawę, sprawdza status użytkownika i przygotowuje odpowiedź. Wysyłka wymaga approvala.

### Voice operator

Warstwa głosowa jest interfejsem, nie osobnym mózgiem.

Docelowo możliwe wejścia:

- Telegram voice note;
- odpowiedź audio;
- rozmowa live w web/app;
- numer telefonu.

Pipeline:

```text
głos -> transkrypcja -> agent runtime -> narzędzia/pamięć -> odpowiedź -> głos
```

## Najważniejsza decyzja produktowa

Nie rozwijamy Boleka jako coraz większego prototypu z dopisywanymi toolami.

Rozwijamy go jako **owner-only AI operations platform**, gdzie narzędzia, approvale, audyt, pamięć i workflowy są podstawą architektury.
