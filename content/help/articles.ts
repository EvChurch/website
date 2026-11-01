export interface HelpArticleDefinition {
  slug: string
  title: string
  description: string
  topic: string
  audience: string
  access: 'public' | 'members'
}

export const helpArticles: HelpArticleDefinition[] = [
  { slug: 'giving-and-payment-methods', title: 'Give by bank or card', description: 'Choose a payment method, check fees, and understand your giving confirmation.', topic: 'Giving', audience: 'Givers', access: 'public' },
  { slug: 'manage-recurring-giving', title: 'Manage recurring giving', description: 'View giving, update a card, or stop and replace a recurring arrangement.', topic: 'Giving', audience: 'Givers', access: 'members' },
  { slug: 'giving-finance-export', title: 'Export giving for finance', description: 'Download payment records and distinguish giving confirmations from payouts.', topic: 'Giving', audience: 'Finance administrators', access: 'members' },
  {
    slug: 'claim-an-expense',
    title: 'Claim an expense',
    description: 'Choose a purpose and payout account, enter receipt amounts with optional Advanced GST controls, and follow approval and payment.',
    topic: 'Reimbursements', audience: 'Claimants', access: 'members',
  },
  {
    slug: 'approve-an-expense',
    title: 'Approve expenses for your purpose',
    description: 'Find reports waiting for you, check expenses and receipts, and approve or reject a report.',
    topic: 'Reimbursements', audience: 'Purpose approvers', access: 'members',
  },
  {
    slug: 'finance-reimbursements',
    title: 'Review and pay reimbursements',
    description: 'Complete finance approval, prepare payments, and confirm paid reports in the payment queue.',
    topic: 'Reimbursements', audience: 'Finance', access: 'members',
  },
]
