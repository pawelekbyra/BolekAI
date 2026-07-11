import { GitHubConnector } from './github'
import { VercelConnector } from './vercel'
import { EmailConnector } from './email'
import { StripeConnector } from './stripe'
import { ClerkConnector } from './clerk'
import { PolutekConnector } from './polutek'
import { BaseConnector, type ConnectorContext } from './base'

export const CONNECTORS = {
  github: GitHubConnector,
  vercel: VercelConnector,
  email: EmailConnector,
  stripe: StripeConnector,
  clerk: ClerkConnector,
  polutek: PolutekConnector,
}

export type ConnectorName = keyof typeof CONNECTORS

export function createConnector(name: ConnectorName, ctx: ConnectorContext): BaseConnector {
  const ConnectorClass = CONNECTORS[name]
  if (!ConnectorClass) throw new Error(`Unknown connector: ${name}`)
  return new ConnectorClass(ctx)
}

export function getConnectorTools() {
  const tools: any[] = []
  for (const [name, ConnectorClass] of Object.entries(CONNECTORS)) {
    const instance = new ConnectorClass({ env: {} })
    tools.push(...instance.tools)
  }
  return tools
}

export function getConnectorManifests() {
  const manifests: Record<string, any> = {}
  for (const [name, ConnectorClass] of Object.entries(CONNECTORS)) {
    const instance = new ConnectorClass({ env: {} })
    manifests[name] = instance.manifest
  }
  return manifests
}
