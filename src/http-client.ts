export interface RetryOptions {
  maxRetries?: number
  initialDelayMs?: number
  maxDelayMs?: number
  backoffMultiplier?: number
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit & { timeout?: number } = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  const {
    maxRetries = 3,
    initialDelayMs = 100,
    maxDelayMs = 5000,
    backoffMultiplier = 2,
  } = retryOptions

  const { timeout = 5000, ...fetchOptions } = options

  let lastError: Error | null = null
  let lastResponse: Response | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      try {
        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        if (response.ok) {
          return response
        }

        lastResponse = response

        if (response.status >= 500 && attempt < maxRetries) {
          const delay = Math.min(
            initialDelayMs * Math.pow(backoffMultiplier, attempt),
            maxDelayMs
          )
          await sleep(delay)
          continue
        }

        return response
      } finally {
        clearTimeout(timeoutId)
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt < maxRetries) {
        const delay = Math.min(
          initialDelayMs * Math.pow(backoffMultiplier, attempt),
          maxDelayMs
        )
        await sleep(delay)
      }
    }
  }

  if (lastResponse) {
    return lastResponse
  }

  throw lastError || new Error('Failed to fetch after retries')
}
