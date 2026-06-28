import type { ToolDefinition } from './index'
import type { Env } from '../env'
import { runAction } from '../agent-mode'

const GH = 'https://api.github.com'

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'agent-bolek',
  }
}

async function ghFetch(token: string, path: string, options?: RequestInit) {
  const res = await fetch(`${GH}${path}`, { ...options, headers: headers(token) })
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`)
  return res.json()
}

export const githubTools: ToolDefinition[] = [
  {
    name: 'github_list_repos',
    description: 'Wylistuj repozytoria właściciela na GitHubie',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'github_get_issues',
    description: 'Pobierz otwarte issues z repozytorium',
    parameters: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'Nazwa repo w formacie owner/repo' },
      },
      required: ['repo'],
    },
  },
  {
    name: 'github_create_issue',
    description: 'Utwórz nowe issue w repozytorium',
    parameters: {
      type: 'object',
      properties: {
        repo:  { type: 'string', description: 'owner/repo' },
        title: { type: 'string', description: 'Tytuł issue' },
        body:  { type: 'string', description: 'Treść issue (markdown)' },
      },
      required: ['repo', 'title'],
    },
  },
  {
    name: 'github_get_file',
    description: 'Pobierz zawartość pliku z repozytorium',
    parameters: {
      type: 'object',
      properties: {
        repo:   { type: 'string', description: 'owner/repo' },
        path:   { type: 'string', description: 'Ścieżka do pliku' },
        branch: { type: 'string', description: 'Nazwa brancha (domyślnie main)' },
      },
      required: ['repo', 'path'],
    },
  },
  {
    name: 'github_push_file',
    description: 'Zapisz lub zaktualizuj plik w repozytorium (commit)',
    parameters: {
      type: 'object',
      properties: {
        repo:    { type: 'string', description: 'owner/repo' },
        path:    { type: 'string', description: 'Ścieżka do pliku' },
        content: { type: 'string', description: 'Zawartość pliku' },
        message: { type: 'string', description: 'Commit message' },
        branch:  { type: 'string', description: 'Branch (domyślnie main)' },
      },
      required: ['repo', 'path', 'content', 'message'],
    },
  },
  {
    name: 'github_list_prs',
    description: 'Pobierz otwarte pull requesty z repozytorium',
    parameters: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'owner/repo' },
      },
      required: ['repo'],
    },
  },
]

type Args = {
  repo?: string
  title?: string
  body?: string
  path?: string
  content?: string
  message?: string
  branch?: string
}

export async function executeGithubTool(
  name: string,
  args: unknown,
  env: Env,
  chatId: number
): Promise<unknown> {
  const a = args as Args
  const token = env.GITHUB_TOKEN

  switch (name) {
    case 'github_list_repos': {
      const data = await ghFetch(token, '/user/repos?sort=updated&per_page=20') as Array<{ full_name: string; description: string; language: string }>
      return data.map((r) => ({ name: r.full_name, description: r.description, language: r.language }))
    }

    case 'github_get_issues': {
      const data = await ghFetch(token, `/repos/${a.repo}/issues?state=open&per_page=20`) as Array<{ number: number; title: string; state: string }>
      return data.map((i) => ({ number: i.number, title: i.title, state: i.state }))
    }

    case 'github_create_issue': {
      return runAction({
        env,
        chatId,
        description: `Utwórz issue "${a.title}" w ${a.repo}`,
        action: async () => {
          const data = await ghFetch(token, `/repos/${a.repo}/issues`, {
            method: 'POST',
            body: JSON.stringify({ title: a.title, body: a.body ?? '' }),
          }) as { html_url: string; number: number }
          return `Issue #${data.number}: ${data.html_url}`
        },
      })
    }

    case 'github_get_file': {
      const branch = a.branch ?? 'main'
      const data = await ghFetch(token, `/repos/${a.repo}/contents/${a.path}?ref=${branch}`) as { content: string; encoding: string }
      if (data.encoding === 'base64') {
        return atob(data.content.replace(/\n/g, ''))
      }
      return data.content
    }

    case 'github_push_file': {
      return runAction({
        env,
        chatId,
        description: `Zapisz ${a.path} w ${a.repo}`,
        action: async () => {
          const branch = a.branch ?? 'main'

          let sha: string | undefined
          try {
            const existing = await ghFetch(token, `/repos/${a.repo}/contents/${a.path}?ref=${branch}`) as { sha: string }
            sha = existing.sha
          } catch {}

          await ghFetch(token, `/repos/${a.repo}/contents/${a.path}`, {
            method: 'PUT',
            body: JSON.stringify({
              message: a.message,
              content: btoa(a.content!),
              branch,
              ...(sha ? { sha } : {}),
            }),
          })
          return `Plik ${a.path} zapisany na branchu ${branch}.`
        },
      })
    }

    case 'github_list_prs': {
      const data = await ghFetch(token, `/repos/${a.repo}/pulls?state=open&per_page=20`) as Array<{ number: number; title: string; html_url: string }>
      return data.map((p) => ({ number: p.number, title: p.title, url: p.html_url }))
    }

    default:
      throw new Error(`Unknown github tool: ${name}`)
  }
}
