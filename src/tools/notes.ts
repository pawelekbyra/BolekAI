import type { ToolDefinition } from './index'

export const noteTools: ToolDefinition[] = [
  {
    name: 'note_save',
    description: 'Zapisz notatkę lub ważną informację od użytkownika',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Treść notatki' },
        tag: { type: 'string', description: 'Kategoria lub tag (np. praca, zdrowie, pomysł)' },
      },
      required: ['content'],
    },
  },
  {
    name: 'note_search',
    description: 'Przeszukaj zapisane notatki użytkownika',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Szukana fraza lub słowo kluczowe' },
      },
      required: ['query'],
    },
  },
]

type Args = { content?: string; tag?: string; query?: string }

export async function executeNoteTool(name: string, args: unknown, db: D1Database): Promise<unknown> {
  const a = args as Args

  switch (name) {
    case 'note_save': {
      const row = await db
        .prepare('INSERT INTO notes (content, tag) VALUES (?, ?) RETURNING id')
        .bind(a.content!, a.tag ?? null)
        .first<{ id: number }>()
      return { ok: true, id: row?.id }
    }
    case 'note_search': {
      const result = await db
        .prepare('SELECT id, content, tag, created_at FROM notes WHERE content LIKE ? ORDER BY created_at DESC LIMIT 5')
        .bind(`%${a.query}%`)
        .all()
      return result.results
    }
    default:
      throw new Error(`Unknown note tool: ${name}`)
  }
}
