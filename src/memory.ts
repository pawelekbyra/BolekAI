export type Message = {
  role: 'user' | 'assistant'
  content: string
}

export async function saveMessage(db: D1Database, chatId: number, role: string, content: string): Promise<void> {
  await db
    .prepare('INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)')
    .bind(chatId, role, content)
    .run()
}

export async function getHistory(db: D1Database, chatId: number, limit = 10): Promise<Message[]> {
  const result = await db
    .prepare(
      'SELECT role, content FROM messages WHERE chat_id = ? ORDER BY created_at DESC LIMIT ?'
    )
    .bind(chatId, limit)
    .all<Message>()

  return (result.results ?? []).reverse()
}
