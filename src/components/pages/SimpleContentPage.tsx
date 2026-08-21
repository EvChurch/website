import RichText from '@/components/blocks/RichTextRenderer'

interface SimpleContentSection {
  id?: string | null
  heading?: string | null
  body: unknown
}

interface SimpleContentPageProps {
  title: string
  updatedAt: string
  sections: SimpleContentSection[]
}

const updatedAtFormatter = new Intl.DateTimeFormat('en-NZ', {
  month: 'long',
  year: 'numeric',
  timeZone: 'Pacific/Auckland',
})

export function SimpleContentPage({
  title,
  updatedAt,
  sections,
}: SimpleContentPageProps) {
  return (
    <section className="bg-warm-white px-5 py-24 lg:px-8 lg:py-32">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rich-red">
          Legal
        </p>
        <h1 className="mt-3 text-display leading-display text-brand-black">
          {title}
        </h1>
        <p className="mt-4 text-sm text-mid-grey">
          Last updated: {updatedAtFormatter.format(new Date(updatedAt))}
        </p>

        <div className="mt-12 space-y-10 text-[0.9375rem] leading-relaxed text-dark-grey">
          {sections.map((section, index) => (
            <div key={section.id ?? `section-${index}`}>
              {section.heading && (
                <h2 className="text-h3 text-brand-black">{section.heading}</h2>
              )}
              <div className="mt-4 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
                <RichText data={section.body} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
