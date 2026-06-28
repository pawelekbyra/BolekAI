import type { ToolDefinition } from './index'
import type { Env } from '../env'
import { runAction } from '../agent-mode'

const VERCEL = 'https://api.vercel.com'

function headers(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

async function vFetch(token: string, path: string, options?: RequestInit) {
  const res = await fetch(`${VERCEL}${path}`, { ...options, headers: headers(token) })
  if (!res.ok) throw new Error(`Vercel ${res.status}: ${await res.text()}`)
  return res.json()
}

export const vercelTools: ToolDefinition[] = [
  {
    name: 'vercel_list_projects',
    description: 'Wylistuj projekty na Vercel',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'vercel_get_deployments',
    description: 'Pobierz ostatnie deploymenty projektu na Vercel',
    parameters: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Nazwa projektu na Vercel' },
      },
      required: ['project'],
    },
  },
  {
    name: 'vercel_get_logs',
    description: 'Pobierz logi z ostatniego deploymentu projektu',
    parameters: {
      type: 'object',
      properties: {
        deployment_id: { type: 'string', description: 'ID deploymentu (z vercel_get_deployments)' },
      },
      required: ['deployment_id'],
    },
  },
  {
    name: 'vercel_redeploy',
    description: 'Zrób redeploy projektu na Vercel',
    parameters: {
      type: 'object',
      properties: {
        deployment_id: { type: 'string', description: 'ID deploymentu do ponownego wdrożenia' },
      },
      required: ['deployment_id'],
    },
  },
  {
    name: 'vercel_get_runtime_errors',
    description: 'Pobierz błędy runtime z projektu Vercel (ostatnie 24h)',
    parameters: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Nazwa projektu' },
      },
      required: ['project'],
    },
  },
]

type Args = { project?: string; deployment_id?: string }

export async function executeVercelTool(
  name: string,
  args: unknown,
  env: Env,
  chatId: number
): Promise<unknown> {
  const a = args as Args
  const token = env.VERCEL_TOKEN

  switch (name) {
    case 'vercel_list_projects': {
      const data = await vFetch(token, '/v9/projects?limit=20') as { projects: Array<{ name: string; id: string; framework: string }> }
      return data.projects.map((p) => ({ name: p.name, id: p.id, framework: p.framework }))
    }

    case 'vercel_get_deployments': {
      const data = await vFetch(token, `/v6/deployments?app=${a.project}&limit=5`) as {
        deployments: Array<{ uid: string; state: string; createdAt: number; url: string }>
      }
      return data.deployments.map((d) => ({
        id: d.uid,
        state: d.state,
        url: d.url,
        created: new Date(d.createdAt).toISOString(),
      }))
    }

    case 'vercel_get_logs': {
      const data = await vFetch(token, `/v2/deployments/${a.deployment_id}/events?limit=100`) as Array<{
        type: string; text?: string; date: number
      }>
      return data
        .filter((e) => e.text)
        .slice(-30)
        .map((e) => ({ type: e.type, text: e.text, date: new Date(e.date).toISOString() }))
    }

    case 'vercel_redeploy': {
      return runAction({
        env,
        chatId,
        description: `Redeploy deploymentu ${a.deployment_id}`,
        action: async () => {
          const data = await vFetch(token, `/v13/deployments/${a.deployment_id}/redeploy`, {
            method: 'POST',
          }) as { id: string; url: string }
          return `Redeploy uruchomiony. Nowy deployment: ${data.url}`
        },
      })
    }

    case 'vercel_get_runtime_errors': {
      const deps = await vFetch(token, `/v6/deployments?app=${a.project}&limit=1`) as {
        deployments: Array<{ uid: string }>
      }
      const depId = deps.deployments[0]?.uid
      if (!depId) return 'Brak deploymentów dla tego projektu.'

      const logs = await vFetch(token, `/v2/deployments/${depId}/events?limit=200`) as Array<{
        type: string; text?: string; date: number
      }>
      const errors = logs.filter((e) => e.type === 'error' || e.text?.toLowerCase().includes('error'))
      return errors.slice(-20).map((e) => ({ text: e.text, date: new Date(e.date).toISOString() }))
    }

    default:
      throw new Error(`Unknown vercel tool: ${name}`)
  }
}
