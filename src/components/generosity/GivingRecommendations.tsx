interface GivingRecommendationsProps {
  annualIncome: number
  annualChurch: number
  annualOther: number
}

interface Recommendation {
  id: string
  title: string
  intro: string
  paragraphs: string[]
}

const messages = {
  start: {
    id: 'start',
    title: 'A place to start',
    intro: 'We want to encourage you to start giving.',
    paragraphs: [
      'Look at your budget, look at what you can start with, and put the amount in — starting somewhere is the best thing to do. Whatever you do, don’t not give. It’s good for us.',
      '“Where your treasure is, there your heart will be also.” — Jesus, Matthew 6:21',
      'What Jesus is saying is that the things you invest in are the things your heart will follow. Your investment goes first, and your heart follows second. He also said it is more blessed to give than to receive (Acts 20:35) — and generosity is the only antidote to greed. Every act of giving loosens money’s grip on us.',
      'So we want to encourage you to invest in the kingdom with every area of your life — not just your time and energy, but also the resources God has entrusted you to steward on his account.',
    ],
  },
  partner: {
    id: 'partner',
    title: 'Well done, partner',
    intro: 'Great work — well done on partnering with God in his kingdom.',
    paragraphs: [
      'Paul tells us in Philippians 4:15–17 that those who partner with him in giving and receiving also share in the fruit of his work. If you’re giving to the kingdom, then you get to see a reward in eternity: people standing firm in Jesus because of what you have partnered with.',
    ],
  },
  local: {
    id: 'local',
    title: 'Your local church family first',
    intro:
      'It looks like you’re giving to lots of places, which is so encouraging — but we want to encourage you to give firstly to the local church body you’re part of.',
    paragraphs: [
      'That’s what we’re called to support: the local family. It ought to be our first priority.',
      'This is the New Testament’s own pattern. Believers laid their gifts at the apostles’ feet, trusting the church to put them to work (Acts 4:35). Paul says the one who is taught the word should “share all good things with the one who teaches” (Galatians 6:6), and that elders who preach and teach are “worthy of double honour” — for “the worker deserves his wages” (1 Timothy 5:17–18). We have a real responsibility to support the workers of our church.',
      'The local church is growing you, leading you, and investing into you — it’s the family that keeps you standing firm in Jesus, and it’s the church Jesus himself promised to build (Matthew 16:18). So we’d love to encourage you to think through how you can see the needs of your local church met first, and perhaps look at raising that percentage.',
    ],
  },
  personalBest: {
    id: 'personal-best',
    title: 'A personal best?',
    intro:
      'Here’s a challenge: what would it look like for you to have a personal best in giving this year?',
    paragraphs: [
      'To raise your percentage by just one or two percent, and see if you can grow it as God grows your generosity and helps you invest in his kingdom?',
      '“Where your treasure is, there your heart will be also.” — Jesus, Matthew 6:21',
      'Remember — your money leads, and your heart follows. Generosity is the only antidote to greed, and each step up starves it a little more. Whatever your percentage today, growing your giving isn’t really about the number: it’s about what God is growing in you.',
    ],
  },
  beyond: {
    id: 'beyond',
    title: 'Beyond the floor',
    intro:
      'You’re giving beyond a tenth of your income — that is a wonderful marker of maturity, and genuinely worth celebrating.',
    paragraphs: [
      'And here’s a freeing thought: the tithe was never a ceiling, only a floor. As D.A. Carson puts it, “So, why not aim for 20 percent? Or 30?” — not out of law, but out of joy.',
      'God prospers us not to raise our standard of living, but to raise our standard of giving. As he grows what he’s entrusted to you, keep asking the money manager’s question: not “how much should I give?” but “what does he want me to do with his money?”',
    ],
  },
} satisfies Record<string, Recommendation>

export function GivingRecommendations({
  annualIncome,
  annualChurch,
  annualOther,
}: GivingRecommendationsProps) {
  const giving = annualChurch + annualOther
  const percentage = annualIncome > 0 ? (giving / annualIncome) * 100 : 0
  const visible: Recommendation[] =
    giving <= 0 ? [messages.start] : [messages.partner]
  if (giving > 0 && annualOther > annualChurch) visible.push(messages.local)
  if (giving > 0 && annualIncome > 0)
    visible.push(percentage < 10 ? messages.personalBest : messages.beyond)

  return (
    <section aria-labelledby="giving-analysis" className="mt-10">
      <h2 id="giving-analysis" className="text-h3 font-bold">
        Giving analysis &amp; recommendations
      </h2>
      <div className="mt-5 space-y-4" aria-live="polite">
        {visible.map((message) => (
          <article
            key={message.id}
            data-recommendation={message.id}
            className="rounded-xl border border-warm-grey bg-white p-5 sm:p-6"
          >
            <h3 className="text-lg font-bold">{message.title}</h3>
            <p className="mt-2 text-dark-grey">{message.intro}</p>
            <details className="mt-3 text-dark-grey">
              <summary className="w-fit cursor-pointer rounded-sm font-semibold text-deep-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rich-red">
                Read more<span className="sr-only">: {message.title}</span>
              </summary>
              <div className="mt-3 space-y-3 leading-relaxed">
                {message.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </details>
          </article>
        ))}
      </div>
    </section>
  )
}
