import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { helpArticles, type HelpArticleDefinition } from '../../../content/help/articles'

export type HelpArticle = HelpArticleDefinition & { body: string }

export async function readHelpArticle(definition: HelpArticleDefinition): Promise<HelpArticle> {
  // Only catalogued files are read; URL parameters never become filesystem paths.
  const body = await readFile(path.join(process.cwd(), 'content/help', `${definition.slug}.md`), 'utf8')
  return { ...definition, body }
}

export async function listHelpArticles(member: boolean): Promise<HelpArticle[]> {
  return Promise.all(helpArticles.filter(article => article.access === 'public' || member).map(readHelpArticle))
}

export function searchHelpArticles(articles: HelpArticle[], query: string, topic = '', audience = '') {
  const terms = query.toLocaleLowerCase('en-NZ').trim().split(/\s+/u).filter(Boolean)
  return articles.filter(article => (!topic || article.topic === topic) && (!audience || article.audience === audience)
    && terms.every(term => `${article.title} ${article.description} ${article.body}`.toLocaleLowerCase('en-NZ').includes(term)))
}
