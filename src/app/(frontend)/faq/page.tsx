import type { Metadata } from 'next'
import Link from 'next/link'
import { ScrollReveal } from '@/components/ui/ScrollReveal'
import { BreadcrumbJsonLd, buildBreadcrumbs } from '@/components/seo/BreadcrumbJsonLd'

export const metadata: Metadata = {
  title: {
    absolute: 'FAQ | Ev Church Auckland | Frequently Asked Questions',
  },
  description:
    'Answers to common questions about Ev Church Auckland. Service times, locations, kids programs, parking, and how to get involved at our Auckland campuses.',
  openGraph: {
    title: 'FAQ | Ev Church Auckland',
    description:
      'Answers to common questions about Ev Church Auckland. Service times, locations, and how to get involved.',
    url: 'https://ev.church/faq',
    siteName: 'Ev Church',
    locale: 'en_NZ',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FAQ | Ev Church Auckland',
    description:
      'Common questions about Ev Church Auckland. Service times, locations, kids programs, and more.',
  },
  alternates: {
    canonical: 'https://ev.church/faq',
  },
}

interface FaqItem {
  question: string
  answer: string
  links?: { text: string; href: string }[]
}

const faqs: FaqItem[] = [
  {
    question: 'What time are services at Ev Church?',
    answer:
      'We have Sunday services at three campuses across Auckland. Ev North (Rosedale) and Ev Central (Hillsborough) both meet at 10:15 am. Unichurch meets at 5:15 pm at the University of Auckland. Services run for approximately 75 minutes.',
    links: [
      { text: 'Ev North campus', href: '/campus/north' },
      { text: 'Ev Central campus', href: '/campus/central' },
      { text: 'Unichurch campus', href: '/campus/unichurch' },
    ],
  },
  {
    question: 'Where is Ev Church located?',
    answer:
      'Ev Church has three campuses across Auckland, Tamaki Makaurau. Ev North is at 9-11 Rothwell Avenue, Rosedale. Ev Central is at 80 Olsen Avenue, Hillsborough. Unichurch meets at the University of Auckland, 24 Princes Street, Auckland CBD.',
    links: [{ text: 'Plan your visit', href: '/visit' }],
  },
  {
    question: 'Is Ev Church family-friendly? What about kids?',
    answer:
      'Absolutely. Ev Kids runs every Sunday during our North and Central services for children aged 0 to 12. We have three age groups: Creche (0-2 years), Explorers (3-5 years), and Adventurers (6-12 years). All our volunteers are police vetted and we maintain strict sign-in and sign-out procedures.',
    links: [{ text: 'Learn about Ev Kids', href: '/kids' }],
  },
  {
    question: 'What denomination is Ev Church?',
    answer:
      'Ev Church is an evangelical Christian church. We are independent in governance but united with Christians around the world in upholding the gospel of Jesus Christ. We hold the Bible to be the supreme authority in all matters of faith and conduct.',
    links: [{ text: 'Read what we believe', href: '/what-we-believe' }],
  },
  {
    question: 'What should I wear to church?',
    answer:
      'Come as you are. There is no dress code at Ev Church. You will see everything from jeans and t-shirts to smart casual. We want you to feel comfortable and welcome, whatever you wear.',
  },
  {
    question: 'How can I get involved or volunteer?',
    answer:
      'There are many ways to get involved at Ev Church. You can join a Connect Group to build friendships and grow in faith, serve on a Sunday team (welcome, kids, music, tech), or get involved in outreach and community projects. The best first step is to come along to Newish Connect.',
    links: [
      { text: 'Connect Groups', href: '/connect-groups' },
      { text: 'Newish Connect', href: '/newish' },
    ],
  },
  {
    question: 'Do you have youth programs?',
    answer:
      'Yes. Ev Youth runs on Friday nights for teenagers. We have Junior Youth and Senior Youth groups, both meeting on the North Shore. It is a place for teenagers to connect, grow, and find where they belong.',
    links: [{ text: 'Learn about Ev Youth', href: '/youth' }],
  },
  {
    question: 'What are Connect Groups?',
    answer:
      'Connect Groups are small groups of people who meet regularly throughout the week to share life, study the Bible, and support one another. We have groups for young adults, couples, women, men, and families across Auckland.',
    links: [{ text: 'Find a Connect Group', href: '/connect-groups' }],
  },
  {
    question: 'Is there parking available?',
    answer:
      'Yes, parking is available on site at both our North (Rosedale) and Central (Hillsborough) campuses. Unichurch meets in central Auckland where street parking and nearby parking buildings are available. If you need help finding us, get in touch.',
    links: [{ text: 'Contact us', href: '/contact' }],
  },
  {
    question: 'How do I find out more about the Christian faith?',
    answer:
      'We run a course called Explaining Christianity, which is a relaxed, no-pressure environment to ask questions and explore the basics of the Christian faith. It is open to anyone, whether you are curious, sceptical, or just want to learn. You can also come along to a Sunday service or chat with one of our pastors.',
    links: [
      { text: 'Explaining Christianity', href: '/explaining-christianity' },
      { text: 'Plan your visit', href: '/visit' },
    ],
  },
]

function FaqJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

export default function FaqPage() {
  const breadcrumbs = buildBreadcrumbs('/faq', 'FAQ')

  return (
    <>
      <BreadcrumbJsonLd items={breadcrumbs} />
      <FaqJsonLd />

      {/* Header */}
      <section className="bg-warm-white px-5 pb-16 pt-24 lg:px-8 lg:pb-20 lg:pt-32">
        <div className="mx-auto max-w-[80rem]">
          <div className="mx-auto max-w-3xl text-center">
            <ScrollReveal>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rich-red">
                Common questions
              </p>
              <h1 className="mt-3 font-serif text-display font-normal leading-display text-brand-black">
                Frequently asked questions
              </h1>
              <p className="mt-6 text-lg leading-body-lg text-dark-grey">
                Everything you need to know about visiting Ev Church in Auckland.
                Can not find what you are looking for?{' '}
                <Link
                  href="/contact"
                  className="font-semibold text-rich-red hover:text-deep-red transition-colors"
                >
                  Get in touch
                </Link>
                .
              </p>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* FAQ List */}
      <section className="bg-white px-5 py-24 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-3xl">
          <div className="divide-y divide-warm-grey">
            {faqs.map((faq, i) => (
              <ScrollReveal key={faq.question} delay={i * 40}>
                <div className="py-8 first:pt-0 last:pb-0">
                  <h2 className="font-sans text-lg font-semibold text-brand-black">
                    {faq.question}
                  </h2>
                  <p className="mt-3 text-[0.9375rem] leading-relaxed text-dark-grey">
                    {faq.answer}
                  </p>
                  {faq.links && faq.links.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-3">
                      {faq.links.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className="inline-flex items-center gap-1 text-sm font-semibold text-rich-red transition-colors hover:text-deep-red"
                        >
                          {link.text}
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2.5}
                            stroke="currentColor"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                            />
                          </svg>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-warm-white px-5 py-24 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <ScrollReveal>
            <h2 className="font-serif text-h2 font-normal leading-heading text-brand-black">
              Still have questions?
            </h2>
            <p className="mt-5 text-lg leading-body-lg text-dark-grey">
              We would love to hear from you. Reach out to our team and we will
              get back to you as soon as we can.
            </p>
            <div className="mt-10">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-md bg-rich-red px-8 py-3.5 text-base font-semibold text-white shadow-lg transition-all duration-200 hover:bg-deep-red hover:shadow-xl active:scale-[0.97]"
              >
                Contact us
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  )
}
