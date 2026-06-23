'use server';

import { githubTools } from './tools';
import { TOOLS_REQUIRING_APPROVAL } from './approval';

/**
 * Server Action to execute a tool that required user approval.
 * This ensures the execution happens on the server with access to environment variables.
 */
export async function executeApprovedTool(toolName: string, args: any) {
  // Security check: only allow tools that are explicitly in the approval whitelist
  if (!TOOLS_REQUIRING_APPROVAL.includes(toolName)) {
    throw new Error(`Narzędzie ${toolName} nie znajduje się na liście wymagającej potwierdzenia.`);
  }

  console.log(`Executing approved tool: ${toolName}`);

  // Find the tool in the consolidated tools object
  const tool = (githubTools as any)[toolName];

  if (!tool) {
    throw new Error(`Narzędzie ${toolName} nie zostało znalezione.`);
  }

  if (!tool.execute) {
    throw new Error(`Narzędzie ${toolName} nie posiada funkcji wykonawczej na serwerze.`);
  }

  try {
    const result = await tool.execute(args);
    return result;
  } catch (error: any) {
    console.error(`Error executing tool ${toolName}:`, error);
    throw new Error(error.message || 'Wystąpił błąd podczas wykonywania narzędzia.');
  }
}
