import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy | Ev Church Auckland',
  description:
    'Privacy policy for Ev Church. Learn how we collect, use, and protect your personal information.',
  openGraph: {
    title: 'Privacy Policy | Ev Church Auckland',
    description: 'Privacy policy for Ev Church.',
    url: 'https://ev.church/privacy',
    siteName: 'Ev Church',
    locale: 'en_NZ',
    type: 'website',
  },
  alternates: {
    canonical: 'https://ev.church/privacy',
  },
}

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
          Last updated: March 2026
        </p>

        <div className="mt-12 space-y-10 text-[0.9375rem] leading-relaxed text-dark-grey">
          <div>
            <h2 className="text-h3 text-brand-black">
              1. Introduction
            </h2>
            <p className="mt-4">
              Ev Church (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;)
              is committed to protecting your privacy. This Privacy Policy explains
              how we collect, use, disclose, and safeguard your information when you
              visit our website, attend our services, or engage with our programs.
            </p>
          </div>

          <div>
            <h2 className="text-h3 text-brand-black">
              2. Information We Collect
            </h2>
            <p className="mt-4">
              We may collect personal information that you voluntarily provide to us,
              including but not limited to:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>Name and contact details (email address, phone number)</li>
              <li>Mailing address</li>
              <li>Information provided when registering for events or programs</li>
              <li>Prayer requests and pastoral care information</li>
              <li>Donation and financial information (processed securely by third-party providers)</li>
              <li>Website usage data collected via cookies and analytics tools</li>
            </ul>
          </div>

          <div>
            <h2 className="text-h3 text-brand-black">
              3. How We Use Your Information
            </h2>
            <p className="mt-4">
              We use the information we collect to:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>Communicate with you about services, events, and programs</li>
              <li>Process event registrations and volunteer applications</li>
              <li>Provide pastoral care and support</li>
              <li>Process donations securely</li>
              <li>Improve our website and services</li>
              <li>Comply with legal obligations</li>
            </ul>
          </div>

          <div>
            <h2 className="text-h3 text-brand-black">
              4. Information Sharing
            </h2>
            <p className="mt-4">
              We do not sell, trade, or rent your personal information to third parties.
              We may share your information with trusted service providers who assist us
              in operating our website and conducting our activities, provided they agree
              to keep your information confidential.
            </p>
          </div>

          <div>
            <h2 className="text-h3 text-brand-black">
              5. Data Security
            </h2>
            <p className="mt-4">
              We implement appropriate technical and organisational measures to protect
              your personal information against unauthorised access, alteration,
              disclosure, or destruction. However, no method of transmission over the
              internet is 100% secure.
            </p>
          </div>

          <div>
            <h2 className="text-h3 text-brand-black">
              6. Your Rights
            </h2>
            <p className="mt-4">
              Under the New Zealand Privacy Act 2020, you have the right to:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your personal information</li>
              <li>Withdraw consent for communications at any time</li>
            </ul>
          </div>

          <div>
            <h2 className="text-h3 text-brand-black">
              7. Cookies
            </h2>
            <p className="mt-4">
              Our website may use cookies and similar tracking technologies to enhance
              your browsing experience. You can control cookie settings through your
              browser preferences.
            </p>
          </div>

          <div>
            <h2 className="text-h3 text-brand-black">
              8. Changes to This Policy
            </h2>
            <p className="mt-4">
              We may update this Privacy Policy from time to time. Any changes will be
              posted on this page with an updated revision date.
            </p>
          </div>

          <div>
            <h2 className="text-h3 text-brand-black">
              9. Contact Us
            </h2>
            <p className="mt-4">
              If you have any questions about this Privacy Policy or wish to exercise
              your rights, please contact us at{' '}
              <a href="/contact" className="font-semibold text-rich-red hover:text-deep-red transition-colors">
                our contact page
              </a>.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
