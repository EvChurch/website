import { ConnectGroupsFinder } from '@/components/connect-groups/ConnectGroupsFinder'
import { getPublicConnectGroups } from '@/lib/connect-groups/public'

export async function ConnectGroupsBlockComponent({
  eyebrow = 'Find your people',
  heading = 'Find a Connect Group',
  description = 'Explore Connect Groups across Auckland and choose one that works for you.',
}: {
  eyebrow?: string | null
  heading?: string | null
  description?: string | null
}) {
  const groups = await getPublicConnectGroups()

  if (groups.length === 0) return null

  return (
    <section
      id="find-a-connect-group"
      className="scroll-mt-24 bg-warm-white px-5 py-20 lg:scroll-mt-28 lg:px-8 lg:py-28"
    >
      <div className="mx-auto max-w-[80rem]">
        <div className="max-w-3xl">
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-widest text-rich-red">
              {eyebrow}
            </p>
          )}
          {heading && (
            <h2 className="mt-2 text-[clamp(2rem,4vw,3.5rem)] leading-tight tracking-[-0.03em] text-brand-black">
              {heading}
            </h2>
          )}
          {description && (
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-dark-grey">
              {description}
            </p>
          )}
        </div>
        <div className="mt-10">
          <ConnectGroupsFinder groups={groups} />
        </div>
      </div>
    </section>
  )
}
