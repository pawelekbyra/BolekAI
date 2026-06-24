export type ToolRisk =
  | 'read'
  | 'draft'
  | 'write_low_risk'
  | 'external_action'
  | 'money'
  | 'destructive'
  | 'blocked';

export type ToolDomain = 'github' | 'vercel' | 'jules' | string;

export type KulfonToolName =
  | 'getRepoInfo'
  | 'listOpenIssues'
  | 'createGithubIssue'
  | 'createJulesTaskIssue'
  | 'listVercelDeployments';

export type KulfonToolManifest = {
  name: KulfonToolName;
  description: string;
  domain: ToolDomain;
  risk: ToolRisk;
  requiresApproval: boolean;
};
