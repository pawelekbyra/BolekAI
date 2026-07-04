'use client'

import { useEffect, useRef, useState } from 'react'
import { Bot, Loader2, Send, Theater, User, Users } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  pending?: boolean
}

type CloneVariant = 't1' | 't2' | 't3'

type VariantConfig = {
  shell: string
  header: string
  assistantAvatar: string
  userAvatar: string
  assistantBubble: string
  userBubble: string
  inputWrap: string
  sendButton: string
  titleAccent: string
  linkHover: string
}

const BOLEK_API = process.env.NEXT_PUBLIC_BOLEK_API_URL ?? 'http://localhost:8787'

const VARIANTS: Record<CloneVariant, VariantConfig> = {
  t1: {
    shell: 'sketch-page sketch-page-paper',
    header: 'sketch-panel sketch-panel-paper',
    assistantAvatar: 'sketch-fill-blue text-white',
    userAvatar: 'sketch-fill-ink text-white',
    assistantBubble: 'sketch-bubble sketch-bubble-paper',
    userBubble: 'sketch-bubble sketch-bubble-blue text-white',
    inputWrap: 'sketch-input sketch-input-paper',
    sendButton: 'sketch-action sketch-fill-blue text-white',
    titleAccent: 'sketch-highlight-blue',
    linkHover: 'hover:bg-blue-100/70 hover:text-[#111]',
  },
  t2: {
    shell: 'sketch-page sketch-page-warm',
    header: 'sketch-panel sketch-panel-warm',
    assistantAvatar: 'sketch-fill-amber text-[#111]',
    userAvatar: 'sketch-fill-charcoal text-white',
    assistantBubble: 'sketch-bubble sketch-bubble-warm',
    userBubble: 'sketch-bubble sketch-bubble-charcoal text-white',
    inputWrap: 'sketch-input sketch-input-warm',
    sendButton: 'sketch-action sketch-fill-charcoal text-white',
    titleAccent: 'sketch-highlight-amber',
    linkHover: 'hover:bg-amber-100/80 hover:text-[#111]',
  },
  t3: {
    shell: 'sketch-page sketch-page-green',
    header: 'sketch-panel sketch-panel-green',
    assistantAvatar: 'sketch-fill-green text-white',
    userAvatar: 'sketch-fill-cream text-[#111]',
    assistantBubble: 'sketch-bubble sketch-bubble-green-soft',
    userBubble: 'sketch-bubble sketch-bubble-green text-white',
    inputWrap: 'sketch-input sketch-input-green',
    sendButton: 'sketch-action sketch-fill-green text-white',
    titleAccent: 'sketch-highlight-green',
    linkHover: 'hover:bg-emerald-100/80 hover:text-[#111]',
  },
}

export function PolutekClone({ variant }: { variant: CloneVariant }) {
  const cfg = VARIANTS[variant]
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: 'Hej, tu Bolek. Czym mogę Ci dziś pomóc?',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text }
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

      if (!res.body) throw new Error('No stream')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let reply = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter((l) => l.startsWith('data: '))

        for (const line of lines) {
          const data = line.slice(6)
          if (data === '[DONE]') break
          try {
            const { text } = JSON.parse(data)
            reply += text
            setMessages((prev) =>
              prev.map((m) => (m.id === 'pending' ? { ...m, content: reply } : m))
            )
          } catch {}
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === 'pending' ? { ...m, id: Date.now().toString(), pending: false } : m
        )
      )
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === 'pending'
            ? { ...m, id: Date.now().toString(), content: 'Błąd połączenia.', pending: false }
            : m
        )
      )
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <main className={cn('flex min-h-screen justify-center px-4 py-5 sm:px-6', cfg.shell)}>
      <div className="sketch-chat flex h-[calc(100vh-2.5rem)] w-full max-w-2xl flex-col">
        <header className={cn('flex items-center gap-3 px-5 py-4 sm:px-6', cfg.header)}>
          <div className={cn('sketch-avatar', cfg.assistantAvatar)}>
            <Bot size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="sketch-title text-sm font-black uppercase tracking-[0.16em]">
              Agent <span className={cfg.titleAccent}>Bolek</span>
            </p>
            <p className="sketch-caption text-xs">osobisty asystent AI</p>
          </div>
          <Link href="/agents" className={cn('sketch-nav-link', cfg.linkHover)}>
            <Users size={14} />
            Agenci
          </Link>
          <Link href="/characters" className={cn('sketch-nav-link', cfg.linkHover)}>
            <Theater size={14} />
            Postacie
          </Link>
        </header>

        <section className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
          {messages.map((msg) => (
            <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}>
              <div
                className={cn(
                  'sketch-avatar mt-0.5 flex-shrink-0',
                  msg.role === 'assistant' ? cfg.assistantAvatar : cfg.userAvatar
                )}
              >
                {msg.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}
              </div>
              <div
                className={cn(
                  'max-w-[80%] px-4 py-3 text-sm leading-relaxed',
                  msg.role === 'assistant' ? cfg.assistantBubble : cfg.userBubble
                )}
              >
                {msg.pending && !msg.content ? (
                  <Loader2 size={14} className="animate-spin opacity-70" />
                ) : (
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </section>

        <footer className="px-5 py-4 sm:px-6">
          <div className={cn('flex items-end gap-3 px-4 py-3', cfg.inputWrap)}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Napisz do Bolka..."
              rows={1}
              className="max-h-32 flex-1 resize-none bg-transparent text-sm leading-6 text-current outline-none placeholder:text-current/45"
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center disabled:opacity-30', cfg.sendButton)}
              aria-label="Wyślij wiadomość"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
          <p className="sketch-caption mt-2 text-center text-xs">Enter — wyślij · Shift+Enter — nowa linia</p>
        </footer>
      </div>
    </main>
  )
}
