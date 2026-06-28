'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2, Users, Theater } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  pending?: boolean
}

const BOLEK_API = process.env.NEXT_PUBLIC_BOLEK_API_URL ?? 'http://localhost:8787'

export default function Page() {
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
    <div className="flex flex-col h-screen max-w-2xl mx-auto">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-4 border-b border-[#222]">
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
          <Bot size={16} />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">Agent Bolek</p>
          <p className="text-xs text-[#666]">osobisty asystent AI</p>
        </div>
        <Link href="/agents" className="flex items-center gap-1.5 text-xs text-[#666] hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-[#1a1a1a]">
          <Users size={14} />
          Agenci
        </Link>
        <Link href="/characters" className="flex items-center gap-1.5 text-xs text-[#666] hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-[#1a1a1a]">
          <Theater size={14} />
          Postacie
        </Link>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {messages.map((msg) => (
          <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}>
            <div
              className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                msg.role === 'assistant' ? 'bg-blue-600' : 'bg-[#333]'
              )}
            >
              {msg.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}
            </div>
            <div
              className={cn(
                'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                msg.role === 'assistant'
                  ? 'bg-[#1a1a1a] text-[#ededed]'
                  : 'bg-blue-600 text-white'
              )}
            >
              {msg.pending && !msg.content ? (
                <Loader2 size={14} className="animate-spin text-[#666]" />
              ) : (
                <span className="whitespace-pre-wrap">{msg.content}</span>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-[#222]">
        <div className="flex items-end gap-3 bg-[#1a1a1a] rounded-2xl px-4 py-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Napisz do Bolka..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-[#ededed] placeholder:text-[#555] resize-none outline-none max-h-32"
            style={{ lineHeight: '1.5' }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0 disabled:opacity-30 hover:bg-blue-500 transition-colors"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
        <p className="text-xs text-[#444] text-center mt-2">Enter — wyślij · Shift+Enter — nowa linia</p>
      </div>
    </div>
  )
}
