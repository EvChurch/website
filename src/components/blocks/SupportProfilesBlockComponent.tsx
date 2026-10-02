import { MediaImage } from '@/components/media/MediaImage'
import { Button } from '@/components/ui/Button'
import { getCachedPublicSupportProfiles } from '@/lib/giving/support-profiles'

export async function SupportProfilesBlockComponent({ id, group, heading, description }: { id?: string; group?: 'apprentices' | 'student-ministers' | null; heading?: string | null; description?: string | null }) {
  const profiles = (await getCachedPublicSupportProfiles()).filter((profile) => !group || profile.group === group)
  if (!profiles.length) return null
  return <section id={id} className="scroll-mt-20 border-t-2 border-warm-grey bg-warm-white px-5 py-24 lg:px-8 lg:py-32">
    <div className="mx-auto max-w-[80rem]">
      <h2 className="text-h3 text-brand-black">{heading || description || (group === 'student-ministers' ? 'Student ministers' : 'Apprentices')}</h2>
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {profiles.map((profile) => <article key={profile.id} className="flex flex-col overflow-hidden rounded-xl bg-white">
          {profile.photo && <div className="relative aspect-[4/5]"><MediaImage media={profile.photo} mediaSize="medium" preferOriginalWhenRequestedSizeMissing fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover" /></div>}
          <div className="flex flex-1 flex-col p-7">
            <h3 className="text-h4 text-brand-black">{profile.name}</h3>
            <p className="mt-2 text-sm font-semibold text-rich-red">{profile.group === 'student-ministers' ? 'Student minister' : 'Apprentice'}</p>
            <p className="mt-4 text-[0.9375rem] leading-relaxed text-dark-grey">{profile.blurb}</p>
            <a href={`mailto:${profile.email}`} className="mt-5 text-xs text-rich-red">{profile.email}</a>
            {profile.fundId !== null && <div className="mt-auto pt-6"><Button href={`?launcher=give&fund=${encodeURIComponent(profile.slug)}`} variant="primary">Give</Button></div>}
          </div>
        </article>)}
      </div>
    </div>
  </section>
}
