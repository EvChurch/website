import type { Metadata } from 'next'
import { ManualCardGridBlockComponent } from '@/components/blocks/ManualCardGridBlockComponent'
import { GivingCalculator } from '@/components/generosity/GivingCalculator'
import { CTABlockComponent } from '@/components/blocks/CTABlockComponent'

export const metadata: Metadata = {
  title: 'Help me work out my giving',
  description:
    'Think through your giving and explore a next step. Your figures stay on your device.',
  alternates: { canonical: 'https://www.ev.church/generosity/calculator' },
}

export default function GivingCalculatorPage() {
  return (
    <>
      <header
        data-header-tone="light"
        className="bg-[linear-gradient(115deg,#480610_0%,#29050C_50%,#0F0004_100%)] px-5 pt-32 pb-14 text-white lg:px-8 lg:pt-40 lg:pb-20"
      >
        <div className="mx-auto max-w-7xl">
          <h1 className="max-w-4xl text-h1 leading-heading text-white">
            Help me work out my giving
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-white/85">
            Put in your household income and what you currently give, and we’ll
            show you where it all lands — and what growing in generosity could
            look like.
          </p>
        </div>
      </header>
      <section className="bg-warm-white px-5 py-12 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <GivingCalculator />
        </div>
      </section>
      <ManualCardGridBlockComponent
        heading="Next steps"
        cardStyle="info"
        columns={3}
        cards={[
          {
            title: '1. Money is tight',
            description: 'Speak with your Connect Group leader or contact us for support. We’d love to help you think through your next step.',
            href: '/contact',
            linkLabel: 'Contact us',
          },
          {
            title: '2. Faithful with Money',
            description: 'Explore what the Bible says about money, giving and contentment, and build a practical budget in this three-lesson course. Sign in or create an account to start.',
            href: '/members/courses/faithful-with-money',
            linkLabel: 'Start Faithful with Money',
          },
          {
            title: '3. Go deeper with budgeting',
            description: 'Interested in a more thorough 4–8 week budgeting course? Let us know and we’ll be in touch when details are available.',
            href: '/contact?interest=budgeting-course',
            linkLabel: 'Express Interest',
          },
        ]}
      />
      <CTABlockComponent
        heading="Giving at Ev"
        text="We encourage you to give first to your local church, the family where you’re fed and cared for (Gal 6:6), and then beyond it to other gospel work and to the poor. Give regularly, cheerfully and not under pressure: “God loves a cheerful giver” (2 Cor 9:7). You can claim back a third of what you give to registered NZ charities each year through the donation tax credit."
        colorPreset="primary-red"
        buttons={[{
          label: 'Start Giving',
          href: '/generosity/calculator?launcher=give',
          variant: 'primary',
        }]}
      />
    </>
  )
}
