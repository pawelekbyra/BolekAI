import type { Env } from '../../env'
import type { ToolDefinition } from '../index'

export const workflowServiceTools: ToolDefinition[] = [
  {
    name: 'flow_execute_workflow',
    description: 'Execute a workflow in BolekFlow',
    parameters: {
      type: 'object',
      properties: {
        workflowId: {
          type: 'string',
          description: 'ID of the workflow to execute',
        },
        inputs: {
          type: 'object',
          description: 'Input parameters for the workflow',
        },
        timeout: {
          type: 'number',
          description: 'Max execution time in milliseconds (optional)',
        },
      },
      required: ['workflowId'],
    },
  },
  {
    name: 'flow_get_status',
    description: 'Get the status of a workflow execution',
    parameters: {
      type: 'object',
      properties: {
        workflowId: {
          type: 'string',
          description: 'ID of the workflow',
        },
        runId: {
          type: 'string',
          description: 'Execution run ID',
        },
      },
      required: ['workflowId', 'runId'],
    },
  },
  {
    name: 'flow_list_workflows',
    description: 'List all available workflows',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
]

interface ExecuteWorkflowRequest {
  workflowId: string
  inputs?: Record<string, unknown>
  timeout?: number
  idempotencyKey?: string
}

interface ExecuteWorkflowResponse {
  success: boolean
  runId: string
  status: 'running' | 'completed' | 'failed'
  output?: Record<string, unknown>
  executionTime: number
  logsUrl?: string
  errors?: string[]
}

interface WorkflowStatusResponse {
  runId: string
  status: 'running' | 'completed' | 'failed'
  progress?: number
  output?: Record<string, unknown>
  startedAt: string
  completedAt?: string
  duration?: number
}

interface WorkflowListResponse {
  workflows: Array<{
    id: string
    name: string
    description: string
    version: string
    triggers: string[]
    riskLevel: string
    requiredApproval: boolean
  }>
}

async function executeWorkflow(
  url: string,
  token: string,
  payload: ExecuteWorkflowRequest
): Promise<ExecuteWorkflowResponse> {
  if (!url || !token) {
    return {
      success: false,
      runId: '',
      status: 'failed',
      executionTime: 0,
      errors: ['FLOW_SERVICE_URL or FLOW_SERVICE_TOKEN not set'],
    }
  }

  try {
    const response = await fetch(`${url}/api/agent/workflows/execute`, {
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
        runId: '',
        status: 'failed',
        executionTime: 0,
        errors: [`HTTP ${response.status}`],
      }
    }

    return await response.json()
  } catch (error) {
    return {
      success: false,
      runId: '',
      status: 'failed',
      executionTime: 0,
      errors: [error instanceof Error ? error.message : 'Network error'],
    }
  }
}

async function getWorkflowStatus(
  url: string,
  token: string,
  workflowId: string,
  runId: string
): Promise<WorkflowStatusResponse> {
  if (!url || !token) {
    throw new Error('FLOW_SERVICE_URL or FLOW_SERVICE_TOKEN not set')
  }

  try {
    const response = await fetch(
      `${url}/api/agent/workflows/${encodeURIComponent(workflowId)}/status/${encodeURIComponent(runId)}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    throw new Error(
      `Failed to get workflow status: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

async function listWorkflows(url: string, token: string): Promise<WorkflowListResponse> {
  if (!url || !token) {
    return { workflows: [] }
  }

  try {
    const response = await fetch(`${url}/api/agent/workflows/list`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    return {
      workflows: [],
    }
  }
}

export async function executeWorkflowServiceTool(
  name: string,
  args: unknown,
  env: Env
): Promise<unknown> {
  const { workflowId, inputs, timeout, runId } = args as {
    workflowId?: string
    inputs?: Record<string, unknown>
    timeout?: number
    runId?: string
  }

  if (name === 'flow_execute_workflow') {
    if (!workflowId) {
      return {
        success: false,
        error: 'workflowId parameter required',
      }
    }

    return executeWorkflow(env.FLOW_SERVICE_URL || '', env.FLOW_SERVICE_TOKEN || '', {
      workflowId,
      inputs,
      timeout,
    })
  }

  if (name === 'flow_get_status') {
    if (!workflowId || !runId) {
      return {
        error: 'workflowId and runId parameters required',
      }
    }

    try {
      return await getWorkflowStatus(
        env.FLOW_SERVICE_URL || '',
        env.FLOW_SERVICE_TOKEN || '',
        workflowId,
        runId
      )
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  if (name === 'flow_list_workflows') {
    return listWorkflows(env.FLOW_SERVICE_URL || '', env.FLOW_SERVICE_TOKEN || '')
  }

  throw new Error(`Unknown workflow service tool: ${name}`)
}
