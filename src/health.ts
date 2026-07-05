import type { Env } from './env'

export interface ServiceHealth {
  name: string
  status: 'ok' | 'down' | 'unconfigured'
  latency?: number
  error?: string
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  services: ServiceHealth[]
}

async function checkServiceHealth(url: string, token: string, timeout = 5000): Promise<ServiceHealth> {
  if (!url || !token) {
    return { name: url || 'unknown', status: 'unconfigured' }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const start = Date.now()
    const response = await fetch(`${url}/health`, {
      signal: controller.signal,
      headers: { 'Authorization': `Bearer ${token}` },
    })
    const latency = Date.now() - start

    if (response.ok) {
      return { name: url, status: 'ok', latency }
    }
    return { name: url, status: 'down', error: `HTTP ${response.status}`, latency }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { name: url, status: 'down', error: 'Timeout' }
    }
    return { name: url, status: 'down', error: error instanceof Error ? error.message : 'Unknown error' }
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function getHealthStatus(env: Env): Promise<HealthStatus> {
  const [chatHealth, flowHealth, kbHealth] = await Promise.all([
    checkServiceHealth(env.CHAT_SERVICE_URL || '', env.CHAT_SERVICE_TOKEN || ''),
    checkServiceHealth(env.FLOW_SERVICE_URL || '', env.FLOW_SERVICE_TOKEN || ''),
    checkServiceHealth(env.KB_SERVICE_URL || '', env.KB_SERVICE_TOKEN || ''),
  ])

  const services = [
    { ...chatHealth, name: 'BolekCzat (Chat)' },
    { ...flowHealth, name: 'BolekFlow (Workflow)' },
    { ...kbHealth, name: 'BolekKB (Knowledge)' },
  ]

  const downCount = services.filter((s) => s.status === 'down').length
  const unconfiguredCount = services.filter((s) => s.status === 'unconfigured').length

  let status: 'healthy' | 'degraded' | 'unhealthy'
  if (unconfiguredCount === 3) {
    status = 'unhealthy'
  } else if (downCount > 0) {
    status = 'degraded'
  } else {
    status = 'healthy'
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    services,
  }
}
