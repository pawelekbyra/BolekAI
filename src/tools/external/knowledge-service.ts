import { fetchWithRetry } from '../../http-client'
import type { Env } from '../../env'

export const knowledgeServiceTools = [
  {
    name: 'kb_query',
    description: 'Search the knowledge base for relevant documents',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query or question',
        },
        topK: {
          type: 'number',
          description: 'Number of results to return (default: 5)',
        },
        threshold: {
          type: 'number',
          description: 'Minimum relevance score 0-1 (default: 0.3)',
        },
        collection: {
          type: 'string',
          description: 'Filter by collection (optional)',
        },
        tags: {
          type: 'array',
          description: 'Filter by tags (optional)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'kb_store',
    description: 'Store a document in the knowledge base',
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'Document content',
        },
        source: {
          type: 'string',
          description: 'Source type (note, pdf, url, email, etc.)',
        },
        collection: {
          type: 'string',
          description: 'Collection to store in',
        },
        title: {
          type: 'string',
          description: 'Document title (optional)',
        },
        tags: {
          type: 'array',
          description: 'Tags for filtering (optional)',
        },
        url: {
          type: 'string',
          description: 'URL if web document (optional)',
        },
      },
      required: ['content', 'collection', 'source'],
    },
  },
  {
    name: 'kb_list_collections',
    description: 'List all knowledge base collections',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
]

interface KBQueryRequest {
  query: string
  topK?: number
  threshold?: number
  filters?: {
    collection?: string
    source?: string
    tags?: string[]
    dateFrom?: string
    dateTo?: string
  }
}

interface KBQueryResult {
  id: string
  content: string
  relevance: number
  metadata: {
    source: string
    type: string
    title?: string
    date?: string
    collection: string
    url?: string
    tags?: string[]
  }
}

interface KBQueryResponse {
  success: boolean
  results: KBQueryResult[]
  totalResults: number
  executionTime: number
  query: string
  errors?: string[]
}

interface KBStoreRequest {
  content: string
  metadata: {
    source: string
    collection: string
    title?: string
    author?: string
    url?: string
    date?: string
    tags?: string[]
  }
}

interface KBStoreResponse {
  success: boolean
  documentId: string
  indexed: boolean
  message?: string
  errors?: string[]
}

interface KBCollectionsResponse {
  collections: Array<{
    name: string
    description?: string
    documentCount: number
    lastUpdated: string
  }>
}

async function queryKnowledge(
  url: string,
  token: string,
  payload: KBQueryRequest
): Promise<KBQueryResponse> {
  if (!url || !token) {
    return {
      success: false,
      results: [],
      totalResults: 0,
      executionTime: 0,
      query: payload.query,
      errors: ['KB_SERVICE_URL or KB_SERVICE_TOKEN not set'],
    }
  }

  try {
    const response = await fetchWithRetry(
      `${url}/api/agent/knowledge/query`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        timeout: 10000,
      },
      { maxRetries: 3, initialDelayMs: 200 }
    )

    if (!response.ok) {
      return {
        success: false,
        results: [],
        totalResults: 0,
        executionTime: 0,
        query: payload.query,
        errors: [`HTTP ${response.status}`],
      }
    }

    return await response.json()
  } catch (error) {
    return {
      success: false,
      results: [],
      totalResults: 0,
      executionTime: 0,
      query: payload.query,
      errors: [error instanceof Error ? error.message : 'Network error'],
    }
  }
}

async function storeKnowledge(
  url: string,
  token: string,
  payload: KBStoreRequest
): Promise<KBStoreResponse> {
  if (!url || !token) {
    return {
      success: false,
      documentId: '',
      indexed: false,
      errors: ['KB_SERVICE_URL or KB_SERVICE_TOKEN not set'],
    }
  }

  try {
    const response = await fetch(`${url}/api/agent/knowledge/store`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      return {
        success: false,
        documentId: '',
        indexed: false,
        errors: [`HTTP ${response.status}`],
      }
    }

    return await response.json()
  } catch (error) {
    return {
      success: false,
      documentId: '',
      indexed: false,
      errors: [error instanceof Error ? error.message : 'Network error'],
    }
  }
}

async function listCollections(url: string, token: string): Promise<KBCollectionsResponse> {
  if (!url || !token) {
    return { collections: [] }
  }

  try {
    const response = await fetch(`${url}/api/agent/knowledge/collections`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    return { collections: [] }
  }
}

export async function executeKnowledgeServiceTool(
  name: string,
  args: unknown,
  env: Env
): Promise<unknown> {
  const {
    query,
    topK,
    threshold,
    collection,
    tags,
    content,
    source,
    title,
    url,
  } = args as {
    query?: string
    topK?: number
    threshold?: number
    collection?: string
    tags?: string[]
    content?: string
    source?: string
    title?: string
    url?: string
  }

  if (name === 'kb_query') {
    if (!query) {
      return {
        success: false,
        error: 'query parameter required',
      }
    }

    return queryKnowledge(env.KB_SERVICE_URL || '', env.KB_SERVICE_TOKEN || '', {
      query,
      topK,
      threshold,
      filters: {
        collection,
        tags,
      },
    })
  }

  if (name === 'kb_store') {
    if (!content || !collection || !source) {
      return {
        success: false,
        error: 'content, collection, and source parameters required',
      }
    }

    return storeKnowledge(env.KB_SERVICE_URL || '', env.KB_SERVICE_TOKEN || '', {
      content,
      metadata: {
        source,
        collection,
        title,
        url,
        tags,
      },
    })
  }

  if (name === 'kb_list_collections') {
    return listCollections(env.KB_SERVICE_URL || '', env.KB_SERVICE_TOKEN || '')
  }

  throw new Error(`Unknown knowledge service tool: ${name}`)
}
