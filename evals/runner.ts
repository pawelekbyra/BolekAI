import fs from 'fs'
import path from 'path'
import YAML from 'yaml'

export interface EvalCase {
  id: string
  description: string
  input: string
  expected: Record<string, unknown>
  tags: string[]
}

export interface EvalResult {
  caseId: string
  passed: boolean
  expected: Record<string, unknown>
  actual: Record<string, unknown>
  errors: string[]
  duration: number
}

export interface EvalSuite {
  name: string
  cases: EvalCase[]
  results: EvalResult[]
  totalDuration: number
  passedCount: number
  failedCount: number
}

export class EvalRunner {
  private fixtures: EvalCase[] = []

  loadFixtures(fixtureDir: string): void {
    const files = fs.readdirSync(fixtureDir)
    for (const file of files) {
      if (!file.endsWith('.yaml')) continue

      const filePath = path.join(fixtureDir, file)
      const content = fs.readFileSync(filePath, 'utf-8')
      const docs = YAML.parseAllDocuments(content)

      for (const doc of docs) {
        const data = doc.toJS() as EvalCase
        if (data.id && data.input && data.expected) {
          this.fixtures.push(data)
        }
      }
    }
  }

  async runEval(
    evalCase: EvalCase,
    executor: (input: string) => Promise<Record<string, unknown>>
  ): Promise<EvalResult> {
    const startTime = Date.now()
    const errors: string[] = []
    let actual: Record<string, unknown> = {}

    try {
      actual = await executor(evalCase.input)

      // Check expected fields
      for (const [key, expectedValue] of Object.entries(evalCase.expected)) {
        const actualValue = actual[key]
        if (typeof expectedValue === 'boolean') {
          if (actualValue !== expectedValue) {
            errors.push(`${key}: expected ${expectedValue}, got ${actualValue}`)
          }
        } else if (typeof expectedValue === 'number') {
          if (actualValue !== expectedValue) {
            errors.push(`${key}: expected ${expectedValue}, got ${actualValue}`)
          }
        } else if (typeof expectedValue === 'string') {
          if (String(actualValue) !== expectedValue) {
            errors.push(`${key}: expected "${expectedValue}", got "${actualValue}"`)
          }
        }
      }
    } catch (error) {
      errors.push(`Execution failed: ${String(error)}`)
    }

    const duration = Date.now() - startTime

    return {
      caseId: evalCase.id,
      passed: errors.length === 0,
      expected: evalCase.expected,
      actual,
      errors,
      duration,
    }
  }

  async runSuite(
    name: string,
    filter?: (tag: string) => boolean,
    executor?: (input: string) => Promise<Record<string, unknown>>
  ): Promise<EvalSuite> {
    const cases = filter ? this.fixtures.filter((c) => c.tags.some(filter)) : this.fixtures

    const results: EvalResult[] = []
    const startTime = Date.now()

    for (const evalCase of cases) {
      if (!executor) {
        results.push({
          caseId: evalCase.id,
          passed: false,
          expected: evalCase.expected,
          actual: {},
          errors: ['No executor provided'],
          duration: 0,
        })
        continue
      }

      const result = await this.runEval(evalCase, executor)
      results.push(result)
    }

    const totalDuration = Date.now() - startTime
    const passedCount = results.filter((r) => r.passed).length
    const failedCount = results.filter((r) => !r.passed).length

    return {
      name,
      cases,
      results,
      totalDuration,
      passedCount,
      failedCount,
    }
  }

  printSuiteResults(suite: EvalSuite): void {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`Eval Suite: ${suite.name}`)
    console.log(`${'='.repeat(60)}`)
    console.log(`Total: ${suite.cases.length} | Passed: ${suite.passedCount} | Failed: ${suite.failedCount}`)
    console.log(`Duration: ${(suite.totalDuration / 1000).toFixed(2)}s\n`)

    for (const result of suite.results) {
      const icon = result.passed ? '✓' : '✗'
      console.log(`${icon} ${result.caseId} (${result.duration}ms)`)

      if (result.errors.length > 0) {
        for (const error of result.errors) {
          console.log(`  → ${error}`)
        }
      }
    }

    console.log(`\n${'='.repeat(60)}\n`)
  }

  getFixtures(): EvalCase[] {
    return this.fixtures
  }
}

export function createMockExecutor(responses: Record<string, Record<string, unknown>>) {
  return async (input: string): Promise<Record<string, unknown>> => {
    // Simple pattern matching for mock responses
    for (const [pattern, response] of Object.entries(responses)) {
      if (input.toLowerCase().includes(pattern.toLowerCase())) {
        return response
      }
    }
    return { success: false, message: 'No matching response' }
  }
}
