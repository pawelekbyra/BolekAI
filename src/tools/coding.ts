import type { ToolDefinition } from './index'
import type { Env } from '../env'
import { runAction } from '../agent-mode'

export const codingTools: ToolDefinition[] = [
  {
    name: 'coding_task',
    description: 'Zleć zadanie kodowania Claude AI — opisz co ma zostać napisane lub zmienione, podaj kontekst kodu jeśli potrzeba',
    parameters: {
      type: 'object',
      properties: {
        task:    { type: 'string', description: 'Opis zadania kodowania — co ma zostać napisane lub zmienione' },
        context: { type: 'string', description: 'Kontekst: obecny kod, pliki, zależności (opcjonalnie)' },
        repo:    { type: 'string', description: 'Repozytorium owner/repo gdzie ma trafić kod (opcjonalnie)' },
        path:    { type: 'string', description: 'Ścieżka do pliku który ma zostać utworzony/zmieniony (opcjonalnie)' },
      },
      required: ['task'],
    },
  },
  {
    name: 'coding_review',
    description: 'Zleć review kodu — Claude przejrzy kod i wskaże problemy, sugestie, błędy',
    parameters: {
      type: 'object',
      properties: {
        code:     { type: 'string', description: 'Kod do review' },
        language: { type: 'string', description: 'Język programowania' },
        focus:    { type: 'string', description: 'Na co zwrócić szczególną uwagę (opcjonalnie)' },
      },
      required: ['code'],
    },
  },
]

type TaskArgs = { task?: string; context?: string; repo?: string; path?: string }
type ReviewArgs = { code?: string; language?: string; focus?: string }

async function callClaude(apiKey: string, systemPrompt: string, userMessage: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`)
  const data = await res.json() as { content: Array<{ type: string; text: string }> }
  return data.content.find((b) => b.type === 'text')?.text ?? ''
}

export async function executeCodingTool(
  name: string,
  args: unknown,
  env: Env,
  chatId: number
): Promise<unknown> {
  switch (name) {
    case 'coding_task': {
      const a = args as TaskArgs
      return runAction({
        env,
        chatId,
        description: `Zadanie kodowania: ${a.task?.slice(0, 60)}...`,
        action: async () => {
          const system = `Jesteś ekspertem programistą. Piszesz czysty, produkcyjny kod.
Odpowiadasz TYLKO kodem — bez wyjaśnień, bez markdown fences chyba że to część kodu.
Jeśli zadanie wymaga wielu plików, opisz każdy plik nagłówkiem: === PLIK: ścieżka/do/pliku ===`

          const user = a.context
            ? `Zadanie: ${a.task}\n\nKontekst:\n${a.context}`
            : `Zadanie: ${a.task}`

          const code = await callClaude(env.ANTHROPIC_API_KEY, system, user)

          if (a.repo && a.path) {
            const { executeGithubTool } = await import('./github')
            await executeGithubTool('github_push_file', {
              repo: a.repo,
              path: a.path,
              content: code,
              message: `feat: ${a.task?.slice(0, 72)}`,
            }, env, chatId)
            return `Kod zapisany w ${a.repo}/${a.path}`
          }

          return code
        },
      })
    }

    case 'coding_review': {
      const a = args as ReviewArgs
      const system = `Jesteś seniorem programistą robiącym code review.
Odpowiadasz po polsku. Wskazujesz: błędy, problemy bezpieczeństwa, sugestie poprawy.
Formatujesz odpowiedź jako zwięzłą listę punktów.`

      const user = `Język: ${a.language ?? 'nieznany'}
${a.focus ? `Skup się na: ${a.focus}` : ''}

Kod:
${a.code}`

      const review = await callClaude(env.ANTHROPIC_API_KEY, system, user)
      return review
    }

    default:
      throw new Error(`Unknown coding tool: ${name}`)
  }
}
