type PageRecord = Record<string, unknown>

export type PageUpgrade = (
  document: PageRecord,
  desired: PageRecord,
) => PageRecord | null

function record(value: unknown): PageRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as PageRecord)
    : null
}

function blocks(page: PageRecord): PageRecord[] {
  return Array.isArray(page.layout)
    ? page.layout.filter((block): block is PageRecord => Boolean(record(block)))
    : []
}

function desiredBlock(
  desired: PageRecord,
  predicate: (block: PageRecord) => boolean,
): PageRecord | null {
  return blocks(desired).find(predicate) || null
}

function withoutIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutIds)
  const object = record(value)
  if (!object) return value
  return Object.fromEntries(
    Object.entries(object)
      .filter(([key]) => key !== 'id')
      .map(([key, child]) => [key, withoutIds(child)]),
  )
}

function matches(value: unknown, legacy: unknown): boolean {
  return JSON.stringify(withoutIds(value)) === JSON.stringify(legacy)
}

function preserveItemIds(current: unknown, desired: unknown): unknown {
  if (!Array.isArray(current) || !Array.isArray(desired)) return desired
  return desired.map((item, index) => {
    const currentItem = record(current[index])
    const nextItem = record(item)
    return currentItem?.id && nextItem ? { ...nextItem, id: currentItem.id } : item
  })
}

export const upgradeLegacyHomePage: PageUpgrade = (document, desired) => {
  const layout = blocks(document)
  const heroIndex = layout.findIndex(
    (block) =>
      block.blockType === 'hero' &&
      block.eyebrow === 'A Christian Evangelical Church in Auckland',
  )
  const nextHero = desiredBlock(desired, (block) => block.blockType === 'hero')
  if (heroIndex < 0 || !nextHero) return null

  const hero = { ...layout[heroIndex] }
  const legacyFields: Record<string, unknown> = {
    eyebrow: 'A Christian Evangelical Church in Auckland',
    semanticH1: true,
    subtitle:
      'Ev Church is a community of Christ-followers across Auckland. Whether you are exploring faith for the first time or have been part of a church for years, you are welcome here.',
    minHeight: '85vh',
    buttons: [
      { label: 'Plan Your Visit', href: '/visit', variant: 'primary' },
      { label: 'Learn about us', href: '/about', variant: 'text' },
    ],
  }
  for (const [field, legacy] of Object.entries(legacyFields)) {
    if (!matches(hero[field], legacy)) continue
    hero[field] =
      field === 'buttons'
        ? preserveItemIds(hero[field], nextHero[field])
        : nextHero[field]
  }
  layout[heroIndex] = hero

  const currentSeo = record(document.seo)
  const desiredSeo = record(desired.seo)
  const seo =
    currentSeo?.metaTitle ===
      'Church in Auckland | Ev Church | Sunday Services & Community' &&
    desiredSeo?.metaTitle
      ? { ...currentSeo, metaTitle: desiredSeo.metaTitle }
      : currentSeo

  return { layout, ...(seo ? { seo } : {}) }
}

export const upgradeLegacyVisitPage: PageUpgrade = (document, desired) => {
  const layout = blocks(document)
  const featureIndex = layout.findIndex(
    (block) => block.blockType === 'featureGrid' && block.heading === 'Your first Sunday at Ev',
  )
  const nextFeature = desiredBlock(
    desired,
    (block) => block.blockType === 'featureGrid' && block.heading === 'What actually happens in a service?',
  )
  const nextCta = desiredBlock(
    desired,
    (block) => block.blockType === 'cta' && String(block.heading).startsWith('Will I be asked'),
  )
  if (featureIndex < 0 || !nextFeature || !nextCta) return null

  const currentFeature = { ...layout[featureIndex] }
  if (currentFeature.heading === 'Your first Sunday at Ev') {
    currentFeature.heading = nextFeature.heading
  }
  if (
    currentFeature.description ===
    'We want you to feel comfortable from the moment you walk in. Here is what you can expect when visiting Ev Church on a Sunday in Auckland.'
  ) {
    currentFeature.description = nextFeature.description
  }
  const legacyItems = [
    {
      icon: 'smile',
      title: 'Relaxed services',
      description:
        'No dress code. No pressure. Our services run about 75 minutes with live music, a practical message, and time to connect.',
    },
    {
      icon: 'graduation',
      title: 'Kids program',
      description:
        'Ev Kids runs every Sunday morning at North and Central for children aged 0 to 12. Careful check-in, matched pick-up, and police-vetted, trained leaders. Allow an extra ten minutes on your first visit.',
    },
    {
      icon: 'coffee',
      title: 'Great coffee',
      description:
        'Arrive a few minutes early and grab a complimentary coffee. Our cafe is a great place to meet people before the service.',
    },
    {
      icon: 'users',
      title: 'Friendly community',
      description:
        'Our welcome team will help you find a seat, point you to kids check-in, and answer any questions. You will feel at home.',
    },
  ]
  if (matches(currentFeature.items, legacyItems)) {
    currentFeature.items = preserveItemIds(currentFeature.items, nextFeature.items)
  }
  layout[featureIndex] = currentFeature
  if (!layout.some((block) => block.heading === nextCta.heading)) {
    layout.splice(featureIndex + 1, 0, nextCta)
  }

  const nextForm = desiredBlock(
    desired,
    (block) => block.blockType === 'formEmbed' && typeof block.rockWorkflowGuid === 'string',
  )
  if (nextForm) {
    for (let index = 0; index < layout.length; index += 1) {
      const block = layout[index]
      if (
        block.blockType === 'formEmbed' &&
        String(block.rockWorkflowGuid).toLowerCase() ===
          'de3d06a6-7fca-41a5-8c37-a485767de970'
      ) {
        layout[index] = {
          ...block,
          fallbackContactLabel: nextForm.fallbackContactLabel,
          fallbackContactHref: nextForm.fallbackContactHref,
        }
      }
    }
  }

  return { layout }
}

