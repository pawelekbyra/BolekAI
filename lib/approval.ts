/**
 * List of tool names that require explicit user confirmation in the UI.
 * When a tool is in this list, the server will not execute it automatically.
 * Instead, it will wait for the client to call executeApprovedTool.
 */
export const TOOLS_REQUIRING_APPROVAL: string[] = [
  'createGithubIssue',
  'createJulesTaskIssue',
];
