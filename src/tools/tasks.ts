import type { ToolDefinition } from './index'

export const taskTools: ToolDefinition[] = [
  {
    name: 'task_add',
    description: 'Dodaj nowe zadanie do listy zadań użytkownika',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Tytuł zadania' },
        due_date: { type: 'string', description: 'Termin wykonania (format YYYY-MM-DD)' },
      },
      required: ['title'],
    },
  },
  {
    name: 'task_list',
    description: 'Pobierz listę aktywnych (niezakończonych) zadań',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'task_done',
    description: 'Oznacz zadanie jako wykonane',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'ID zadania' },
      },
      required: ['id'],
    },
  },
]

type Args = { title?: string; due_date?: string; id?: number }

export async function executeTaskTool(name: string, args: unknown, db: D1Database): Promise<unknown> {
  const a = args as Args

  switch (name) {
    case 'task_add': {
      const row = await db
        .prepare('INSERT INTO tasks (title, due_date) VALUES (?, ?) RETURNING id')
        .bind(a.title!, a.due_date ?? null)
        .first<{ id: number }>()
      return { ok: true, id: row?.id }
    }
    case 'task_list': {
      const result = await db
        .prepare('SELECT id, title, due_date FROM tasks WHERE done = 0 ORDER BY created_at ASC')
        .all()
      return result.results
    }
    case 'task_done': {
      await db.prepare('UPDATE tasks SET done = 1 WHERE id = ?').bind(a.id!).run()
      return { ok: true }
    }
    default:
      throw new Error(`Unknown task tool: ${name}`)
  }
}
