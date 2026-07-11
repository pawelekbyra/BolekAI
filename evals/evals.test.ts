import { describe, it, expect, beforeEach } from 'vitest'
import { EvalRunner, createMockExecutor, type EvalCase } from './runner'
import path from 'path'

describe('Eval Suite — Faza 11 Regression Tests', () => {
  let runner: EvalRunner

  beforeEach(() => {
    runner = new EvalRunner()
    const fixtureDir = path.join(__dirname, 'fixtures')
    runner.loadFixtures(fixtureDir)
  })

  it('loads all eval fixtures from YAML', () => {
    const fixtures = runner.getFixtures()
    expect(fixtures.length).toBeGreaterThan(0)
  })

  it('loads stripe refund approval eval', () => {
    const fixtures = runner.getFixtures()
    const stripeEval = fixtures.find((f) => f.id === 'stripe-refund-requires-approval')
    expect(stripeEval).toBeDefined()
    expect(stripeEval?.expected.risk_level).toBe('critical')
    expect(stripeEval?.expected.approval_created).toBe(true)
  })

  it('loads prompt injection prevention evals', () => {
    const fixtures = runner.getFixtures()
    const injectionEval = fixtures.find((f) => f.id === 'prompt-injection-denied')
    expect(injectionEval).toBeDefined()
    expect(injectionEval?.tags).toContain('prompt-injection')
  })

  it('loads memory consent evals', () => {
    const fixtures = runner.getFixtures()
    const memoryEval = fixtures.find((f) => f.id === 'memory-write-requires-consent')
    expect(memoryEval).toBeDefined()
    expect(memoryEval?.expected.memory_proposal_created).toBe(true)
  })

  it('loads redaction and idempotency evals', () => {
    const fixtures = runner.getFixtures()
    const idempotencyEval = fixtures.find((f) => f.id === 'refund-idempotency-prevents-double-charge')
    expect(idempotencyEval).toBeDefined()
    expect(idempotencyEval?.expected.double_refund_prevented).toBe(true)
  })

  describe('Eval Runner', () => {
    it('runs eval with mock executor', async () => {
      const evalCase: EvalCase = {
        id: 'test-approval',
        description: 'Test approval creation',
        input: 'approve refund',
        expected: { approval_created: true, risk_level: 'high' },
        tags: ['test'],
      }

      const mockExecutor = createMockExecutor({
        approve: { approval_created: true, risk_level: 'high' },
      })

      const result = await runner.runEval(evalCase, mockExecutor)
      expect(result.passed).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('detects failed assertions', async () => {
      const evalCase: EvalCase = {
        id: 'test-failure',
        description: 'Test failure detection',
        input: 'some input',
        expected: { approval_created: true },
        tags: ['test'],
      }

      const mockExecutor = async () => ({ approval_created: false })

      const result = await runner.runEval(evalCase, mockExecutor)
      expect(result.passed).toBe(false)
      expect(result.errors).toContain('approval_created: expected true, got false')
    })
  })

  describe('Security Categories', () => {
    it('has approval-required evals', () => {
      const fixtures = runner.getFixtures()
      const approvalEvals = fixtures.filter((f) => f.tags.includes('approval-required'))
      expect(approvalEvals.length).toBeGreaterThan(0)
    })

    it('has stripe-specific evals', () => {
      const fixtures = runner.getFixtures()
      const stripeEvals = fixtures.filter((f) => f.tags.includes('stripe'))
      expect(stripeEvals.length).toBeGreaterThan(0)
    })

    it('has security evals', () => {
      const fixtures = runner.getFixtures()
      const securityEvals = fixtures.filter((f) => f.tags.includes('security'))
      expect(securityEvals.length).toBeGreaterThan(0)
    })

    it('has memory evals', () => {
      const fixtures = runner.getFixtures()
      const memoryEvals = fixtures.filter((f) => f.tags.includes('memory'))
      expect(memoryEvals.length).toBeGreaterThan(0)
    })

    it('has redaction evals', () => {
      const fixtures = runner.getFixtures()
      const redactionEvals = fixtures.filter((f) => f.tags.includes('redaction'))
      expect(redactionEvals.length).toBeGreaterThan(0)
    })
  })

  describe('Critical Operations', () => {
    it('identifies all critical-level operations', () => {
      const fixtures = runner.getFixtures()
      const criticalOps = fixtures.filter((f) => f.expected.risk_level === 'critical')
      expect(criticalOps.length).toBeGreaterThan(0)
      expect(criticalOps.some((f) => f.id.includes('refund'))).toBe(true)
    })

    it('requires approval for critical operations', () => {
      const fixtures = runner.getFixtures()
      const criticalOps = fixtures.filter((f) => f.expected.risk_level === 'critical')
      for (const op of criticalOps) {
        expect(op.expected.approval_created || op.expected.approval_required).toBe(true)
      }
    })
  })
})
