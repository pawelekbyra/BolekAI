import { fetchWithRetry } from '../../http-client'
import type { Env } from '../../env'

export const chatServiceTools = [
  {
    name: 'chat_send_message',
    description: 'Send a message through BolekCzat web interface',
    parameters: {
      type: 'object',
      properties: {
        conversationId: {
          type: 'string',
          description: 'Conversation ID (optional, creates new if omitted)',
        },
        message: {
          type: 'string',
          description: 'Message to send',
        },
      },
      required: ['message'],
    },
  },
]

interface ChatServiceRequest {
  conversationId?: string
  message: string
  context?: {
    memories?: string[]
    recentEvents?: string[]
  }
}

interface ChatServiceResponse {
  success: boolean
  conversationId: string
  assistantMessage: string
  metadata: {
    tokensUsed: number
    executionTime: number
    toolsCalled?: string[]
  }
  memory?: {
    proposedFacts?: string[]
  }
  errors?: string[]
}

async function callChatService(
  url: string,
  token: string,
  payload: ChatServiceRequest
): Promise<ChatServiceResponse> {
  if (!url || !token) {
    return {
      success: false,
      conversationId: '',
      assistantMessage: 'Chat service not configured',
      metadata: { tokensUsed: 0, executionTime: 0 },
      errors: ['CHAT_SERVICE_URL or CHAT_SERVICE_TOKEN not set'],
    }
  }

  try {
    const response = await fetchWithRetry(
      `${url}/api/agent/message`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: 'agent-bolek',
          ...payload,
        }),
        timeout: 15000,
      },
      { maxRetries: 2, initialDelayMs: 300 }
    )

    if (!response.ok) {
      return {
        success: false,
        conversationId: '',
        assistantMessage: `Chat service error: ${response.status}`,
        metadata: { tokensUsed: 0, executionTime: 0 },
        errors: [`HTTP ${response.status}`],
      }
    }

    return await response.json()
  } catch (error) {
    return {
      success: false,
      conversationId: '',
      assistantMessage: `Failed to reach chat service: ${error instanceof Error ? error.message : 'Unknown error'}`,
      metadata: { tokensUsed: 0, executionTime: 0 },
      errors: [error instanceof Error ? error.message : 'Network error'],
    }
  }
}

export async function executeChatServiceTool(
  name: string,
  args: unknown,
  env: Env
): Promise<unknown> {
  const { conversationId, message, context } = args as {
    conversationId?: string
    message?: string
    context?: object
  }

  if (!message) {
    return {
      success: false,
      error: 'message parameter required',
    }
  }

  if (name === 'chat_send_message') {
    return callChatService(env.CHAT_SERVICE_URL || '', env.CHAT_SERVICE_TOKEN || '', {
      conversationId,
      message,
      context,
    })
  }

  throw new Error(`Unknown chat service tool: ${name}`)
}
