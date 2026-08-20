import type { Metadata } from 'next'
import { DEFAULT_OPEN_GRAPH_IMAGES } from '@/lib/seo-metadata'

const privacyDescription =
  'Read the Ev Church privacy policy to understand what personal information we collect, how we use, share, protect and retain it, and the rights and choices available to you.'

export const metadata: Metadata = {
  title: 'Privacy Policy | Ev Church Auckland',
  description: privacyDescription,
  openGraph: {
    images: DEFAULT_OPEN_GRAPH_IMAGES,
    title: 'Privacy Policy | Ev Church Auckland',
    description: privacyDescription,
    url: 'https://www.ev.church/privacy',
    siteName: 'Ev Church',
    locale: 'en_NZ',
    type: 'website',
  },
  alternates: {
    canonical: 'https://www.ev.church/privacy',
  },
}

const headingClassName = 'text-h3 text-brand-black'
const paragraphClassName = 'mt-4'
const listClassName = 'mt-4 list-disc space-y-2 pl-6'
const serviceProviders = [
  {
    name: 'Google Workspace',
    href: 'https://workspace.google.com/',
    purpose: 'Email, calendars, forms and document storage used in church administration and ministry.',
    dataLocation: 'Globally distributed',
  },
  {
    name: 'Rock RMS',
    href: 'https://www.rockrms.com/',
    purpose: 'Church relationship and ministry records, including groups, serving and communication history.',
    dataLocation: 'Australia (hosted by Ev Church in Azure Australia East)',
  },
  {
    name: 'Microsoft Azure',
    href: 'https://azure.microsoft.com/',
    purpose: 'Cloud infrastructure used to host Rock RMS and its related data and services.',
    dataLocation: 'Australia (Australia East)',
  },
  {
    name: 'Amazon Web Services',
    href: 'https://aws.amazon.com/',
    purpose: 'Cloud infrastructure and storage used by Ev Church systems.',
    dataLocation: 'Australia (Sydney)',
  },
  {
    name: 'Mailgun',
    href: 'https://www.mailgun.com/',
    purpose: 'Delivery of transactional and ministry email generated through Rock RMS.',
    dataLocation: 'United States',
  },
  {
    name: 'Mailchimp',
    href: 'https://mailchimp.com/',
    purpose: 'Newsletters and other optional email communications, including subscription preferences.',
    dataLocation: 'United States, with some processing in other countries',
  },
  {
    name: 'Resend',
    href: 'https://resend.com/',
    purpose: 'Delivery of website feedback notifications to authorised Ev Church staff.',
    dataLocation: 'United States',
  },
  {
    name: 'Railway',
    href: 'https://railway.com/',
    purpose: 'Hosting for the Ev Church website, application services and databases.',
    dataLocation: 'United States (US West)',
  },
  {
    name: 'Auth0',
    href: 'https://auth0.com/',
    purpose: 'Authentication and secure sign-in for member and administrative website accounts.',
    dataLocation: 'United States',
  },
  {
    name: 'Google Analytics',
    href: 'https://marketingplatform.google.com/about/analytics/',
    purpose: 'Measurement of general use and performance on non-sensitive public website pages.',
    dataLocation: 'Globally distributed',
  },
  {
    name: 'Google Maps Platform',
    href: 'https://mapsplatform.google.com/',
    purpose: 'Campus maps, ratings and publicly submitted Google reviews displayed on campus pages.',
    dataLocation: 'Globally distributed',
  },
  {
    name: 'PostHog',
    href: 'https://posthog.com/',
    purpose: 'Website analytics, feature rollouts, error diagnosis and eligible session replays.',
    dataLocation: 'United States',
  },
  {
    name: 'Better Stack',
    href: 'https://betterstack.com/',
    purpose: 'Website uptime monitoring, operational logging and investigation of service errors.',
    dataLocation: 'United States',
  },
  {
    name: 'Simple Donation',
    href: 'https://simpledonation.com/',
    purpose: 'Existing online giving services integrated with Rock RMS.',
    dataLocation: 'Not publicly specified by the provider',
  },
  {
    name: 'Stripe',
    href: 'https://stripe.com/nz',
    purpose: 'Card-payment processing used by Simple Donation.',
    dataLocation: 'Globally distributed, including the United States',
  },
  {
    name: 'BlinkPay',
    href: 'https://www.blinkpay.co.nz/',
    purpose: 'Open-banking authorisation and setup of one-off or recurring bank payments.',
    dataLocation: 'AWS data centres; country not publicly specified by BlinkPay',
  },
] as const