export const upgradeLegacyAboutPage: PageUpgrade = (document, desired) => {
  const layout = blocks(document)
  const contentIndex = layout.findIndex(
    (block) =>
      block.blockType === 'content' &&
      JSON.stringify(block.body).includes(
        'While every member of Ev Church is called to serve',
      ) &&
      !JSON.stringify(block.body).includes('Every email below is real and read'),
  )
  const nextContent = desiredBlock(
    desired,
    (block) =>
      block.blockType === 'content' &&
      JSON.stringify(block.body).includes('Every email below is real and read'),
  )
  if (contentIndex < 0 || !nextContent) return null

  const body = record(layout[contentIndex].body)
  const root = record(body?.root)
  const nextBody = record(nextContent.body)
  const nextRoot = record(nextBody?.root)
  const children = Array.isArray(root?.children) ? root.children : null
  const nextChildren = Array.isArray(nextRoot?.children) ? nextRoot.children : null
  const paragraph = nextChildren?.at(-1)
  if (!body || !root || !children || !paragraph) return null

  layout[contentIndex] = {
    ...layout[contentIndex],
    body: { ...body, root: { ...root, children: [...children, paragraph] } },
  }
  return { layout }
}

export const upgradeLegacyConnectGroupsPage: PageUpgrade = (document) => {
  const layout = blocks(document)
  const nextLayout = layout.filter(
    (block) =>
      !(
        block.blockType === 'manualCardGrid' &&
        block.heading === 'Groups for every season of life'
      ),
  )

  return nextLayout.length === layout.length ? null : { layout: nextLayout }
}

export const upgradeLegacyBeliefsPage: PageUpgrade = (document, desired) => {
  const layout = blocks(document)
  const desiredLayout = blocks(desired)
  let changed = false

  for (let index = 0; index < layout.length; index += 1) {
    const block = layout[index]
    if (
      block.blockType === 'pageHeader' &&
      block.description ===
        'Ev Church is an evangelical church that is independent in governance but united with Christians around the world and throughout history in upholding the gospel of Jesus Christ. We hold the Bible to be the supreme authority in all matters of faith and conduct and weigh all our teaching against its standard.'
    ) {
      const target = desiredLayout.find((candidate) => candidate.blockType === 'pageHeader')
      if (target) {
        layout[index] = { ...block, description: target.description }
        changed = true
      }
      continue
    }

    if (block.blockType === 'content' && block.heading === 'Our foundational convictions') {
      const body = record(block.body)
      const root = record(body?.root)
      const children = Array.isArray(root?.children) ? root.children : null
      const target = desiredLayout.find(
        (candidate) => candidate.blockType === 'content' && candidate.heading === block.heading,
      )
      const targetBody = record(target?.body)
      const targetRoot = record(targetBody?.root)
      const targetChildren = Array.isArray(targetRoot?.children) ? targetRoot.children : null
      const introduction = targetChildren?.[0]
      if (
        body &&
        root &&
        children &&
        introduction &&
        !JSON.stringify(children).includes('Ev Church is an evangelical church')
      ) {
        layout[index] = {
          ...block,
          body: { ...body, root: { ...root, children: [introduction, ...children] } },
        }
        changed = true
      }
      continue
    }

    if (block.blockType === 'accordion' && block.heading === 'What we believe') {
      const items = Array.isArray(block.items) ? block.items : null
      const target = desiredLayout.find(
        (candidate) => candidate.blockType === 'accordion' && candidate.heading === block.heading,
      )
      const targetItems = Array.isArray(target?.items) ? target.items : null
      if (!items || !targetItems) continue

      const nextItems = items.map((item) => {
        const current = record(item)
        if (!current || typeof current.answer !== 'string') return item
        const desiredItem = targetItems
          .map(record)
          .find((candidate) => candidate?.question === current.question)
        if (
          !desiredItem ||
          typeof desiredItem.answer !== 'string' ||
          !desiredItem.answer.startsWith(current.answer) ||
          desiredItem.answer === current.answer
        ) {
          return item
        }
        changed = true
        return { ...current, answer: desiredItem.answer }
      })
      layout[index] = { ...block, items: nextItems }
    }
  }

  return changed ? { layout } : null
}
