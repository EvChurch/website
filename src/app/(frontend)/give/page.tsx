import DynamicPage, { generateMetadata as generateDynamicMetadata } from '../[slug]/page'

export const revalidate = 86400

function giveParams() {
  return Promise.resolve({ slug: 'give' })
}

export function generateMetadata() {
  return generateDynamicMetadata({ params: giveParams() })
}

export default function GivePage() {
  return DynamicPage({ params: giveParams() })
}
