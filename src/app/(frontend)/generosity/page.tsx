import type { Metadata } from 'next'
import { Button } from '@/components/ui/Button'
import { DEFAULT_OPEN_GRAPH_IMAGES } from '@/lib/seo-metadata'

const description = "Everything we have is God's. Here's a simple place to think through what that means for your money and your giving."

export const metadata: Metadata = {
  title: 'Grow in generosity',
  description,
  alternates: { canonical: 'https://www.ev.church/generosity' },
  openGraph: {
    title: 'Grow in generosity | Ev Church',
    description,
    url: 'https://www.ev.church/generosity',
    images: DEFAULT_OPEN_GRAPH_IMAGES,
  },
}

const principles = [
  {
    title: 'God owns it all.',
    text: 'We’re managers, not owners. “Everything comes from you, and we have given you only what comes from your hand” (1 Chr 29:14).',
  },
  {
    title: 'You can’t take it with you, but you can send it ahead.',
    text: 'Money spent on ourselves stays here. Money given to God’s work is stored up in heaven (Matt 6:19–20).',
  },
  {
    title: 'Your heart follows your money.',
    text: '“Where your treasure is, there your heart will be also” (Matt 6:21). If you want to care more about God’s kingdom, put your money there.',
  },
  {
    title: 'This world isn’t home.',
    text: 'We’re citizens of heaven (Phil 3:20), so we hold earthly things loosely and invest in what lasts.',
  },
  {
    title: 'God gives us more so we can give more.',
    text: 'When God increases what we have, it’s not only to raise our standard of living but our standard of giving (2 Cor 9:8–11).',
  },
  {
    title: 'Giving breaks money’s grip.',
    text: 'Generosity is God’s antidote to materialism. It frees us to “take hold of the life that is truly life” (1 Tim 6:17–19).',
  },
]

export default function GenerosityPage() {
  return (
    <>
      <section className="bg-warm-white px-5 py-24 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-[80rem]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rich-red">Generosity at Ev</p>
          <h1 className="mt-4 max-w-4xl text-display leading-display">Grow in generosity</h1>
          <p className="mt-6 max-w-2xl text-xl leading-relaxed text-dark-grey">{description}</p>
          <div className="mt-10 flex flex-wrap gap-4">
            {/* A full navigation keeps the standalone calculator free of site analytics. */}
            <a href="/generosity/calculator" className="inline-flex items-center justify-center rounded-md bg-rich-red px-8 py-3.5 text-base font-semibold text-white transition-colors hover:bg-deep-red focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rich-red">Work out my giving</a>
            <Button href="https://give.ev.church" variant="secondary" size="large">Give now</Button>
          </div>
        </div>
      </section>

      <section aria-labelledby="why-we-give" className="bg-white px-5 py-20 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-[80rem]">
          <h2 id="why-we-give" className="text-h2 leading-heading">Why we give</h2>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-dark-grey">At Ev, giving isn’t a membership fee or a fundraising target. It’s part of following Jesus, who “though he was rich, yet for your sake became poor” (2 Cor 8:9). Here’s how the Bible shapes the way we think about money.</p>
          <div className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
            {principles.map((principle, index) => (
              <article key={principle.title} className="border-t border-warm-grey pt-6">
                <p aria-hidden="true" className="text-sm font-semibold text-rich-red">0{index + 1}</p>
                <h3 className="mt-3 text-xl font-bold">{principle.title}</h3>
                <p className="mt-3 leading-relaxed text-dark-grey">{principle.text}</p>
              </article>
            ))}
          </div>
          <p className="mt-12 max-w-3xl text-sm leading-relaxed text-dark-grey">These ideas are drawn from Randy Alcorn’s <cite>The Treasure Principle</cite>, a short book we’d encourage everyone to read.</p>
        </div>
      </section>

      <section aria-labelledby="three-steps" className="bg-warm-white px-5 py-20 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-[80rem]">
          <h2 id="three-steps" className="text-h2 leading-heading">Where to start: three steps</h2>
          <ol className="mt-12 grid gap-6 lg:grid-cols-3">
            <li className="flex flex-col rounded-xl border border-warm-grey bg-white p-8">
              <p className="text-sm font-semibold text-rich-red">Step 1</p>
              <h3 className="mt-3 text-h4 font-bold">Work out my giving</h3>
              <p className="mt-4 mb-8 leading-relaxed text-dark-grey">See what you’re giving now as a share of your income, and what a next step could look like. It runs entirely on your device, so nothing you enter is saved or seen.</p>
              <a href="/generosity/calculator" className="mt-auto font-semibold text-deep-red underline underline-offset-4">Open the giving calculator →</a>
            </li>
            <li className="flex flex-col rounded-xl border border-warm-grey bg-white p-8">
              <p className="text-sm font-semibold text-rich-red">Step 2</p>
              <h3 className="mt-3 text-h4 font-bold">Get your budget in order</h3>
              <p className="mt-4 mb-8 leading-relaxed text-dark-grey">Giving well starts with knowing where your money goes. This short course walks you through setting up a simple budget.</p>
              <Button href="/generosity/budgeting" variant="text" className="mt-auto justify-start">Start the budgeting course →</Button>
            </li>
            <li className="flex flex-col rounded-xl border border-warm-grey bg-white p-8">
              <p className="text-sm font-semibold text-rich-red">Step 3</p>
              <h3 className="mt-3 text-h4 font-bold">Go deeper</h3>
              <p className="mt-4 mb-8 leading-relaxed text-dark-grey">Want to think more about money, debt, saving and contentment from a Christian point of view? A longer course is on its way.</p>
              <button type="button" disabled className="mt-auto self-start rounded-md bg-warm-grey px-6 py-2.5 text-sm font-semibold text-dark-grey disabled:cursor-not-allowed">Coming soon</button>
            </li>
          </ol>
        </div>
      </section>

      <section aria-labelledby="giving-at-ev" className="bg-white px-5 py-20 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-3xl">
          <h2 id="giving-at-ev" className="text-h2 leading-heading">Giving at Ev</h2>
          <p className="mt-6 text-lg leading-relaxed text-dark-grey">We encourage you to give first to your local church, the family where you’re fed and cared for (Gal 6:6), and then beyond it to other gospel work and to the poor. Give regularly, cheerfully and not under pressure: “God loves a cheerful giver” (2 Cor 9:7). You can claim back a third of what you give to registered NZ charities each year through the donation tax credit.</p>
          <Button href="https://give.ev.church" size="large" className="mt-8">Give at give.ev.church</Button>
        </div>
      </section>
    </>
  )
}
