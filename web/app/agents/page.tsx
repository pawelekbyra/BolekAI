'use client'

import { useEffect, useState } from 'react'
import { Bot, Clock, CheckCircle, XCircle, Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type Agent = {
  name: string
  role: string
  status: 'idle' | 'working' | 'error'
  current_task: string | null
  updated_at: string
}

type Task = {
  agent_name: string
  task: string
  status: 'pending' | 'running' | 'done' | 'failed'
  result: string | null
  created_at: string
  done_at: string | null
}

const BOLEK_API = process.env.NEXT_PUBLIC_BOLEK_API_URL ?? 'http://localhost:8787'

const STATUS_CONFIG = {
  idle:    { label: 'Czeka',   color: 'bg-zinc-700',   dot: 'bg-zinc-400' },
  working: { label: 'Pracuje', color: 'bg-blue-900',   dot: 'bg-blue-400 animate-pulse' },
  error:   { label: 'Błąd',   color: 'bg-red-900',    dot: 'bg-red-400' },
}

const AGENT_EMOJI: Record<string, string> = {
  Mailer:     '✉️',
  Researcher: '🔍',
  Coder:      '💻',
  Analyst:    '📊',
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [tasks, setTasks]   = useState<Task[]>([])

  async function fetchData() {
    const [a, t] = await Promise.all([
      fetch(`${BOLEK_API}/api/agents`).then((r) => r.json()),
      fetch(`${BOLEK_API}/api/agents/tasks`).then((r) => r.json()),
    ])
    setAgents(a)
    setTasks(t)
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/" className="text-[#666] hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-semibold">Biuro agentów</h1>
          <p className="text-sm text-[#666]">Odświeżanie co 5 sekund</p>
        </div>
      </div>

      {/* Agent cards */}
      <div className="grid grid-cols-2 gap-4 mb-10">
        {agents.map((agent) => {
          const cfg = STATUS_CONFIG[agent.status] ?? STATUS_CONFIG.idle
          return (
            <div key={agent.name} className={cn('rounded-2xl p-5 border border-[#222]', cfg.color)}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{AGENT_EMOJI[agent.name] ?? '🤖'}</span>
                  <div>
                    <p className="font-semibold text-sm">{agent.name}</p>
                    <p className="text-xs text-[#888]">{agent.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={cn('w-2 h-2 rounded-full', cfg.dot)} />
                  <span className="text-xs text-[#888]">{cfg.label}</span>
                </div>
              </div>
              {agent.current_task && (
                <p className="text-xs text-[#aaa] bg-black/20 rounded-lg px-3 py-2 line-clamp-2">
                  {agent.current_task}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Task history */}
      <h2 className="text-sm font-semibold text-[#666] uppercase tracking-wider mb-4">
        Historia zadań
      </h2>

      <div className="space-y-3">
        {tasks.length === 0 && (
          <p className="text-[#555] text-sm text-center py-8">Brak zadań. Daj agentom coś do roboty.</p>
        )}
        {tasks.map((task, i) => (
          <div key={i} className="bg-[#111] rounded-xl p-4 border border-[#1e1e1e]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span>{AGENT_EMOJI[task.agent_name] ?? '🤖'}</span>
                <span className="text-sm font-medium">{task.agent_name}</span>
                <TaskStatusBadge status={task.status} />
              </div>
              <span className="text-xs text-[#555]">
                {new Date(task.created_at).toLocaleString('pl-PL')}
              </span>
            </div>
            <p className="text-sm text-[#aaa] mb-2">{task.task}</p>
            {task.result && (
              <p className="text-xs text-[#777] bg-[#0a0a0a] rounded-lg px-3 py-2 line-clamp-3">
                {task.result}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function TaskStatusBadge({ status }: { status: Task['status'] }) {
  switch (status) {
    case 'pending':
      return <span className="text-xs text-yellow-500 flex items-center gap-1"><Clock size={10} /> Czeka</span>
    case 'running':
      return <span className="text-xs text-blue-400 flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Pracuje</span>
    case 'done':
      return <span className="text-xs text-green-500 flex items-center gap-1"><CheckCircle size={10} /> Gotowe</span>
    case 'failed':
      return <span className="text-xs text-red-500 flex items-center gap-1"><XCircle size={10} /> Błąd</span>
  }
}
