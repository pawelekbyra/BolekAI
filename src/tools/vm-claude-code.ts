import type { ToolDefinition } from './index'
import type { Env } from '../env'
import { runAction } from '../agent-mode'
import type { ActionExecutionOptions } from '../agent-mode'

export const vmClaudeCodeTools: ToolDefinition[] = [
  {
    name: 'vm_claude_code',
    riskLevel: 'high',
    sideEffect: true,
    requiresApproval: true,
    description:
      'Zleć zadanie agentowi Claude Code działającemu na własnym serwerze (VM) — może pisać, uruchamiać i testować kod, nie tylko go generować jak coding_task. Używaj do napraw, budowania funkcji, debugowania czegoś, czego nie da się zrobić istniejącymi narzędziami.',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Opis zadania dla agenta na VM' },
        model: { type: 'string', description: 'Model: haiku (tanio, proste zadania) lub sonnet (złożone zadania). Domyślnie haiku.' },
        sessionId: { type: 'string', description: 'ID sesji do kontynuacji poprzedniej rozmowy z agentem (opcjonalnie)' },
      },
      required: ['prompt'],
    },
  },
]

type Args = { prompt?: string; model?: string; sessionId?: string }

type VmAgentResponse = {
  result?: string
  total_cost_usd?: number
  session_id?: string
  error?: string
}

export async function executeVmClaudeCodeTool(
  name: string,
  args: unknown,
  env: Env,
  chatId: number,
  options: ActionExecutionOptions = {}
): Promise<unknown> {
  const a = args as Args

  switch (name) {
    case 'vm_claude_code': {
      return runAction({
        env,
        chatId,
        description: `Zadanie dla agenta na VM: ${a.prompt?.slice(0, 60)}...`,
        intent: { tool: name, args: a },
        approved: options.approved,
        action: async () => {
          if (!env.VM_AGENT_URL || !env.VM_AGENT_TOKEN) {
            throw new Error('VM_AGENT_URL lub VM_AGENT_TOKEN nie skonfigurowane')
          }

          const res = await fetch(`${env.VM_AGENT_URL}/task`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Auth-Token': env.VM_AGENT_TOKEN,
            },
            body: JSON.stringify({
              prompt: a.prompt,
              model: a.model ?? 'haiku',
              sessionId: a.sessionId,
            }),
          })

          if (!res.ok) throw new Error(`VM agent ${res.status}: ${await res.text()}`)
          const data = (await res.json()) as VmAgentResponse

          if (data.error) throw new Error(data.error)

          const costLine = data.total_cost_usd ? `\n\nKoszt: $${data.total_cost_usd.toFixed(4)}` : ''
          const sessionLine = data.session_id ? `\nSession ID (do kontynuacji): ${data.session_id}` : ''
          return `${data.result ?? '(brak wyniku)'}${costLine}${sessionLine}`
        },
      })
    }

    default:
      throw new Error(`Unknown vm tool: ${name}`)
  }
}
