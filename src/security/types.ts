export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export type PolicyDecision =
  | { type: 'allow' }
  | { type: 'deny'; reason: string }
  | { type: 'require_approval'; reason: string }
