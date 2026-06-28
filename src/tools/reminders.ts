import type { ToolDefinition } from './index'

export const reminderTools: ToolDefinition[] = [
  {
    name: 'reminder_set',
    description: 'Ustaw przypomnienie na konkretną datę i godzinę. Użyj gdy użytkownik mówi "przypomnij mi", "za X godzin", "jutro o Y", itp.',
    parameters: {
      type: 'object',
      properties: {
        message:   { type: 'string', description: 'Treść przypomnienia — co Bolek ma napisać o danej godzinie' },
        remind_at: { type: 'string', description: 'Data i czas w formacie ISO 8601, np. 2025-06-28T09:00:00' },
      },
      required: ['message', 'remind_at'],
    },
  },
  {
    name: 'reminder_list',
    description: 'Pokaż listę nadchodzących przypomnień',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'reminder_cancel',
    description: 'Anuluj przypomnienie',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'ID przypomnienia' },
      },
      required: ['id'],
    },
  },
]

type Args = { message?: string; remind_at?: string; id?: number; chat_id?: number }

export async function executeReminderTool(
  name: string,
  args: unknown,
  db: D1Database,
  chatId: number
): Promise<unknown> {
  const a = args as Args

  switch (name) {
    case 'reminder_set': {
      const row = await db
        .prepare('INSERT INTO reminders (chat_id, message, remind_at) VALUES (?, ?, ?) RETURNING id')
        .bind(chatId, a.message!, a.remind_at!)
        .first<{ id: number }>()
      return { ok: true, id: row?.id, remind_at: a.remind_at }
    }
    case 'reminder_list': {
      const result = await db
        .prepare(`
          SELECT id, message, remind_at
          FROM reminders
          WHERE chat_id = ? AND sent = 0 AND remind_at > CURRENT_TIMESTAMP
          ORDER BY remind_at ASC
        `)
        .bind(chatId)
        .all()
      return result.results
    }
    case 'reminder_cancel': {
      await db.prepare('DELETE FROM reminders WHERE id = ? AND chat_id = ?').bind(a.id!, chatId).run()
      return { ok: true }
    }
    default:
      throw new Error(`Unknown reminder tool: ${name}`)
  }
}
