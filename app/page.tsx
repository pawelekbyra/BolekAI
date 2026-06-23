'use client';

import { useChat } from '@ai-sdk/react';
import { useMemo, useState } from 'react';
import { TOOLS_REQUIRING_APPROVAL } from '@/lib/tools';

export default function Home() {
  const [input, setInput] = useState('');
  const { messages, input: chatInput, setInput: setChatInput, handleSubmit, status, error, addToolResult } = useChat() as any;

  const isBusy = status === 'submitted' || status === 'streaming';

  const suggestions = useMemo(
    () => [
      'Sprawdź informacje o repozytorium.',
      'Wypisz otwarte issue.',
      'Utwórz issue dla Julesa: dodaj tryb ciemny i panel ustawień.',
      'Pokaż ostatnie deploymenty Vercel.',
    ],
    []
  );

  return (
    <main className="shell">
      <section className="hero">
        <div className="badge">Kulfon Agent · Gemini · GitHub · Vercel · Jules</div>
        <h1>Twój prywatny agent developerski</h1>
        <p>
          Czysty starter gotowy pod Google AI Studio. Podłącz tokeny, rozmawiaj z agentem i pozwól mu
          tworzyć dobrze opisane zadania dla Julesa.
        </p>
      </section>

      <section className="chat-panel" aria-label="Chat z agentem">
        <div className="messages">
          {messages.length === 0 ? (
            <div className="empty-state">
              <div className="orb" />
              <h2>Od czego zaczynamy?</h2>
              <p>Zapytaj o repo, deploymenty albo poproś o przygotowanie zadania dla Julesa.</p>
              <div className="suggestions">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setInput(suggestion)}
                    className="suggestion"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            (messages as any[]).map((message) => (
              <article key={message.id} className={`message ${message.role}`}>
                <div className="avatar">{message.role === 'user' ? 'Ty' : 'AI'}</div>
                <div className="bubble">
                  {message.content && <div className="message-text">{message.content}</div>}

                  {message.toolInvocations?.map((toolInvocation: any) => {
                    const { toolName, toolCallId, state } = toolInvocation;
                    const requiresApproval = TOOLS_REQUIRING_APPROVAL.includes(toolName);

                    if (state === 'call') {
                      return (
                        <div key={toolCallId} className="tool-card">
                          <div className="tool-header">Wywołanie narzędzia: {toolName}</div>
                          <pre>{JSON.stringify(toolInvocation.args, null, 2)}</pre>
                          {requiresApproval && (
                            <div className="approval-actions">
                              <p>To działanie wymaga Twojego potwierdzenia.</p>
                              <button
                                onClick={() => addToolResult({ toolCallId, output: 'Confirmed by user' })}
                                className="approve-btn"
                              >
                                Potwierdź
                              </button>
                              <button
                                onClick={() => addToolResult({ toolCallId, output: 'Cancelled by user' })}
                                className="deny-btn"
                              >
                                Anuluj
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    }

                    return (
                      <details key={toolCallId} className="tool-card">
                        <summary>Wynik narzędzia: {toolName}</summary>
                        <pre>{JSON.stringify('result' in toolInvocation ? toolInvocation.result : toolInvocation.output, null, 2)}</pre>
                      </details>
                    );
                  })}
                </div>
              </article>
            ))
          )}

          {isBusy && <div className="status">Agent pracuje…</div>}
          {error && <div className="error">Błąd: {error.message}</div>}
        </div>

        <form
          className="composer"
          onSubmit={(event) => {
            event.preventDefault();
            if (!input.trim() || isBusy) return;
            setChatInput(input);
            handleSubmit(event, { body: {} });
            setInput('');
          }}
        >
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Napisz, co agent ma zrobić…"
            rows={3}
          />
          <button type="submit" disabled={isBusy || !input.trim()}>
            Wyślij
          </button>
        </form>
      </section>
    </main>
  );
}
