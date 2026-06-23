'use client';

import { useChat } from '@ai-sdk/react';
import { useMemo, useState } from 'react';

import { executeApprovedTool } from '@/lib/actions';
import { TOOLS_REQUIRING_APPROVAL } from '@/lib/approval';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';

const navItems = ['Command Center', 'Decyzje', 'Narzędzia', 'Roadmapa'];

const statusCards = [
  {
    label: 'Tryb',
    value: 'Operator',
    detail: 'Chat, narzędzia i approval flow',
  },
  {
    label: 'Stack',
    value: 'Gemini + Vercel AI SDK',
    detail: 'Bez zmian w runtime',
  },
  {
    label: 'Kontrola',
    value: 'Approval aktywny',
    detail: 'Akcje zapisujące czekają na zgodę',
  },
];

export default function Home() {
  const [input, setInput] = useState('');
  const {
    messages,
    setInput: setChatInput,
    handleSubmit,
    status,
    error,
    addToolResult,
  } = useChat({
    maxSteps: 5,
  } as any) as any;

  const isBusy = status === 'submitted' || status === 'streaming';

  const suggestions = useMemo(
    () => [
      {
        title: 'Stan repo',
        prompt: 'Sprawdź informacje o repozytorium.',
        description: 'Szybki odczyt konfiguracji projektu.',
      },
      {
        title: 'Otwarte issue',
        prompt: 'Wypisz otwarte issue.',
        description: 'Zobacz, co czeka w backlogu.',
      },
      {
        title: 'Zadanie dla Julesa',
        prompt: 'Utwórz issue dla Julesa: dodaj Decision Inbox jako panel boczny.',
        description: 'Akcja zewnętrzna z approval.',
      },
      {
        title: 'Deploymenty',
        prompt: 'Pokaż ostatnie deploymenty Vercel.',
        description: 'Status produkcji i preview.',
      },
    ],
    [],
  );

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-4 text-foreground sm:px-6 lg:px-8">
      <div className="command-grid pointer-events-none absolute inset-0 opacity-70" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />

      <div className="relative mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-[1500px] grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)_340px]">
        <aside className="rounded-[2rem] border border-border/70 bg-card/70 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-lg font-black text-primary-foreground shadow-[0_0_42px_rgba(139,92,246,0.5)]">
              K
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Kulfon OS</p>
              <h1 className="text-xl font-bold tracking-tight">Centrum dowodzenia</h1>
            </div>
          </div>

          <Separator className="my-5" />

          <nav className="space-y-2" aria-label="Nawigacja Kulfona">
            {navItems.map((item, index) => (
              <button
                key={item}
                type="button"
                className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm transition ${
                  index === 0
                    ? 'bg-white/10 text-foreground shadow-inner shadow-white/5'
                    : 'text-muted-foreground hover:bg-white/8 hover:text-foreground'
                }`}
              >
                <span>{item}</span>
                {index === 1 ? <Badge variant="warning">0</Badge> : null}
              </button>
            ))}
          </nav>

          <div className="mt-6 rounded-3xl border border-border/70 bg-background/45 p-4">
            <Badge variant="success">Sprint 2</Badge>
            <h2 className="mt-3 text-base font-semibold">UI foundation</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              shadcn-style komponenty, dark command center i miejsce pod przyszły Decision Inbox.
            </p>
          </div>
        </aside>

        <section className="flex min-h-[720px] flex-col overflow-hidden rounded-[2rem] border border-border/70 bg-card/80 shadow-2xl shadow-black/40 backdrop-blur-xl" aria-label="Chat z agentem">
          <div className="border-b border-border/70 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Kulfon Agent</Badge>
                  <Badge variant="outline">Gemini</Badge>
                  <Badge variant="outline">GitHub</Badge>
                  <Badge variant="outline">Vercel</Badge>
                  <Badge variant="outline">Jules</Badge>
                </div>
                <h2 className="mt-4 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
                  Co dzisiaj przejmujemy?
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Rozmawiaj z agentem, sprawdzaj repo i przygotowuj akcje. Działania zapisujące nadal wymagają Twojej zgody.
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/50 px-4 py-3 text-sm text-muted-foreground">
                Status: <span className="font-semibold text-foreground">{isBusy ? 'pracuje' : 'gotowy'}</span>
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="min-h-[460px] p-5">
              {messages.length === 0 ? (
                <div className="grid min-h-[460px] place-items-center">
                  <div className="w-full max-w-3xl text-center">
                    <div className="mx-auto grid h-24 w-24 place-items-center rounded-[2rem] bg-gradient-to-br from-primary to-cyan-400 text-4xl font-black text-white shadow-[0_0_90px_rgba(139,92,246,0.6)]">
                      K
                    </div>
                    <h3 className="mt-6 text-3xl font-black tracking-[-0.04em]">Od czego zaczynamy?</h3>
                    <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                      Wybierz szybki prompt albo wpisz własne polecenie. Kulfon przygotuje plan, użyje narzędzi i zatrzyma ryzykowne akcje do approval.
                    </p>

                    <div className="mt-8 grid gap-3 sm:grid-cols-2">
                      {suggestions.map((suggestion) => (
                        <button
                          key={suggestion.prompt}
                          type="button"
                          onClick={() => setInput(suggestion.prompt)}
                          className="rounded-3xl border border-border/70 bg-background/45 p-4 text-left transition hover:border-primary/60 hover:bg-primary/10"
                        >
                          <span className="text-sm font-semibold text-foreground">{suggestion.title}</span>
                          <span className="mt-1 block text-xs leading-5 text-muted-foreground">{suggestion.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {(messages as any[]).map((message) => {
                    const isUser = message.role === 'user';

                    return (
                      <article key={message.id} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                        {!isUser ? (
                          <div className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-xs font-bold">
                            AI
                          </div>
                        ) : null}

                        <div
                          className={`max-w-[min(760px,88%)] rounded-3xl border px-5 py-4 text-sm leading-6 shadow-lg ${
                            isUser
                              ? 'border-primary/30 bg-primary/80 text-primary-foreground shadow-primary/20'
                              : 'border-border/70 bg-background/55 text-foreground shadow-black/20'
                          }`}
                        >
                          {message.content ? <div className="whitespace-pre-wrap">{message.content}</div> : null}

                          {message.toolInvocations?.map((toolInvocation: any) => {
                            const { toolName, toolCallId, state } = toolInvocation;
                            const requiresApproval = TOOLS_REQUIRING_APPROVAL.includes(toolName);

                            if (state === 'call') {
                              return (
                                <Card key={toolCallId} className="mt-4 border-primary/30 bg-primary/8">
                                  <CardHeader className="pb-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <CardTitle className="text-base">Wywołanie narzędzia</CardTitle>
                                      <Badge variant={requiresApproval ? 'warning' : 'outline'}>
                                        {requiresApproval ? 'wymaga zgody' : 'read'}
                                      </Badge>
                                    </div>
                                    <CardDescription>{toolName}</CardDescription>
                                  </CardHeader>
                                  <CardContent>
                                    <pre className="max-h-64 overflow-auto rounded-2xl border border-border/70 bg-black/30 p-3 text-xs text-muted-foreground">
                                      {JSON.stringify(toolInvocation.args, null, 2)}
                                    </pre>

                                    {requiresApproval ? (
                                      <div className="mt-4 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4">
                                        <p className="text-sm font-medium text-amber-100">
                                          To działanie ma skutek zewnętrzny i wymaga Twojego potwierdzenia.
                                        </p>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                          <Button
                                            type="button"
                                            size="sm"
                                            onClick={async () => {
                                              try {
                                                const result = await executeApprovedTool(toolName, toolInvocation.args);
                                                addToolResult({ toolCallId, result });
                                              } catch (err: any) {
                                                addToolResult({ toolCallId, result: { error: err.message } });
                                              }
                                            }}
                                          >
                                            Potwierdź
                                          </Button>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => addToolResult({ toolCallId, result: 'Anulowano przez użytkownika' })}
                                          >
                                            Anuluj
                                          </Button>
                                        </div>
                                      </div>
                                    ) : null}
                                  </CardContent>
                                </Card>
                              );
                            }

                            return (
                              <details key={toolCallId} className="mt-4 rounded-2xl border border-border/70 bg-black/20 p-4">
                                <summary className="cursor-pointer text-sm font-semibold text-primary">
                                  Wynik narzędzia: {toolName}
                                </summary>
                                <pre className="mt-3 max-h-64 overflow-auto rounded-2xl bg-black/30 p-3 text-xs text-muted-foreground">
                                  {JSON.stringify(toolInvocation.result, null, 2)}
                                </pre>
                              </details>
                            );
                          })}
                        </div>

                        {isUser ? (
                          <div className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary text-xs font-bold text-primary-foreground">
                            Ty
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}

              {isBusy ? <div className="mt-5 text-sm text-muted-foreground">Agent pracuje…</div> : null}
              {error ? <div className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">Błąd: {error.message}</div> : null}
            </div>
          </ScrollArea>

          <form
            className="border-t border-border/70 bg-black/20 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!input.trim() || isBusy) return;
              setChatInput(input);
              handleSubmit(event, { body: {} });
              setInput('');
            }}
          >
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Napisz, co Kulfon ma zrobić…"
                rows={3}
              />
              <Button type="submit" disabled={isBusy || !input.trim()} className="h-full min-h-[88px] sm:w-32">
                Wyślij
              </Button>
            </div>
          </form>
        </section>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Decision Inbox</CardTitle>
                  <CardDescription>Przyszłe centrum zgód i akcji do zatwierdzenia.</CardDescription>
                </div>
                <Badge variant="warning">MVP</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl border border-border/70 bg-background/45 p-4">
                <p className="text-sm font-semibold">Brak oczekujących decyzji</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Gdy agent będzie chciał wykonać akcję zewnętrzną, karta approval pojawi się tutaj.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {statusCards.map((card) => (
              <Card key={card.label}>
                <CardHeader className="pb-3">
                  <CardDescription>{card.label}</CardDescription>
                  <CardTitle>{card.value}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-muted-foreground">{card.detail}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Narzędzia aktywne</CardTitle>
              <CardDescription>Obecny zakres bez zmian w runtime.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Badge variant="outline">GitHub</Badge>
              <Badge variant="outline">Vercel</Badge>
              <Badge variant="outline">Jules</Badge>
              <Badge variant="outline">Approval</Badge>
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}