export default function PrivacyPage() {
  return (
    <section className="bg-warm-white px-5 py-24 lg:px-8 lg:py-32">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rich-red">
          Legal
        </p>
        <h1 className="mt-3 text-display leading-display text-brand-black">
          Privacy Policy
        </h1>
        <p className="mt-4 text-sm text-mid-grey">
          Last updated: August 2026
        </p>

        <div className="mt-12 space-y-10 text-[0.9375rem] leading-relaxed text-dark-grey">
          <div>
            <h2 className={headingClassName}>1. Who we are</h2>
            <p className={paragraphClassName}>
              Ev Church (Auckland Evangelical Church Trust) is a community of
              Christ-followers across Auckland. We value the trust you place in us when
              you share personal information. This policy explains how we look after that
              information when you visit our website, come along to church or take part
              in our ministries and activities.
            </p>
            <p className={paragraphClassName}>
              Providing personal information is generally voluntary. If you do not
              provide information we need, we may be unable to respond to a request,
              register you for an activity, provide pastoral support or process a gift.
            </p>
          </div>

          <div>
            <h2 className={headingClassName}>2. Information we collect</h2>
            <p className={paragraphClassName}>Depending on how you engage with us, we may collect:</p>
            <ul className={listClassName}>
              <li>Your name, contact details, account identity and communication preferences</li>
              <li>Information you provide for events, groups, serving and other church activities</li>
              <li>Prayer requests, pastoral-care information and other ministry information</li>
              <li>
                Giving information such as the amount, fund, frequency, start date,
                giver reference and payment status
              </li>
              <li>Messages, feedback, privacy requests and complaints</li>
              <li>
                Technical and usage information such as page visits, device and browser
                details, approximate location, session identifiers and error information
              </li>
            </ul>
          </div>

          <div>
            <h2 className={headingClassName}>3. How we use information</h2>
            <p className={paragraphClassName}>We use personal information to:</p>
            <ul className={listClassName}>
              <li>Provide church activities, pastoral care and member services</li>
              <li>Communicate about services, events, groups and ministries</li>
              <li>Process and reconcile gifts and manage recurring giving instructions</li>
              <li>Operate, secure, monitor and improve our website and systems</li>
              <li>Respond to enquiries, feedback, privacy requests and complaints</li>
              <li>Meet our accounting, safeguarding and other legal obligations</li>
            </ul>
          </div>

          <div>
            <h2 className={headingClassName}>4. Service providers and overseas processing</h2>
            <p className={paragraphClassName}>
              We do not sell or rent personal information. We use service providers to
              operate our church and website. Information is shared only where needed
              for the relevant service. The locations below describe where information
              is primarily stored or processed based on our current configuration and
              each provider&apos;s published information. Our main providers include:
            </p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-warm-grey/60 bg-white">
              <table className="min-w-[52rem] border-collapse text-left text-sm">
                <thead className="bg-brand-black text-warm-white">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Provider</th>
                    <th scope="col" className="px-4 py-3 font-semibold">How we use it</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Primary data location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-warm-grey/60">
                  {serviceProviders.map((provider) => (
                    <tr key={provider.name} className="align-top">
                      <th scope="row" className="whitespace-nowrap px-4 py-3 font-semibold text-brand-black">
                        <a
                          href={provider.href}
                          className="text-rich-red underline decoration-rich-red/30 underline-offset-2 transition-colors hover:text-deep-red"
                        >
                          {provider.name}
                        </a>
                      </th>
                      <td className="px-4 py-3 text-dark-grey">{provider.purpose}</td>
                      <td className="px-4 py-3 text-dark-grey">{provider.dataLocation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={paragraphClassName}>
              Some providers may store or process information outside New Zealand. We
              select providers with appropriate privacy and security arrangements and
              remain responsible for information processed on our behalf. Some providers
              may also process information under their own privacy terms when performing
              independent functions such as payment processing.
            </p>
          </div>

          <div>
            <h2 className={headingClassName}>5. Giving and payments</h2>
            <p className={paragraphClassName}>
              We use your name and contact details to identify you and associate your
              giving with the appropriate church relationship record. We retain the gift
              and provider information needed for receipts, reconciliation, recurring
              instructions and accounting.
            </p>
            <p className={paragraphClassName}>
              Payment providers and your bank handle card details, online-banking
              credentials and bank authentication as applicable. Ev Church does not
              receive or store your online-banking password or full card details.
            </p>
          </div>

          <div>
            <h2 className={headingClassName}>6. Analytics, cookies and monitoring</h2>
            <p className={paragraphClassName}>
              Google Analytics measures general use of non-sensitive public pages. It is
              disabled on sensitive journeys such as sign-in, member, giving, contact and
              pastoral-care pages.
            </p>
            <p className={paragraphClassName}>
              Google Maps Platform displays campus maps and may load public rating and review
              data from Google when you view a campus page. Google processes these requests
              under its{' '}
              <a
                href="https://policies.google.com/terms"
                className="text-rich-red underline decoration-rich-red/30 underline-offset-2 transition-colors hover:text-deep-red"
              >
                Terms of Service
              </a>{' '}
              and{' '}
              <a
                href="https://policies.google.com/privacy"
                className="text-rich-red underline decoration-rich-red/30 underline-offset-2 transition-colors hover:text-deep-red"
              >
                Privacy Policy
              </a>
              .
            </p>
            <p className={paragraphClassName}>
              PostHog helps us understand website use, diagnose errors, manage feature
              rollouts and review eligible session replays. Form-control values are
              masked, and PostHog capture is paused while the giving experience is open.
              When you are signed in, approved analytics may be associated with your
              member identity so we can provide and support the appropriate experience.
            </p>
            <p className={paragraphClassName}>
              Better Stack helps us monitor service health and investigate operational
              errors. We limit logs to information needed to operate and secure our
              services and do not intentionally log form contents, bank credentials or
              full card details.
            </p>
            <p className={paragraphClassName}>
              These services may use cookies or similar browser storage to recognise a
              session, remember settings and measure website use.
            </p>
          </div>

          <div>
            <h2 className={headingClassName}>7. Security</h2>
            <p className={paragraphClassName}>
              We use appropriate technical and organisational measures to protect personal
              information against unauthorised access, alteration, disclosure, loss or
              destruction. These include access controls, multi-factor authentication,
              encryption in transit and at rest, secure providers, monitoring and backups.
              No method of storage or transmission is completely secure.
            </p>
          </div>

          <div>
            <h2 className={headingClassName}>8. Retention</h2>
            <p className={paragraphClassName}>
              We retain personal information only for as long as needed for its purpose
              and our legal obligations. Donation and accounting records are generally
              retained for at least seven years. Temporary and test records are deleted or
              anonymised when no longer needed. Some church relationship, pastoral,
              safeguarding, dispute or legal-hold records may need to be kept longer.
            </p>
          </div>

          <div>
            <h2 className={headingClassName}>9. Your rights and complaints</h2>
            <p className={paragraphClassName}>You may:</p>
            <ul className={listClassName}>
              <li>Ask to access the personal information we hold about you</li>
              <li>Ask us to correct information that is inaccurate or incomplete</li>
              <li>Ask us to delete information where we are not required to retain it</li>
              <li>Unsubscribe from optional email communications</li>
              <li>Raise a privacy question or complaint with us</li>
            </ul>
            <p className={paragraphClassName}>
              If we cannot resolve a privacy complaint, you may contact the{' '}
              <a
                href="https://www.privacy.org.nz/your-rights/how-to-complain/"
                className="font-semibold text-rich-red transition-colors hover:text-deep-red"
              >
                Office of the Privacy Commissioner
              </a>.
            </p>
          </div>

          <div>
            <h2 className={headingClassName}>10. Changes and contact</h2>
            <p className={paragraphClassName}>
              We may update this policy when our practices, providers or legal obligations
              change. We will publish the current version and revision date on this page.
            </p>
            <p className={paragraphClassName}>
              To exercise your rights or ask a privacy question, please use{' '}
              <a
                href="/contact"
                className="font-semibold text-rich-red transition-colors hover:text-deep-red"
              >
                our contact page
              </a>.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
