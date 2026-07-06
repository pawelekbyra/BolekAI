import { executeMemoryTool, recallRelevant } from '../tools/memory'
import type { Env } from '../env'

type PreparedResult = { results?: unknown[] }

function makeEnv(overrides: Partial<Env> = {}) {
  const run = jest.fn().mockResolvedValue({})
  const all = jest.fn().mockResolvedValue({ results: [] } as PreparedResult)
  const bind = jest.fn(() => ({ run, all }))
  const prepare = jest.fn(() => ({ bind }))

  const aiRun = jest.fn().mockResolvedValue({ shape: [1, 3], data: [[0.1, 0.2, 0.3]] })
  const upsert = jest.fn().mockResolvedValue({ mutationId: 'm1' })
  const query = jest.fn().mockResolvedValue({ count: 0, matches: [] })
  const deleteByIds = jest.fn().mockResolvedValue({ mutationId: 'm2' })

  const env = {
    DB: { prepare },
    AI: { run: aiRun },
    MEMORY: { upsert, query, deleteByIds },
    ...overrides,
  } as unknown as Env

  return { env, prepare, bind, run, all, aiRun, upsert, query, deleteByIds }
}

describe('Memory Tool', () => {
  afterEach(() => jest.clearAllMocks())

  describe('memory_remember', () => {
    it('stores canonical text in D1 and the vector in Vectorize', async () => {
      const { env, prepare, aiRun, upsert } = makeEnv()

      const result = (await executeMemoryTool(
        'memory_remember',
        { content: 'Właściciel kupił nowy traktor w czerwcu', category: 'praca' },
        env
      )) as { ok: boolean; id: string }

      expect(result.ok).toBe(true)
      expect(result.id).toBeTruthy()
      expect(prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO semantic_memories'))
      expect(aiRun).toHaveBeenCalledWith('@cf/baai/bge-m3', {
        text: ['Właściciel kupił nowy traktor w czerwcu'],
      })
      expect(upsert).toHaveBeenCalledWith([
        expect.objectContaining({ id: result.id, values: [0.1, 0.2, 0.3] }),
      ])
    })

    it('requires content', async () => {
      const { env } = makeEnv()
      const result = await executeMemoryTool('memory_remember', {}, env)
      expect(result).toEqual({ ok: false, error: 'content is required' })
    })
  })

  describe('memory_recall', () => {
    it('returns matches above the relevance threshold, hydrated from D1', async () => {
      const { env, query, all } = makeEnv()
      query.mockResolvedValueOnce({
        count: 2,
        matches: [
          { id: 'a', score: 0.82, metadata: { category: 'praca' } },
          { id: 'b', score: 0.12, metadata: { category: 'praca' } },
        ],
      })
      all.mockResolvedValueOnce({
        results: [{ id: 'a', content: 'Kupił traktor', category: 'praca', created_at: '2026-06-01' }],
      })

      const result = (await executeMemoryTool(
        'memory_recall',
        { query: 'maszyny rolnicze' },
        env
      )) as { memories: Array<{ id: string; content: string; score: number }> }

      expect(result.memories).toHaveLength(1)
      expect(result.memories[0]).toEqual(
        expect.objectContaining({ id: 'a', content: 'Kupił traktor', score: 0.82 })
      )
    })

    it('returns empty when nothing clears the threshold', async () => {
      const { env, query } = makeEnv()
      query.mockResolvedValueOnce({ count: 1, matches: [{ id: 'x', score: 0.1 }] })

      const result = (await executeMemoryTool('memory_recall', { query: 'cokolwiek' }, env)) as {
        memories: unknown[]
      }
      expect(result.memories).toEqual([])
    })
  })

  describe('memory_forget', () => {
    it('deletes from both D1 and Vectorize', async () => {
      const { env, prepare, deleteByIds } = makeEnv()

      const result = await executeMemoryTool('memory_forget', { id: 'gone' }, env)

      expect(result).toEqual({ ok: true })
      expect(prepare).toHaveBeenCalledWith('DELETE FROM semantic_memories WHERE id = ?')
      expect(deleteByIds).toHaveBeenCalledWith(['gone'])
    })
  })

  describe('recallRelevant (auto-injection helper)', () => {
    it('formats relevant memories for the system prompt', async () => {
      const { env, query, all } = makeEnv()
      query.mockResolvedValueOnce({
        count: 1,
        matches: [{ id: 'a', score: 0.9 }],
      })
      all.mockResolvedValueOnce({
        results: [{ id: 'a', content: 'Woli poranne spotkania', category: null, created_at: '2026-01-01' }],
      })

      const injected = await recallRelevant(env, 'kiedy się spotkać')
      expect(injected).toContain('Powiązane pamięci:')
      expect(injected).toContain('Woli poranne spotkania')
    })

    it('never throws — returns empty string when Vectorize errors', async () => {
      const { env, query } = makeEnv()
      query.mockRejectedValueOnce(new Error('index not found'))

      const injected = await recallRelevant(env, 'cokolwiek')
      expect(injected).toBe('')
    })
  })
})
