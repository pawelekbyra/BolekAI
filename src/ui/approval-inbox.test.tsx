import { describe, it, expect } from 'vitest'
import React from 'react'
import { ApprovalInbox } from './command-center'

describe('ApprovalInbox', () => {
  it('renders approval inbox component', () => {
    const { container } = render(<ApprovalInbox chatId={123} />)
    expect(container.querySelector('.approval-inbox')).toBeTruthy()
  })

  it('displays empty state when no approvals', () => {
    const { getByText } = render(<ApprovalInbox chatId={123} />)
    expect(getByText(/pending approvals/i)).toBeTruthy()
  })
})
