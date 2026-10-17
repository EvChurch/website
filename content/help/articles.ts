export interface HelpArticleDefinition {
  slug: string
  title: string
  description: string
  topic: string
  audience: string
  access: 'public' | 'members'
}

export const helpArticles: HelpArticleDefinition[] = [
  {
    slug: 'claim-an-expense',
    title: 'Claim an expense',
    description: 'Set up your payment details, add receipts, and follow your report through approval and payment.',
    topic: 'Reimbursements', audience: 'Claimants', access: 'public',
  },
  {
    slug: 'approve-an-expense',
    title: 'Approve expenses for your purpose',
    description: 'Find reports waiting for you, check expenses and receipts, and approve or reject a report.',
    topic: 'Reimbursements', audience: 'Purpose approvers', access: 'public',
  },
  {
    slug: 'finance-reimbursements',
    title: 'Review and pay reimbursements',
    description: 'Complete finance approval, prepare payments, and confirm paid reports in the payment queue.',
    topic: 'Reimbursements', audience: 'Finance', access: 'public',
  },
]
