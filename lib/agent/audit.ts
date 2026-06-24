export type AuditStatus = 'requested' | 'approved' | 'succeeded' | 'failed';

export type AuditEvent = {
  id: string;
  createdAt: string;
  toolName: string;
  status: AuditStatus;
  requiresApproval: boolean;
  risk?: string;
  input?: unknown;
  output?: unknown;
  error?: string;
};

const MAX_AUDIT_EVENTS = 100;
const SENSITIVE_KEY_PATTERN = /token|secret|password|authorization|api[_-]?key|private[_-]?key/i;

const auditEvents: AuditEvent[] = [];

function createAuditId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function redactAuditPayload(value: unknown, depth = 0): unknown {
  if (depth > 6) {
    return '[REDACTED_DEPTH_LIMIT]';
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactAuditPayload(item, depth + 1));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? '[REDACTED]' : redactAuditPayload(entryValue, depth + 1),
    ]),
  );
}

export function recordAuditEvent(event: Omit<AuditEvent, 'id' | 'createdAt'>): AuditEvent {
  const auditEvent: AuditEvent = {
    ...event,
    id: createAuditId(),
    createdAt: new Date().toISOString(),
    input: redactAuditPayload(event.input),
    output: redactAuditPayload(event.output),
  };

  auditEvents.unshift(auditEvent);

  if (auditEvents.length > MAX_AUDIT_EVENTS) {
    auditEvents.length = MAX_AUDIT_EVENTS;
  }

  return auditEvent;
}

export function getAuditEvents(limit = 50): AuditEvent[] {
  return auditEvents.slice(0, Math.max(0, Math.min(limit, MAX_AUDIT_EVENTS)));
}
