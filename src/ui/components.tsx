import React, { useState, useEffect } from 'react'

export interface Approval {
  id: string
  toolName: string
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  preview: string
  expiresAt: number
  status: 'pending' | 'approved' | 'denied'
}

export interface AuditEvent {
  id: string
  timestamp: number
  type: string
  tool: string
  status: 'success' | 'failure' | 'pending'
  message: string
}

export interface Task {
  id: string
  title: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: 'low' | 'medium' | 'high'
  dueAt?: number
}

export interface ChatMessage {
  id: string
  timestamp: number
  role: 'user' | 'agent'
  content: string
}

export interface MemoryEntry {
  id: string
  key: string
  value: unknown
  updatedAt: number
}

export interface AgentRun {
  id: string
  startedAt: number
  endedAt?: number
  status: 'running' | 'completed' | 'failed'
  toolsCalled: string[]
}

export interface ProjectStatus {
  name: string
  status: 'healthy' | 'warning' | 'critical'
  lastCheck: number
}

export function ApprovalInboxFull({ chatId, approvals }: { chatId: number; approvals: Approval[] }) {
  return (
    <section className="approval-inbox">
      <h2>Approval Inbox ({approvals.length})</h2>
      <div className="approvals-list">
        {approvals.length === 0 ? (
          <p className="empty-state">No pending approvals</p>
        ) : (
          approvals.map((approval) => (
            <div key={approval.id} className={`approval-card risk-${approval.riskLevel}`}>
              <div className="approval-header">
                <strong>{approval.toolName}</strong>
                <span className="risk-badge">{approval.riskLevel.toUpperCase()}</span>
              </div>
              <p className="preview">{approval.preview}</p>
              <div className="approval-actions">
                <button className="btn-approve">Approve</button>
                <button className="btn-deny">Deny</button>
                <span className="expires">Expires: {new Date(approval.expiresAt).toLocaleString()}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

export function AuditTimelineFull({ chatId, events }: { chatId: number; events: AuditEvent[] }) {
  return (
    <section className="audit-timeline">
      <h2>Audit Timeline ({events.length} events)</h2>
      <div className="timeline">
        {events.length === 0 ? (
          <p className="empty-state">No events yet</p>
        ) : (
          events
            .sort((a, b) => b.timestamp - a.timestamp)
            .map((event) => (
              <div key={event.id} className={`event event-${event.status}`}>
                <time>{new Date(event.timestamp).toLocaleString()}</time>
                <div className="event-detail">
                  <strong>{event.type}</strong>: {event.tool}
                  <p>{event.message}</p>
                </div>
              </div>
            ))
        )}
      </div>
    </section>
  )
}

export function TaskInboxFull({ chatId, tasks }: { chatId: number; tasks: Task[] }) {
  return (
    <section className="task-inbox">
      <h2>Task Inbox ({tasks.filter((t) => t.status !== 'completed').length} active)</h2>
      <div className="tasks-list">
        {tasks.length === 0 ? (
          <p className="empty-state">No tasks</p>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className={`task-card status-${task.status}`}>
              <input type="checkbox" checked={task.status === 'completed'} />
              <div className="task-info">
                <strong>{task.title}</strong>
                <span className="priority">{task.priority}</span>
              </div>
              {task.dueAt && <span className="due">{new Date(task.dueAt).toLocaleDateString()}</span>}
            </div>
          ))
        )}
      </div>
    </section>
  )
}

export function IntegrationsStatusFull() {
  const connectors = [
    { name: 'GitHub', status: 'online', scopes: ['read', 'write'] },
    { name: 'Vercel', status: 'online', scopes: ['read', 'deploy'] },
    { name: 'Email', status: 'online', scopes: ['read', 'send'] },
    { name: 'Stripe', status: 'online', scopes: ['read', 'refund'] },
    { name: 'Clerk', status: 'online', scopes: ['read'] },
    { name: 'Polutek', status: 'online', scopes: ['read', 'ops'] },
  ]

  return (
    <section className="integrations-status">
      <h2>Integration Status</h2>
      <div className="integrations-grid">
        {connectors.map((connector) => (
          <div key={connector.name} className={`connector-card status-${connector.status}`}>
            <h3>{connector.name}</h3>
            <div className="status-indicator">{connector.status}</div>
            <div className="scopes">{connector.scopes.join(', ')}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

export function ChatViewFull({ chatId, messages }: { chatId: number; messages: ChatMessage[] }) {
  const [inputValue, setInputValue] = useState('')

  return (
    <section className="chat-view">
      <div className="messages-container">
        {messages.length === 0 ? (
          <p className="empty-state">No messages yet</p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`message message-${msg.role}`}>
              <time>{new Date(msg.timestamp).toLocaleTimeString()}</time>
              <p>{msg.content}</p>
            </div>
          ))
        )}
      </div>
      <div className="chat-input">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Message Bolek..."
        />
        <button>Send</button>
      </div>
    </section>
  )
}

export function MemoryCenterFull({ chatId, entries }: { chatId: number; entries: MemoryEntry[] }) {
  return (
    <section className="memory-center">
      <h2>Memory Center ({entries.length} entries)</h2>
      <div className="memory-list">
        {entries.length === 0 ? (
          <p className="empty-state">No memory entries</p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="memory-card">
              <strong>{entry.key}</strong>
              <code>{JSON.stringify(entry.value)}</code>
              <small>Updated: {new Date(entry.updatedAt).toLocaleString()}</small>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

export function ProjectDashboardFull({ projects }: { projects: ProjectStatus[] }) {
  return (
    <section className="project-dashboard">
      <h2>Project Status</h2>
      <div className="projects-list">
        {projects.length === 0 ? (
          <p className="empty-state">No projects</p>
        ) : (
          projects.map((project) => (
            <div key={project.name} className={`project-card status-${project.status}`}>
              <h3>{project.name}</h3>
              <div className="status-badge">{project.status.toUpperCase()}</div>
              <small>Last check: {new Date(project.lastCheck).toLocaleString()}</small>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

export function DailyBriefingFull({ chatId }: { chatId: number }) {
  const [briefing, setBriefing] = useState<string>('')

  useEffect(() => {
    fetch(`/api/briefing?chatId=${chatId}`)
      .then((r) => r.json())
      .then((data) => setBriefing(data.content))
      .catch(() => setBriefing('Failed to load briefing'))
  }, [chatId])

  return (
    <section className="daily-briefing">
      <h2>Daily Briefing</h2>
      <div className="briefing-content">{briefing || 'Loading...'}</div>
    </section>
  )
}

export function AgentRunsViewFull({ chatId, runs }: { chatId: number; runs: AgentRun[] }) {
  return (
    <section className="agent-runs">
      <h2>Agent Runs ({runs.length})</h2>
      <div className="runs-list">
        {runs.length === 0 ? (
          <p className="empty-state">No runs</p>
        ) : (
          runs.map((run) => (
            <div key={run.id} className={`run-card status-${run.status}`}>
              <div className="run-header">
                <strong>Run {run.id.slice(0, 8)}</strong>
                <span className="status-badge">{run.status.toUpperCase()}</span>
              </div>
              <small>Started: {new Date(run.startedAt).toLocaleString()}</small>
              {run.endedAt && <small>Ended: {new Date(run.endedAt).toLocaleString()}</small>}
              <div className="tools-used">{run.toolsCalled.join(', ')}</div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

export function SettingsFull({ chatId, agentMode }: { chatId: number; agentMode: string }) {
  const [mode, setMode] = useState(agentMode)
  const [readOnly, setReadOnly] = useState(false)

  return (
    <section className="settings">
      <h2>Settings</h2>
      <div className="settings-form">
        <div className="setting">
          <label>Agent Mode</label>
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="manual">Manual</option>
            <option value="confirm">Confirm</option>
            <option value="autonomous">Autonomous</option>
          </select>
        </div>
        <div className="setting">
          <label>
            <input type="checkbox" checked={readOnly} onChange={(e) => setReadOnly(e.target.checked)} />
            Read-only Mode
          </label>
        </div>
        <button>Save Settings</button>
      </div>
    </section>
  )
}

export function EmergencyStopButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="btn-emergency-stop" onClick={onClick}>
      🚨 Emergency Stop
    </button>
  )
}
