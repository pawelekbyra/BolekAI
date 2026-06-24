import { requiresApproval } from './agent/permission-engine';
import { toolRegistry } from './agent/tool-registry';

export const TOOLS_REQUIRING_APPROVAL = Object.values(toolRegistry)
  .filter((tool) => requiresApproval(tool.risk))
  .map((tool) => tool.name);
