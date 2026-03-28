import type { Metadata } from 'next'
import Link from 'next/link'
import { ScrollReveal } from '@/components/ui/ScrollReveal'
import { BreadcrumbJsonLd, buildBreadcrumbs } from '@/components/seo/BreadcrumbJsonLd'

export const metadata: Metadata = {
  title: {
    absolute:
      'What We Believe | Ev Church Auckland | Core Beliefs',
  },
  description:
    'Explore the core beliefs of Ev Church Auckland. What we believe about God, Jesus, the Bible, salvation, and the church. An evangelical Christian community in Tamaki Makaurau.',
  openGraph: {
    title: 'What We Believe | Ev Church Auckland',
    description:
      'Explore the core beliefs of Ev Church Auckland. An evangelical Christian community grounded in the gospel.',
    url: 'https://ev.church/what-we-believe',
    siteName: 'Ev Church',
    locale: 'en_NZ',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'What We Believe | Ev Church Auckland',
    description:
      'Core beliefs of Ev Church, an evangelical Christian community in Auckland.',
  },
  alternates: {
    canonical: 'https://ev.church/what-we-believe',
  },
}

const beliefs = [
  {
    title: 'About God',
    content:
      'There is one unique and eternal God, who exists in an everlasting loving relationship of Father, Son and Spirit \u2013 one God in three persons. God is sovereign in all things: including creation, revelation, redemption, judgement and the establishing of His kingdom. As sovereign loving creator and redeemer, He is worthy of all glory, honour and praise.',
  },
  {
    title: 'About Humanity',
    content:
      "Men and women together are created in the image of God and, therefore, enjoy a unique dignity in creation and a unique relationship with God. Men and women together have dominion over the created order. Tragically, human nature is universally sinful since the Fall and all are guilty before God. This leaves us under the wrath and condemnation of God. We are unable, without the prior regenerative work of God's Spirit, to turn ourselves to God.",
  },
  {
    title: 'About the Bible',
    content:
      'There is no other way to know God except that He reveals Himself to us. The Bible is God\'s revelation to us. The words of the Bible are divinely inspired and infallible, as originally given, and have supreme authority in all matters of faith, conduct and experience. The Bible is sufficient for knowing God. It is not only central to the well-being of the church but is able to thoroughly equip the Christian community for life and godliness.',
  },
  {
    title: 'About Jesus Christ',
    content:
      'Jesus Christ was conceived by the Holy Spirit and born of the virgin Mary. He is both fully God and truly human. He entered fully into human experience. He endured temptation and He suffered and died. He was perfectly obedient to God His father. Jesus took on Himself the consequences of human sin. He died and was buried. On the third day He rose from the dead bodily and is now exalted as ruler over all. He will come again in glory to judge the living and the dead.',
  },
  {
    title: 'About Salvation',
    content:
      "There is only one name under heaven by which we can be brought into relationship with God: the name \u2018Jesus Christ\u2019. It is only through the sacrificial death of Jesus Christ, as our representative and substitute, that the guilt, penalty and power of sin can be removed. In that death, God demonstrates His love to us most perfectly and establishes His victory over Satan and all His foes. The work of the Holy Spirit is necessary to make the death of Jesus effective in an individual's life. The Spirit enables the sinner to repent and put their faith in Jesus Christ, so that salvation is entirely of God's grace, through faith alone, and not of human merit or works.",
  },
  {
    title: 'About the Holy Spirit',
    content:
      "The Holy Spirit is co-equal with the Father and the Son, and indwells all true believers. His role is to bring glory to Jesus Christ, thus making Jesus Christ central in all things. The Spirit works to illuminate believers' minds to grasp the truth of the Bible, producing in them His fruit, granting them His gifts and empowering them for service. He grants His gifts for the purpose of service, not self-indulgence.",
  },
  {
    title: 'About the Church',
    content:
      'The visible church is the gathering of believers around Christ in His word. It is a community of people intended by God to bear witness to Him and actively seek the extension of His rule. Within its community, both men and women are to seek proper expression of their gifts as they work to build the church in love.',
  },
]

export default function WhatWeBelievePage() {
  const breadcrumbs = buildBreadcrumbs('/what-we-believe')

  return (
    <>
      <BreadcrumbJsonLd items={breadcrumbs} />

      {/* Hero */}
      <section className="bg-warm-white px-5 pb-16 pt-24 lg:px-8 lg:pb-20 lg:pt-32">
        <div className="mx-auto max-w-[80rem]">
          <div className="mx-auto max-w-3xl text-center">
            <ScrollReveal>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rich-red">
                Our beliefs
              </p>
              <h1 className="mt-3 font-serif text-display font-normal leading-display text-brand-black">
                What we believe
              </h1>
              <p className="mt-6 text-lg leading-body-lg text-dark-grey">
                Ev Church is an evangelical church that is independent in governance but
                united with Christians around the world and throughout history in upholding
                the gospel of Jesus Christ. We hold the Bible to be the supreme authority
                in all matters of faith and conduct and weigh all our teaching against its
                standard.
              </p>
              <p className="mt-4 text-[0.9375rem] leading-relaxed text-mid-grey">
                We believe the teachings outlined in the historic church creeds (known
                commonly as The Apostles' Creed, The Nicene Creed and The Athanasian Creed)
                are faithful expressions of the teaching of the Christian Scriptures. We
                hold to the Reformation teaching that God's rescue comes by grace alone,
                through faith alone, in the Person and work of Christ alone as revealed in
                the Scripture alone, to the glory of God alone.
              </p>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Beliefs List */}
      <section className="bg-white px-5 py-24 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-3xl">
          <div className="space-y-12">
            {beliefs.map((belief, i) => (
              <ScrollReveal key={belief.title} delay={i * 60}>
                <div className="border-l-4 border-rich-red/20 pl-6 lg:pl-8">
                  <h2 className="font-serif text-h3 font-normal text-brand-black">
                    {belief.title}
                  </h2>
                  <p className="mt-4 text-[0.9375rem] leading-relaxed text-dark-grey">
                    {belief.content}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Explore Further */}
      <section className="bg-warm-white px-5 py-24 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <ScrollReveal>
            <h2 className="font-serif text-h2 font-normal leading-heading text-brand-black">
              Want to explore further?
            </h2>
            <p className="mt-5 text-lg leading-body-lg text-dark-grey">
              If you are curious about the Christian faith or have questions about
              what we believe, we would love to chat.{' '}
              <Link
                href="/explaining-christianity"
                className="font-semibold text-rich-red hover:text-deep-red transition-colors"
              >
                Explaining Christianity
              </Link>{' '}
              is a relaxed course where you can ask anything in a no-pressure environment.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/explaining-christianity"
                className="inline-flex items-center justify-center rounded-md bg-rich-red px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-deep-red hover:shadow-md active:scale-[0.97]"
              >
                Explore Christianity
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-rich-red transition-colors hover:text-deep-red"
              >
                Meet our team
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  )
}
