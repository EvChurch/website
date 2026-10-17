import { getCurrentMemberProfile } from '@/auth/member-session'
import { helpArticles } from '../../../content/help/articles'

export async function canReadMemberHelp() {
  // Public-only catalogues need neither a session nor a Rock lookup.
  return helpArticles.some(article => article.access === 'members') && Boolean(await getCurrentMemberProfile())
}
