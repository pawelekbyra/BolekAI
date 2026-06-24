import type { ToolRisk } from './tool-types';

export type ToolDecision = 'allow' | 'approval_required' | 'strong_approval_required' | 'deny';

export function getToolDecision(risk?: ToolRisk): ToolDecision {
  switch (risk) {
    case 'read':
    case 'draft':
      return 'allow';
    case 'write_low_risk':
    case 'external_action':
      return 'approval_required';
    case 'money':
    case 'destructive':
      return 'strong_approval_required';
    case 'blocked':
      return 'deny';
    default:
      return 'approval_required';
  }
}

export function requiresApproval(risk?: ToolRisk): boolean {
  const decision = getToolDecision(risk);
  return decision === 'approval_required' || decision === 'strong_approval_required';
}

export function canExecuteWithoutApproval(risk?: ToolRisk): boolean {
  return getToolDecision(risk) === 'allow';
}
