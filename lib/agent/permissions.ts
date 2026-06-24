import type { KulfonToolManifest, ToolRisk } from './tool-types';
import { getToolManifest } from './tool-registry';

const RISKS_REQUIRING_APPROVAL = new Set<ToolRisk>([
  'write_low_risk',
  'external_action',
  'money',
  'destructive',
  'blocked',
]);

export type ToolPermissionDecision = {
  toolName: string;
  manifest?: KulfonToolManifest;
  risk: ToolRisk;
  allowed: boolean;
  requiresApproval: boolean;
  reason: string;
};

export function riskRequiresApproval(risk: ToolRisk): boolean {
  return RISKS_REQUIRING_APPROVAL.has(risk);
}

export function getToolPermissionDecision(toolName: string): ToolPermissionDecision {
  const manifest = getToolManifest(toolName);

  if (!manifest) {
    return {
      toolName,
      risk: 'blocked',
      allowed: false,
      requiresApproval: true,
      reason: `Narzędzie ${toolName} nie jest zarejestrowane w Tool Registry.`,
    };
  }

  if (manifest.risk === 'blocked') {
    return {
      toolName,
      manifest,
      risk: manifest.risk,
      allowed: false,
      requiresApproval: true,
      reason: `Narzędzie ${toolName} jest zablokowane przez Permission Engine.`,
    };
  }

  const requiresApproval = manifest.requiresApproval || riskRequiresApproval(manifest.risk);

  return {
    toolName,
    manifest,
    risk: manifest.risk,
    allowed: true,
    requiresApproval,
    reason: requiresApproval
      ? `Narzędzie ${toolName} wymaga potwierdzenia przed wykonaniem.`
      : `Narzędzie ${toolName} może zostać wykonane bez potwierdzenia.`,
  };
}

export function assertToolMayBePresentedToAgent(toolName: string): ToolPermissionDecision {
  const decision = getToolPermissionDecision(toolName);

  if (!decision.allowed) {
    throw new Error(decision.reason);
  }

  return decision;
}

export function assertApprovedToolExecutionAllowed(toolName: string): ToolPermissionDecision {
  const decision = assertToolMayBePresentedToAgent(toolName);

  if (!decision.requiresApproval) {
    throw new Error(`Narzędzie ${toolName} nie wymaga approval i nie powinno przechodzić przez executeApprovedTool.`);
  }

  return decision;
}
