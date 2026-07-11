import { describe, it, expect } from 'vitest'
import { isOwnerRequest } from './owner-guard'
import type { Env } from '../env'

function envWithKey(key?: string): Env {
  return { BOLEK_API_KEY: key } as Env
}

function requestWithAuth(header?: string): Request {
  const headers = new Headers()
  if (header !== undefined) headers.set('Authorization', header)
  return new Request('https://example.com/api/agents', { headers })
}

describe('isOwnerRequest', () => {
  it('denies when BOLEK_API_KEY is not configured', () => {
    expect(isOwnerRequest(requestWithAuth('Bearer anything'), envWithKey(undefined))).toBe(false)
  })

  it('denies when Authorization header is missing', () => {
    expect(isOwnerRequest(requestWithAuth(undefined), envWithKey('secret'))).toBe(false)
  })

  it('denies when Authorization header is not a Bearer token', () => {
    expect(isOwnerRequest(requestWithAuth('Basic secret'), envWithKey('secret'))).toBe(false)
  })

  it('denies when the token does not match', () => {
    expect(isOwnerRequest(requestWithAuth('Bearer wrong'), envWithKey('secret'))).toBe(false)
  })

  it('denies when the token is a different length than expected', () => {
    expect(isOwnerRequest(requestWithAuth('Bearer secretlonger'), envWithKey('secret'))).toBe(false)
  })

  it('allows when the token matches exactly', () => {
    expect(isOwnerRequest(requestWithAuth('Bearer secret'), envWithKey('secret'))).toBe(true)
  })
})
