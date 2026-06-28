import type { ToolDefinition } from './index'

export const factTools: ToolDefinition[] = [
  {
    name: 'fact_save',
    description: 'Zapamiętaj ważny fakt o właścicielu — imię, preferencje, praca, rodzina, nawyki, cokolwiek co warto wiedzieć na przyszłość',
    parameters: {
      type: 'object',
      properties: {
        key:   { type: 'string', description: 'Krótka nazwa faktu np. "imie", "praca", "alergia", "ulubiony_kolor"' },
        value: { type: 'string', description: 'Wartość faktu' },
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'fact_list',
    description: 'Pobierz wszystkie zapamiętane fakty o właścicielu',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'fact_delete',
    description: 'Usuń zapamiętany fakt który jest nieaktualny',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Nazwa faktu do usunięcia' },
      },
      required: ['key'],
    },
  },
]

type Args = { key?: string; value?: string }

export async function executeFactTool(name: string, args: unknown, db: D1Database): Promise<unknown> {
  const a = args as Args

  switch (name) {
    case 'fact_save': {
      await db
        .prepare(`
          INSERT INTO owner_facts (key, value, updated_at)
          VALUES (?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
        `)
        .bind(a.key!, a.value!)
        .run()
      return { ok: true }
    }
    case 'fact_list': {
      const result = await db
        .prepare('SELECT key, value, updated_at FROM owner_facts ORDER BY key ASC')
        .all()
      return result.results
    }
    case 'fact_delete': {
      await db.prepare('DELETE FROM owner_facts WHERE key = ?').bind(a.key!).run()
      return { ok: true }
    }
    default:
      throw new Error(`Unknown fact tool: ${name}`)
  }
}

export async function getAllFacts(db: D1Database): Promise<string> {
  const result = await db
    .prepare('SELECT key, value FROM owner_facts ORDER BY key ASC')
    .all<{ key: string; value: string }>()

  if (!result.results?.length) return ''

  const lines = result.results.map((f) => `- ${f.key}: ${f.value}`)
  return `\nCo wiem o właścicielu:\n${lines.join('\n')}`
}
