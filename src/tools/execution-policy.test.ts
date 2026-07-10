import { describe, it, expect } from 'vitest'
import { isReadOnlyModeEnabled, isSideEffectsDisabled } from './index'

describe('Tool Execution — Kill Switches', () => {
  describe('READ_ONLY_MODE detection', () => {
    it('detects READ_ONLY_MODE=true', () => {
      const env = { READ_ONLY_MODE: 'true' } as any
      expect(isReadOnlyModeEnabled(env)).toBe(true)
    })

    it('detects READ_ONLY_MODE=True (case insensitive)', () => {
      const env = { READ_ONLY_MODE: 'True' } as any
      expect(isReadOnlyModeEnabled(env)).toBe(true)
    })

    it('detects READ_ONLY_MODE=TRUE (all caps)', () => {
      const env = { READ_ONLY_MODE: 'TRUE' } as any
      expect(isReadOnlyModeEnabled(env)).toBe(true)
    })

    it('rejects READ_ONLY_MODE=false', () => {
      const env = { READ_ONLY_MODE: 'false' } as any
      expect(isReadOnlyModeEnabled(env)).toBe(false)
    })

    it('rejects undefined READ_ONLY_MODE', () => {
      const env = {} as any
      expect(isReadOnlyModeEnabled(env)).toBe(false)
    })

    it('rejects empty string READ_ONLY_MODE', () => {
      const env = { READ_ONLY_MODE: '' } as any
      expect(isReadOnlyModeEnabled(env)).toBe(false)
    })

    it('handles whitespace correctly', () => {
      const env = { READ_ONLY_MODE: '  true  ' } as any
      expect(isReadOnlyModeEnabled(env)).toBe(true)
    })
  })

  describe('SIDE_EFFECTS_DISABLED detection', () => {
    it('detects SIDE_EFFECTS_DISABLED=true', () => {
      const env = { SIDE_EFFECTS_DISABLED: 'true' } as any
      expect(isSideEffectsDisabled(env)).toBe(true)
    })

    it('detects SIDE_EFFECTS_DISABLED=True (case insensitive)', () => {
      const env = { SIDE_EFFECTS_DISABLED: 'True' } as any
      expect(isSideEffectsDisabled(env)).toBe(true)
    })

    it('detects SIDE_EFFECTS_DISABLED=TRUE (all caps)', () => {
      const env = { SIDE_EFFECTS_DISABLED: 'TRUE' } as any
      expect(isSideEffectsDisabled(env)).toBe(true)
    })

    it('rejects SIDE_EFFECTS_DISABLED=false', () => {
      const env = { SIDE_EFFECTS_DISABLED: 'false' } as any
      expect(isSideEffectsDisabled(env)).toBe(false)
    })

    it('rejects undefined SIDE_EFFECTS_DISABLED', () => {
      const env = {} as any
      expect(isSideEffectsDisabled(env)).toBe(false)
    })

    it('rejects empty string SIDE_EFFECTS_DISABLED', () => {
      const env = { SIDE_EFFECTS_DISABLED: '' } as any
      expect(isSideEffectsDisabled(env)).toBe(false)
    })

    it('handles whitespace correctly', () => {
      const env = { SIDE_EFFECTS_DISABLED: '  true  ' } as any
      expect(isSideEffectsDisabled(env)).toBe(true)
    })
  })

  describe('Kill switch combinations', () => {
    it('both kill switches can coexist safely', () => {
      const env = {
        READ_ONLY_MODE: 'true',
        SIDE_EFFECTS_DISABLED: 'true',
      } as any

      expect(isReadOnlyModeEnabled(env)).toBe(true)
      expect(isSideEffectsDisabled(env)).toBe(true)
    })

    it('handles mixed true/false values', () => {
      const env = {
        READ_ONLY_MODE: 'true',
        SIDE_EFFECTS_DISABLED: 'false',
      } as any

      expect(isReadOnlyModeEnabled(env)).toBe(true)
      expect(isSideEffectsDisabled(env)).toBe(false)
    })

    it('handles null/undefined env gracefully', () => {
      expect(isReadOnlyModeEnabled(undefined)).toBe(false)
      expect(isSideEffectsDisabled(undefined)).toBe(false)
    })
  })
})
