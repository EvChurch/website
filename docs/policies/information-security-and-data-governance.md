# Information Security and Privacy Policy

**Organisation:** Auckland Evangelical Church Trust (Ev Church)  
**Status:** Draft — effective once approved  
**Owner:** Privacy Officer or delegated executive  
**Approved by:** [Name or governing body]  
**Effective date:** [Date]  
**Review:** Annually and after a significant incident

## 1. Purpose

Ev Church protects the confidentiality, integrity and availability of the personal, financial and operational information entrusted to it.

## 2. Scope

This policy applies to trustees, employees, contractors and volunteers who access Ev Church information or systems. It covers all approved services, including:

- Google Workspace for email, calendars and document storage;
- Rock RMS, hosted on Microsoft Azure, for church relationship and ministry information;
- Mailgun and Mailchimp for approved email communications;
- the Ev Church website, databases and Railway-hosted services;
- Google Analytics and PostHog for website analytics;
- Better Stack for application logging and operational monitoring;
- identity and source-code platforms; and
- payment providers, including Simple, Stripe and BlinkPay.

## 3. Security and privacy principles

Ev Church will:

- collect and use only information reasonably needed for a lawful church or operational purpose;
- tell people how their information is used through its published privacy policy;
- restrict access according to role and legitimate need;
- use supported systems, encryption and multi-factor authentication;
- keep sensitive information in approved systems rather than personal accounts or devices;
- respond promptly to incidents, privacy requests and complaints; and
- retain information only for as long as it is lawfully required.

Highly sensitive pastoral, financial, authentication and security information must receive the strongest access restrictions. Passwords, API keys, authentication tokens and recovery codes must never be placed in ordinary email, documents, chat, tickets, source code or screenshots.

## 4. Access and system use

- Administrative access to Google Workspace, Azure, Rock RMS, Railway, GitHub, payment services, email providers and other supported infrastructure must use multi-factor authentication.
- Access must be individually assigned. Shared administrator accounts are prohibited unless a provider offers no alternative and an approved exception is recorded.
- Privileged access must be reviewed at least quarterly and removed promptly when responsibilities end.
- Google Workspace documents containing confidential information must be stored in appropriately restricted Shared Drives or approved locations. Public links and external sharing must be used only when authorised.
- Rock RMS access must reflect ministry responsibilities. Sensitive pastoral, giving or safeguarding information must be limited to people who require it.
- Mailgun, Mailchimp and similar services must receive only the contact, subscription and delivery information needed for approved communications. Sensitive pastoral, authentication or payment information must not be included.
- Google Analytics and PostHog must collect only approved website-usage information. Sensitive journeys and form values must be excluded, masked or blocked from analytics and session recordings.
- Better Stack logs must not contain passwords, API keys, authentication tokens, bank or card details, sensitive pastoral information, or unnecessary personal information. Where an operational identifier is required, use a non-sensitive correlation or provider identifier.

## 5. Encryption and technical safeguards

Personal and confidential information must be encrypted in transit using TLS 1.2 or later and encrypted at rest using AES-256 or an equivalent approved industry standard.

Ev Church uses layered safeguards including role-based access, secure hosting, encrypted private networking, server-side secret storage, validation, rate limiting, bot protection, logging, backups and tested recovery procedures.

Simple, Stripe, BlinkPay and the customer's bank handle card details, online-banking credentials and bank authentication as applicable. Ev Church systems must not store that information.

## 6. API keys and secrets

Production credentials must:

- be stored in an approved secret store;
- be separate from development and testing credentials;
- be accessible only to named operators and services that require them;
- never be exposed to browsers, source control, logs or ordinary support material; and
- be rotated at least annually, when an authorised person leaves, or immediately following suspected exposure.

## 7. Security incidents

Suspected loss, unauthorised access, disclosure, alteration, malware, phishing, unavailable information or credential exposure must be reported immediately to the Privacy Officer and technical lead.

Ev Church will contain the incident, preserve evidence, assess the affected people, information and providers, rotate compromised credentials, restore safe service and record its decisions and actions.

Affected service providers will be notified within their contractual timeframes. Where a provider requires notification within 24 hours, Ev Church will provide an initial notification within 24 hours of becoming aware of an incident that affects or could reasonably affect that provider, its services or related customer data.

