'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowUp,
  Bot,
  CheckCircle2,
  Clock3,
  Cpu,
  Loader2,
  MessageSquareText,
  Sparkles,
  Theater,
  User,
  Users,
  WandSparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  pending?: boolean
}

const BOLEK_API = process.env.NEXT_PUBLIC_BOLEK_API_URL ?? 'http://localhost:8787'

const SUGGESTIONS = [
  'Zaplanuj mi najważniejsze zadania na dziś',
  'Zrób research i wypisz konkretne następne kroki',
  'Poproś agentów o burzę mózgów nad nowym projektem',
]

const CAPABILITIES = [
  { label: 'Streaming odpowiedzi', icon: MessageSquareText },
  { label: 'Pamięć i kontekst', icon: Cpu },
  { label: 'Agenci w tle', icon: Users },
]

export default function Page() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content:
        'Siema, tu Bolek — Twój prywatny operator AI. Daj mi cel, a rozbiję go na kroki, podepnę agentów i dowiozę konkrety.',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const hasConversation = messages.length > 1
  const wordCount = useMemo(
    () => messages.reduce((total, msg) => total + msg.content.trim().split(/\s+/).filter(Boolean).length, 0),
    [messages]
  )

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(textOverride?: string) {
    const text = (textOverride ?? input).trim()
    if (!text || loading) return

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text }
    const pendingMsg: Message = { id: 'pending', role: 'assistant', content: '', pending: true }

    setMessages((prev) => [...prev, userMsg, pendingMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch(`${BOLEK_API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      if (!res.body) throw new Error('No stream')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let reply = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') break
          try {
            const parsed = JSON.parse(data) as { text?: string }
            reply += parsed.text ?? ''
            setMessages((prev) =>
              prev.map((m) => (m.id === 'pending' ? { ...m, content: reply } : m))
            )
          } catch {
            // Ignore malformed stream chunks and keep reading.
          }
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === 'pending' ? { ...m, id: crypto.randomUUID(), pending: false } : m
        )
      )
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === 'pending'
            ? {
                ...m,
                id: crypto.randomUUID(),
                content: 'Nie złapałem połączenia z API. Sprawdź NEXT_PUBLIC_BOLEK_API_URL i spróbuj ponownie.',
                pending: false,
              }
            : m
        )
      )
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(0,112,243,0.32),transparent_28%),radial-gradient(circle_at_85%_0%,rgba(121,40,202,0.28),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_26%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="mb-4 flex items-center justify-between rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-3 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <Link href="/" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/15 bg-white text-black shadow-[0_0_40px_rgba(255,255,255,0.25)]">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">Agent Bolek</p>
              <p className="text-xs text-zinc-400">Vercel-ready AI command center</p>
            </div>
          </Link>
          <nav className="flex items-center gap-2">
            <NavLink href="/agents" icon={Users} label="Agenci" />
            <NavLink href="/characters" icon={Theater} label="Postacie" />
          </nav>
        </header>

        <section className="grid flex-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="hidden flex-col gap-4 lg:flex">
            <div className="rounded-[2rem] border border-white/10 bg-zinc-950/70 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.9)]" />
                Online · gotowy do akcji
              </div>
              <h1 className="text-4xl font-semibold leading-tight tracking-[-0.04em]">
                Chat, który wygląda jak produkt z Vercela.
              </h1>
              <p className="mt-4 text-sm leading-6 text-zinc-400">
                Ciemny, szybki, responsywny interfejs z glassmorphismem, streamingiem i panelem
                kontekstu — bez kombinowania, gotowy na build.
              </p>
              <div className="mt-6 grid gap-3">
                {CAPABILITIES.map(({ label, icon: Icon }) => (
                  <div key={label} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-200">
                    <Icon size={16} className="text-blue-300" />
                    {label}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Stat label="Wiadomości" value={messages.length.toString()} />
              <Stat label="Słowa" value={wordCount.toString()} />
            </div>
          </aside>

          <div className="flex min-h-[calc(100vh-112px)] flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/75 shadow-2xl shadow-black/50 backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="relative grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500">
                  <Bot size={20} />
                  <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-zinc-950 bg-emerald-400" />
                </div>
                <div>
                  <p className="font-semibold tracking-tight">Bolek Chat</p>
                  <p className="text-xs text-zinc-400">Model odpowiada strumieniowo przez API</p>
                </div>
              </div>
              <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400 sm:flex">
                <Clock3 size={13} /> Enter wysyła
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
              {!hasConversation && (
                <div className="mb-8 rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-5">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-200">
                    <WandSparkles size={16} className="text-violet-300" />
                    Szybki start
                  </div>
                  <div className="grid gap-2 md:grid-cols-3">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => send(suggestion)}
                        className="rounded-2xl border border-white/10 bg-black/20 p-3 text-left text-sm text-zinc-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-5">
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} message={msg} />
                ))}
                <div ref={bottomRef} />
              </div>
            </div>

            <div className="border-t border-white/10 bg-black/20 p-4 sm:p-6">
              <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-2 shadow-2xl shadow-black/30 transition focus-within:border-blue-400/50 focus-within:ring-4 focus-within:ring-blue-500/10">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Napisz do Bolka, np. 'zrób plan wdrożenia na Vercel'..."
                    rows={1}
                    className="max-h-36 min-h-12 flex-1 resize-none bg-transparent px-3 py-3 text-sm leading-6 text-zinc-100 outline-none placeholder:text-zinc-500"
                  />
                  <button
                    onClick={() => send()}
                    disabled={!input.trim() || loading}
                    className="mb-1 grid h-10 w-10 place-items-center rounded-2xl bg-white text-black transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label="Wyślij wiadomość"
                  >
                    {loading ? <Loader2 size={17} className="animate-spin" /> : <ArrowUp size={18} />}
                  </button>
                </div>
              </div>
              <p className="mt-3 flex items-center justify-center gap-2 text-center text-xs text-zinc-500">
                <CheckCircle2 size={13} /> Gotowe pod Vercel build · Tailwind + Next.js App Router
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function NavLink({ href, icon: Icon, label }: { href: string; icon: typeof Users; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
    >
      <Icon size={14} />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  )
}

function ChatMessage({ message }: { message: Message }) {
  const isAssistant = message.role === 'assistant'

  return (
    <article className={cn('flex gap-3', !isAssistant && 'flex-row-reverse')}>
      <div
        className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-2xl border shadow-lg',
          isAssistant
            ? 'border-blue-400/20 bg-blue-500/15 text-blue-100 shadow-blue-950/30'
            : 'border-white/10 bg-white text-black shadow-white/10'
        )}
      >
        {isAssistant ? <Bot size={17} /> : <User size={17} />}
      </div>
      <div
        className={cn(
          'max-w-[82%] rounded-[1.4rem] border px-4 py-3 text-sm leading-6 shadow-xl sm:max-w-[72%]',
          isAssistant
            ? 'border-white/10 bg-white/[0.06] text-zinc-100 shadow-black/20'
            : 'border-blue-400/30 bg-gradient-to-br from-blue-500 to-violet-500 text-white shadow-blue-950/40'
        )}
      >
        {message.pending && !message.content ? (
          <div className="flex items-center gap-2 text-zinc-400">
            <Loader2 size={15} className="animate-spin" />
            Bolek myśli...
          </div>
        ) : (
          <span className="whitespace-pre-wrap">{message.content}</span>
        )}
      </div>
    </article>
  )
}
