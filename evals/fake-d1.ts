import { DatabaseSync, type StatementSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Runs the real migration SQL files against a real in-memory SQLite engine
 * (node:sqlite) and wraps it behind the D1Database interface, so eval tests
 * exercise the actual queries in approvals.ts / audit.ts / agent-mode.ts /
 * memory-items.ts instead of a hand-rolled mock.
 */
class FakeD1PreparedStatement implements D1PreparedStatement {
  private boundArgs: unknown[] = []

  constructor(private readonly stmt: StatementSync) {}

  bind(...values: unknown[]): D1PreparedStatement {
    this.boundArgs = values
    return this
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const info = this.stmt.run(...(this.boundArgs as never[]))
    return {
      success: true,
      results: [],
      meta: {
        changes: Number(info.changes),
        last_row_id: Number(info.lastInsertRowid),
        duration: 0,
        size_after: 0,
        rows_read: 0,
        rows_written: Number(info.changes),
      } as unknown as D1Result<T>['meta'],
    }
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const row = this.stmt.get(...(this.boundArgs as never[]))
    return (row ?? null) as T | null
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const rows = this.stmt.all(...(this.boundArgs as never[])) as T[]
    return { success: true, results: rows, meta: {} as D1Result<T>['meta'] }
  }

  async raw<T = unknown[]>(): Promise<T[]> {
    const rows = this.stmt.all(...(this.boundArgs as never[])) as Record<string, unknown>[]
    return rows.map((row) => Object.values(row)) as T[]
  }
}

class FakeD1Database implements D1Database {
  constructor(private readonly db: DatabaseSync) {}

  prepare(sql: string): D1PreparedStatement {
    return new FakeD1PreparedStatement(this.db.prepare(sql))
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    const out: D1Result<T>[] = []
    for (const statement of statements) out.push(await statement.run())
    return out
  }

  async exec(sql: string): Promise<D1ExecResult> {
    this.db.exec(sql)
    return { count: 0, duration: 0 }
  }

  async dump(): Promise<ArrayBuffer> {
    throw new Error('dump() is not supported by the eval fake D1')
  }

  withSession(): D1DatabaseSession {
    throw new Error('withSession() is not supported by the eval fake D1')
  }
}

const MIGRATIONS_DIR = path.join(__dirname, '..', 'src', 'db', 'migrations')

export function createFakeD1(): D1Database {
  const sqlite = new DatabaseSync(':memory:')

  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8')
    sqlite.exec(sql)
  }

  return new FakeD1Database(sqlite)
}
