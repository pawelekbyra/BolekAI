'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type Character = {
  name: string
  emoji: string
  personality: string
  status: 'idle' | 'talking'
  updated_at: string
}

type Message = {
  from_char: string
  message: string
  topic: string | null
  created_at: string
}

const CHAR_COLORS: Record<string, string> = {
  Marek: 'border-slate-600 bg-slate-900',
  Asia:  'border-purple-600 bg-purple-950',
  Stary: 'border-amber-600 bg-amber-950',
  Zofia: 'border-teal-600 bg-teal-950',
}

const MSG_COLORS: Record<string, string> = {
  Marek: 'bg-slate-800 border-slate-700',
  Asia:  'bg-purple-900 border-purple-800',
  Stary: 'bg-amber-900 border-amber-800',
  Zofia: 'bg-teal-900 border-teal-800',
}

const BOLEK_API = process.env.NEXT_PUBLIC_BOLEK_API_URL ?? 'http://localhost:8787'

export default function CharactersPage() {
  const [characters, setCharacters] = useState<Character[]>([])
  const [messages, setMessages]     = useState<Message[]>([])

  async function fetchData() {
    const [c, m] = await Promise.all([
      fetch(`${BOLEK_API}/api/characters`).then((r) => r.json()),
      fetch(`${BOLEK_API}/api/characters/messages`).then((r) => r.json()),
    ])
    setCharacters(c)
    setMessages(m)
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/" className="text-[#666] hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-semibold">Postacie</h1>
          <p className="text-sm text-[#666]">Agenci z osobowościami · odświeżanie co 3s</p>
        </div>
      </div>

      {/* Character cards */}
      <div className="grid grid-cols-2 gap-4 mb-10">
        {characters.map((char) => (
          <div
            key={char.name}
            className={cn(
              'rounded-2xl p-5 border transition-all duration-500',
              CHAR_COLORS[char.name] ?? 'border-zinc-700 bg-zinc-900',
              char.status === 'talking' && 'ring-2 ring-white/20 scale-[1.02]'
            )}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className={cn('text-3xl', char.status === 'talking' && 'animate-bounce')}>
                {char.emoji}
              </span>
              <div>
                <p className="font-bold">{char.name}</p>
                <p className="text-xs text-[#888]">
                  {char.status === 'talking' ? '💬 mówi...' : '💤 czeka'}
                </p>
              </div>
            </div>
            <p className="text-xs text-[#999]">{char.personality}</p>
          </div>
        ))}
      </div>

      {/* Live feed */}
      <h2 className="text-sm font-semibold text-[#666] uppercase tracking-wider mb-4">
        Ostatnie wypowiedzi
      </h2>

      <div className="space-y-3">
        {messages.length === 0 && (
          <p className="text-[#555] text-sm text-center py-8">
            Cisza. Powiedz Bolkowi żeby zorganizował debatę.
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              'rounded-xl p-4 border',
              MSG_COLORS[msg.from_char] ?? 'bg-[#111] border-[#222]'
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold text-sm">{msg.from_char}</span>
              {msg.topic && (
                <span className="text-xs text-[#666] bg-black/30 px-2 py-0.5 rounded-full">
                  {msg.topic.slice(0, 40)}
                </span>
              )}
              <span className="text-xs text-[#555] ml-auto">
                {new Date(msg.created_at).toLocaleTimeString('pl-PL')}
              </span>
            </div>
            <p className="text-sm text-[#ccc] leading-relaxed">{msg.message}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