Where a privacy breach has caused or may cause serious harm, Ev Church will notify the Office of the Privacy Commissioner and affected people as soon as practicable, targeting notification within 72 hours of determining that the breach is notifiable.

## 8. Privacy requests and complaints

Ev Church publishes its privacy policy at [ev.church/privacy](https://www.ev.church/privacy). Privacy requests and complaints may be submitted through the Ev Church contact page.

Ev Church will acknowledge complaints within two business days, investigate them confidentially, provide a response or progress update within ten business days, record the outcome and explain how an unresolved privacy complaint may be raised with the Office of the Privacy Commissioner.

## 9. Retention and disposal

Personal information will not be kept longer than needed for its lawful purpose.

- Donation, accounting and associated audit records are retained for at least seven years after the relevant income year.
- Church relationship and ministry information is retained while it supports an active or legitimate historical purpose and is reviewed regularly.
- Email, documents and communication records must have an accountable owner and be reviewed when the relevant ministry, project or relationship ends.
- Temporary, test and sandbox records are deleted or anonymised when no longer required.
- Records subject to an incident, dispute or legal hold are retained until that requirement ends.

Records due for disposal will be reviewed at least annually and securely deleted or anonymised across the relevant systems and providers.

## 10. Updates and training

Security updates will be reviewed regularly. Actively exploited critical issues will normally be remediated or mitigated within 72 hours, and other high-risk issues within 14 days.

People with access to personal information or administrative systems must complete security and privacy training during onboarding and annually thereafter. Training covers phishing, MFA, secure sharing, personal and financial information, secret handling, complaints and incident reporting.

The policy owner will annually review access, MFA, credentials, patching, incidents, complaints, retention, provider controls and training records. Exceptions must be documented, approved, time-limited and assigned an owner.

## 11. Ongoing compliance

Ev Church will maintain evidence that this policy is being followed:

- **Monthly:** review security updates, high-risk vulnerabilities and unresolved incidents.
- **Quarterly:** review privileged access and MFA across key systems and remove unnecessary access.
- **Annually:** review this policy, staff training, data retention, credential rotation, provider security assurances, recovery procedures and the incident-response process.
- **Continuously:** record security incidents, privacy requests, complaints, exceptions and corrective actions with an owner and due date.

Compliance evidence must be kept in an appropriately restricted Ev Church location. It must not contain passwords, API keys, authentication tokens or unnecessary personal information. Material gaps must be reported to the policy owner and tracked until resolved.

## 12. Related documents

### Ev Church documents

- [Ev Church Privacy Policy](https://www.ev.church/privacy)
- [Giving release controls](https://github.com/EvChurch/website/blob/main/docs/runbooks/giving-release.md)
- [Giving operations](https://github.com/EvChurch/website/blob/main/docs/runbooks/giving-operations.md)
- [Auth0 Payload Admin SSO runbook](https://github.com/EvChurch/website/blob/main/docs/runbooks/auth0-payload-admin-sso.md)
- [Public member authentication runbook](https://github.com/EvChurch/website/blob/main/docs/runbooks/public-member-authentication.md)

### External guidance and provider assurance

- [Office of the Privacy Commissioner — Privacy breaches](https://www.privacy.org.nz/responsibilities/privacy-breaches/)
- [Office of the Privacy Commissioner — Responding to requests and complaints](https://www.privacy.org.nz/responsibilities/poupou-matatapu-doing-privacy-well/responding-to-requests-and-complaints-well/)
- [Inland Revenue — Record keeping for charities and not-for-profits](https://www.ird.govt.nz/updates/news-folder/2025/return-filing-and-record-keeping---update-for-charities-and-not-for-profits)
- [Railway Data Processing Addendum](https://railway.com/legal/dpa)
- Current agreements, privacy terms and security documentation for Google Workspace, Microsoft Azure, Rock RMS, Mailgun, Mailchimp, Google Analytics, PostHog, Better Stack, Auth0, GitHub, Simple, Stripe and BlinkPay.

## 13. Approval

| Version | Date | Approved by |
|---|---|---|
| 1.0 | [Date] | [Name or governing body] |
