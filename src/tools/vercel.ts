import type { ToolDefinition } from './index'
import type { Env } from '../env'
import { runAction } from '../agent-mode'
import type { ActionExecutionOptions } from '../agent-mode'

const VERCEL = 'https://api.vercel.com'

function headers(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

async function vFetch(token: string, path: string, options?: RequestInit) {
  const res = await fetch(`${VERCEL}${path}`, { ...options, headers: headers(token) })
  if (!res.ok) throw new Error(`Vercel ${res.status}: ${await res.text()}`)
  return res.json()
}

async function vAnalyticsFetch(token: string, params: Record<string, string>) {
  const url = new URL(`${VERCEL}/v1/query/web-analytics/visits/count`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Vercel Web Analytics ${res.status}: ${await res.text()}`)
  return res.json() as Promise<{ data: { pageviews: number; visitors: number } }>
}

export async function fetchPolutekPageviews(
  env: Env,
  since: Date,
  until: Date
): Promise<{ pageviews: number; visitors: number }> {
  const data = await vAnalyticsFetch(env.VERCEL_TOKEN, {
    teamId: env.POLUTEK_VERCEL_TEAM_ID ?? DEFAULT_POLUTEK_VERCEL_TEAM_ID,
    projectId: env.POLUTEK_VERCEL_PROJECT_ID ?? DEFAULT_POLUTEK_VERCEL_PROJECT_ID,
    since: since.toISOString(),
    until: until.toISOString(),
  })
  return { pageviews: data.data.pageviews, visitors: data.data.visitors }
}

export const vercelTools: ToolDefinition[] = [
  {
    name: 'vercel_list_projects',
    riskLevel: 'low',
    sideEffect: false,
    description: 'Wylistuj projekty na Vercel',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'vercel_get_deployments',
    riskLevel: 'low',
    sideEffect: false,
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
    riskLevel: 'low',
    sideEffect: false,
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
    riskLevel: 'high',
    sideEffect: true,
    requiresApproval: true,
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
    riskLevel: 'low',
    sideEffect: false,
    description: 'Pobierz błędy runtime z projektu Vercel (ostatnie 24h)',
    parameters: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Nazwa projektu' },
      },
      required: ['project'],
    },
  },
  {
    name: 'vercel_get_pageviews',
    riskLevel: 'low',
    sideEffect: false,
    description: 'Pobierz liczbę odsłon (pageviews) i unikalnych odwiedzających z Vercel Web Analytics dla projektu Polutka za ostatnie N dni. Wymaga VERCEL_TOKEN oraz włączonego Web Analytics.',
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Liczba dni wstecz, domyślnie 1 (wczoraj)' },
      },
    },
  },
]

type Args = { project?: string; deployment_id?: string; days?: number }

const DEFAULT_POLUTEK_VERCEL_PROJECT_ID = 'prj_e7YawXp53b22uIMsiyW2NkccZgMz'
const DEFAULT_POLUTEK_VERCEL_TEAM_ID = 'team_sc16PptMTGc4ip47phctR79J'

export async function executeVercelTool(
  name: string,
  args: unknown,
  env: Env,
  chatId: number,
  options: ActionExecutionOptions = {}
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
        intent: { tool: name, args: a },
        approved: options.approved,
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

    case 'vercel_get_pageviews': {
      const days = Math.max(1, Math.min(Math.floor(a.days ?? 1), 90))
      const until = new Date()
      const since = new Date(until.getTime() - days * 24 * 60 * 60 * 1000)
      const data = await fetchPolutekPageviews(env, since, until)
      return { days, ...data }
    }

    default:
      throw new Error(`Unknown vercel tool: ${name}`)
  }
}
