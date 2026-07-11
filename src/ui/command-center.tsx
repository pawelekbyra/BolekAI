import React, { useState } from 'react'

/**
 * Command Center UI — agent operation dashboard
 * Tabs: Chat, Tasks, Approvals, Audit, Memory, Integrations, Settings
 */
export interface CommandCenterProps {
  chatId: number
  agentMode: 'manual' | 'confirm' | 'autonomous'
}

export function CommandCenter({ chatId, agentMode }: CommandCenterProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'approvals' | 'audit' | 'tasks' | 'memory' | 'integrations' | 'settings'>('chat')

  return (
    <div className="command-center">
      <header className="header">
        <h1>Bolek Command Center</h1>
        <div className="mode-badge">{agentMode.toUpperCase()}</div>
      </header>

      <nav className="tabs">
        {(['chat', 'approvals', 'audit', 'tasks', 'memory', 'integrations', 'settings'] as const).map((tab) => (
          <button key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>

      <main className="content">
        {activeTab === 'chat' && <ChatArea chatId={chatId} />}
        {activeTab === 'approvals' && <ApprovalInbox chatId={chatId} />}
        {activeTab === 'audit' && <AuditTimeline chatId={chatId} />}
        {activeTab === 'tasks' && <TaskInbox chatId={chatId} />}
        {activeTab === 'memory' && <MemoryCenter chatId={chatId} />}
        {activeTab === 'integrations' && <IntegrationsStatus />}
        {activeTab === 'settings' && <SettingsPanel />}
      </main>
    </div>
  )
}

function ChatArea({ chatId }: { chatId: number }) {
  return <section className="chat-area"><h2>Chat</h2><p>Chat interface for {chatId}</p></section>
}

export function ApprovalInbox({ chatId }: { chatId: number }) {
  return (
    <section className="approval-inbox">
      <h2>Approval Inbox</h2>
      <div className="approvals-list">
        <p>Pending approvals for {chatId}</p>
      </div>
    </section>
  )
}

export function AuditTimeline({ chatId }: { chatId: number }) {
  return (
    <section className="audit-timeline">
      <h2>Audit Timeline</h2>
      <div className="timeline">
        <p>Event log for {chatId}</p>
      </div>
    </section>
  )
}

function TaskInbox({ chatId }: { chatId: number }) {
  return <section className="task-inbox"><h2>Task Inbox</h2><p>Tasks for {chatId}</p></section>
}

function MemoryCenter({ chatId }: { chatId: number }) {
  return <section className="memory-center"><h2>Memory Center</h2><p>Memory items for {chatId}</p></section>
}

function IntegrationsStatus() {
  return <section className="integrations-status"><h2>Integrations</h2><p>Connector statuses</p></section>
}

function SettingsPanel() {
  return <section className="settings-panel"><h2>Settings</h2><p>Configuration</p></section>
}
