import type { ToolDefinition } from './index'
import type { Env } from '../env'
import { listAgents } from '../agents/registry'

export const agentTools: ToolDefinition[] = [
  {
    name: 'agent_assign',
    description: 'Przydziel zadanie jednemu z agentów — Mailer, Researcher, Coder lub Analyst. Agent wykona zadanie autonomicznie i wyśle wynik przez Telegram.',
    parameters: {
      type: 'object',
      properties: {
        agent_name: { type: 'string', description: 'Nazwa agenta: Mailer | Researcher | Coder | Analyst' },
        task:       { type: 'string', description: 'Pełny opis zadania dla agenta' },
      },
      required: ['agent_name', 'task'],
    },
  },
  {
    name: 'agent_status',
    description: 'Sprawdź status wszystkich agentów — kto pracuje, kto czeka, ostatnie zadania',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'agent_history',
    description: 'Pobierz historię zadań wybranego agenta lub wszystkich agentów',
    parameters: {
      type: 'object',
      properties: {
        agent_name: { type: 'string', description: 'Nazwa agenta (opcjonalnie — bez nazwy zwraca historię wszystkich)' },
        limit:      { type: 'number', description: 'Liczba ostatnich zadań (domyślnie 5)' },
      },
    },
  },
  {
    name: 'agent_list',
    description: 'Wylistuj dostępnych agentów i ich role',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
]

type Args = { agent_name?: string; task?: string; limit?: number }

export async function executeAgentTool(
  name: string,
  args: unknown,
  env: Env,
  chatId: number
): Promise<unknown> {
  const a = args as Args

  switch (name) {
    case 'agent_assign': {
      const agentName = a.agent_name!
      const available = listAgents().map((ag) => ag.name)
      if (!available.includes(agentName)) {
        return { error: `Nieznany agent: ${agentName}. Dostępni: ${available.join(', ')}` }
      }

      const row = await env.DB
        .prepare('INSERT INTO agent_tasks (agent_name, task, chat_id) VALUES (?, ?, ?) RETURNING id')
        .bind(agentName, a.task!, chatId)
        .first<{ id: number }>()

      return {
        ok: true,
        task_id: row?.id,
        message: `Zadanie przydzielone agentowi ${agentName}. Wynik przyjdzie przez Telegram gdy skończy.`,
      }
    }

    case 'agent_status': {
      const agents = await env.DB
        .prepare('SELECT name, role, status, current_task, updated_at FROM agents ORDER BY name ASC')
        .all()
      return agents.results
    }

    case 'agent_history': {
      const limit = a.limit ?? 5
      const query = a.agent_name
        ? 'SELECT agent_name, task, status, result, created_at, done_at FROM agent_tasks WHERE agent_name = ? ORDER BY created_at DESC LIMIT ?'
        : 'SELECT agent_name, task, status, result, created_at, done_at FROM agent_tasks ORDER BY created_at DESC LIMIT ?'

      const result = a.agent_name
        ? await env.DB.prepare(query).bind(a.agent_name, limit).all()
        : await env.DB.prepare(query).bind(limit).all()

      return result.results
    }

    case 'agent_list': {
      return listAgents().map((ag) => ({ name: ag.name, role: ag.role }))
    }

    default:
      throw new Error(`Unknown agent tool: ${name}`)
  }
}
