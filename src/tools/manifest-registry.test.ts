import { describe, expect, it } from 'vitest'
import { tools, toolManifestRegistry } from './index'
import { getToolManifest } from './manifest-registry'

describe('Tool Manifest Registry', () => {
  it('exposes every existing tool through the manifest registry', () => {
    const toolNames = tools.map((tool) => tool.name).sort()
    const manifestNames = Object.keys(toolManifestRegistry).sort()

    expect(manifestNames).toEqual(toolNames)
  })

  it('finds manifests by dispatch name', () => {
    const manifest = getToolManifest('stripe_refund', tools)

    expect(manifest).toMatchObject({
      name: 'stripe_refund',
      riskLevel: 'critical',
      sideEffect: true,
      defaultPolicy: 'require_approval',
    })
  })

  it('preserves explicit manifest metadata over derived defaults', () => {
    const manifest = getToolManifest('github_push_file', tools)

    expect(manifest?.requiredScopes).toEqual(['repo:write'])
    expect(manifest?.redactionRules.patterns).toHaveLength(1)
  })
})
