# BlinkPay Debit Documentation

Captured from the BlinkPay Merchant Portal on 2026-09-01 (Pacific/Auckland). This is a local reference copy; the live documentation remains authoritative.

> **Agent reference:** Read this document before changing BlinkPay authentication, payments, consents, recurring schedules, webhooks, reconciliation, or operational handling. This snapshot exists because the merchant documentation requires authentication. When replacing it with a newer capture, update the capture date and OpenAPI version, preserve the source links, and scan the replacement for merchant credentials before committing it.

- Guide source: https://merchants.blinkpay.co.nz/docs/debit/overview
- OpenAPI source: https://merchants.blinkpay.co.nz/resources/DebitOAS
- OpenAPI version shown at capture: **1.0.49** (OpenAPI 3.0.4)

## Contents

- [BlinkPay Overview](#blinkpay-overview)
- [Quick Start Guide](#quick-start-guide)
- [Authentication](#authentication)
- [Consent Types](#consent-types)
- [Consent Lifecycle](#consent-lifecycle)
- [Payment Lifecycle](#payment-lifecycle)
- [Gateway Flow](#gateway-flow)
- [Redirect Flow](#redirect-flow)
- [Decoupled Flow](#decoupled-flow)
- [Mobile Integration](#mobile-integration)
- [App-to-App Flow](#app-to-app-flow)
- [Single Payments](#single-payments)
- [Recurring Payments](#recurring-payments)
- [Fixed Recurring Payments](#fixed-recurring-payments)
- [Gateway Integration](#gateway-integration)
- [Card Payments](#card-payments)
- [Testing Guide](#testing-guide)
- [SDKs & Client Libraries](#sdks-client-libraries)
- [Security & Compliance](#security-compliance)
- [Bank Coverage](#bank-coverage)
- [Error Codes Reference](#error-codes-reference)
- [API Policies](#api-policies)
- [Metadata Endpoint](#metadata-endpoint)
- [Glossary](#glossary)
- [Postman Collection](#postman-collection)
- [Troubleshooting](#troubleshooting)
- [Going Live](#going-live)
- [Demo Applications](#demo-applications)
- [Support & Help](#support-help)
- [OpenAPI reference index](#openapi-reference-index)

---

Source: https://merchants.blinkpay.co.nz/docs/debit/overview

# BlinkPay Overview

BlinkPay is New Zealand's first purpose-built open banking payment gateway, backed by Bank of New Zealand. We provide secure, direct account-to-account payment initiation and data access services through our comprehensive API platform.

## What is Open Banking?

Open banking enables third-party financial service providers to access customer banking data and initiate payments with the customer's explicit consent. BlinkPay acts as a trusted intermediary between your business and New Zealand's major banks.

### Key Principles

- **Customer Consent** - All access requires explicit customer authorisation
- **Secure Access** - Direct bank APIs with strong authentication
- **No Credentials Storage** - BlinkPay never stores customer banking credentials
- **Transparent Control** - Customers can view and revoke consent at any time

## How BlinkPay Works

![BlinkPay Payment Flow](https://merchants.blinkpay.co.nz/docs/images/debit/payment-flow-diagram.png)

## BlinkPay Products

### Blink PayNow

Single payment initiation for one-off transactions.

**Use Cases:**

- E-commerce checkout payments
- Invoice payments
- Bill payments
- One-time donations

**Features:**

- Single consent, single payment
- Quick Payment option (one-step API call)
- Payment limits vary by bank — see [Bank Coverage](https://merchants.blinkpay.co.nz/docs/shared/bank-coverage#payment-limits)
- Bank transfer settlement typically within 2 hours
- Card payments via Gateway Flow — settlement depends on your acquirer

[Learn more about Single Payments →](https://merchants.blinkpay.co.nz/docs/debit/guides/single-payments)

### Blink AutoPay

Recurring payment capabilities with enduring consents.

**Use Cases:**

- Subscription billing
- Instalment payments
- Recurring donations
- Regular service fees

**Features:**

- Variable payment amounts within limits
- Multiple period types (daily, weekly, monthly, etc.)
- Indefinite or time-limited consents
- Customer-controlled revocation

[Learn more about Recurring Payments →](https://merchants.blinkpay.co.nz/docs/debit/guides/recurring-payments)

### Blink Data

Account information access for financial data retrieval.

**Use Cases:**

- Account verification
- Income verification
- Financial assessment
- Transaction analysis

**Features:**

- Read-only account access
- Balance inquiries
- Transaction history
- Multiple account types

[Learn more about Blink Data →](https://merchants.blinkpay.co.nz/docs/data/guides/data-retrieval)

### Blink Gateway

Hosted payment gateway that simplifies integration.

**Use Cases:**

- Quick integration without building UI
- Consistent user experience
- Bank selection and flow management
- Mobile and web applications

**Features:**

- BlinkPay-hosted consent pages
- Automatic bank selection
- Flow type optimisation
- Responsive design
- Card payments alongside bank transfers

[Learn more about Gateway →](https://merchants.blinkpay.co.nz/docs/debit/guides/gateway-integration)

## Integration Benefits

### For Merchants

- **Lower Transaction Costs** - Reduced payment processing fees compared to card payments
- **Instant Payment Confirmation** - Real-time payment status updates
- **Reduced Fraud** - Bank-authenticated payments with strong customer authentication
- **No Chargebacks** - Direct debit means no card chargeback risk
- **Better Conversion** - Streamlined checkout experience

### For Customers

- **Secure Payments** - No need to share card details
- **Bank-Level Security** - Authenticate using familiar banking credentials
- **Transparent Fees** - No hidden payment processing fees
- **Control & Visibility** - View and manage all consents in one place
- **Fast Checkout** - Quick payment experience without manual data entry

## Technical Architecture

### Direct Bank Integration

BlinkPay maintains direct integrations with all major New Zealand banks:

- ANZ New Zealand
- ASB Bank
- Bank of New Zealand (BNZ)
- Kiwibank
- Westpac New Zealand

> **TIP**
>
> **No Screen Scraping**
> 
> BlinkPay uses official bank APIs only. We never use screen scraping or store customer banking credentials.

### Payment Processing

Bank payments are processed through New Zealand's BECS (Bulk Electronic Clearing System) as Direct Credit transactions. Card payments are also supported through the Gateway flow — see [Card Payments](https://merchants.blinkpay.co.nz/docs/debit/guides/card-payments) for details.

**Payment Flow:**

1. Customer authorises payment via their bank
2. BlinkPay receives authorisation confirmation
3. Bank processes payment instruction
4. Funds transferred via BECS network
5. Settlement typically completes within 2 hours

**Important:** The `AcceptedSettlementCompleted` status indicates the payer's bank has sent the funds, but does not guarantee the funds have been received by the merchant's bank. Always verify receipt in your bank account.

### API-First Design

BlinkPay is built as an API-first platform:

- RESTful API architecture
- OAuth 2.0 authentication
- JSON request/response format
- Webhooks for Fixed Recurring Payment events
- OpenAPI specification available

### No Funds Holding

> **WARNING**
>
> **Important**
> 
> BlinkPay operates as a payment service aggregator and never holds customer funds. All payments go directly from the customer's bank account to your bank account.

## Standards & Compliance

### ISO 27001:2022 Certified

BlinkPay maintains ISO 27001:2022 certification for information security management, ensuring:

- Secure development practices
- Risk management processes
- Security incident response
- Continuous monitoring and improvement

### Open Banking Standards

Built on New Zealand's open banking framework (currently v2.3), with support for:

- Payment Initiation Services (PIS)
- Account Information Services (AIS)
- Strong Customer Authentication (SCA)
- Consent management

### Data Protection

- **Encryption** - All data encrypted in transit (TLS) and at rest
- **Access Control** - Role-based access with least privilege principle
- **Audit Logging** - Comprehensive audit trails for all operations
- **Data Residency** - Data stored in New Zealand

## Limitations & Considerations

### Current Limitations

**Banking Scope:**

- Open Banking v2.3 is tailored for retail/personal banking
- Business accounts with multi-authorisation requirements may have limitations
- Version 3 will address business banking needs

**Technical Constraints:**

- iFrames not supported due to bank content security policies
- WebViews are supported in mobile applications
- Each bank has different payment limits and timeouts

### Bank-Specific Differences

Different banks support different features and authentication methods:

- **Login Methods** - App deep linking, mobile number, customer ID
- **Payment Limits** - Vary by bank and account type
- **Timeout Periods** - Different session timeout durations
- **Authentication** - Different 2FA implementations

[View detailed bank coverage →](https://merchants.blinkpay.co.nz/docs/shared/bank-coverage)

## Getting Started

Ready to integrate BlinkPay? Here's your roadmap:

1. **[Quick Start Guide](https://merchants.blinkpay.co.nz/docs/debit/quick-start)** - Get up and running quickly
2. **[Authentication](https://merchants.blinkpay.co.nz/docs/shared/authentication)** - Learn about OAuth 2.0 tokens
3. **[Gateway Flow](https://merchants.blinkpay.co.nz/docs/shared/flows/gateway-flow)** - Easiest integration path (recommended)
4. **[Going Live](https://merchants.blinkpay.co.nz/docs/shared/help/going-live)** - Production checklist and certification

---

Source: https://merchants.blinkpay.co.nz/docs/debit/quick-start

# Quick Start Guide

This guide demonstrates how to create a payment using Gateway Flow with Quick Payments.

## Requirements

- BlinkPay Merchant Account
- API Credentials (Client ID and Client Secret)
- Registered redirect URI

> **TIP**
>
> **Sandbox Environment**
> 
> This guide uses the sandbox environment. Use the mock bank "PNZ" with username `user02` for testing.

## Step 1: Get Access Token

**Request:**

```http
POST /oauth2/token HTTP/1.1
Host: sandbox.debit.blinkpay.co.nz
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&client_id={client_id}&client_secret={client_secret}
```

**Response:**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

> **WARNING**
>
> **Token Expiry**
> 
> Access tokens expire after 1 hour. Implement automatic token refresh in your application.

## Step 2: Create Quick Payment

**Request:**

```http
POST /payments/v1/quick-payments HTTP/1.1
Host: sandbox.debit.blinkpay.co.nz
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "flow": {
    "detail": {
      "type": "gateway",
      "redirect_uri": "https://www.yourwebsite.com/payment/complete"
    }
  },
  "amount": {
    "currency": "NZD",
    "total": "25.00"
  },
  "pcr": {
    "particulars": "Invoice",
    "code": "12345",
    "reference": "Payment"
  }
}
```

> **WARNING**
>
> **PCR Field Limits**
> 
> Each PCR field (particulars, code, reference) has a maximum length of 12 characters. Requests with longer values are rejected with a `400` validation error.

**Response:**

```json
{
  "quick_payment_id": "3a3b7f7d-f8e6-4c3e-b2a1-5f9c8d7e6a5b",
  "redirect_uri": "https://sandbox.debit.blinkpay.co.nz/gateway/pay?id=3a3b7f7d..."
}
```

## Step 3: Redirect Customer

Redirect the customer to the `redirect_uri` from the response. The customer will:

1. See the BlinkPay Gateway
2. Select their bank (ANZ, ASB, BNZ, Kiwibank, or Westpac)
3. Authenticate with their bank
4. Authorize the payment
5. Return to your `redirect_uri`

## Step 4: Handle Return

Customer returns to your `redirect_uri` with query parameters:

```text
https://www.yourwebsite.com/payment/complete?cid={consent_id}
```

| Parameter | Description |
| --- | --- |
| `cid` | Consent ID |
| `error` | (Optional) Error message if something went wrong |
The redirect URL does not indicate the final result—you must verify via API.

## Step 5: Check Payment Status

**Request:**

```http
GET /payments/v1/quick-payments/{quick_payment_id} HTTP/1.1
Host: sandbox.debit.blinkpay.co.nz
Authorization: Bearer {access_token}
```

**Response:**

```json
{
  "quick_payment_id": "3a3b7f7d-f8e6-4c3e-b2a1-5f9c8d7e6a5b",
  "consent": {
    "consent_id": "9f8e7d6c-5b4a-3c2b-1a09-8f7e6d5c4b3a",
    "status": "Authorised",
    "creation_timestamp": "2025-12-16T10:00:00+13:00",
    "status_updated_timestamp": "2025-12-16T10:05:00+13:00",
    "detail": {
      "type": "single",
      "flow": {
        "detail": {
          "type": "gateway",
          "redirect_uri": "https://www.yourwebsite.com/payment/complete"
        }
      },
      "pcr": {
        "particulars": "Invoice",
        "code": "12345",
        "reference": "Payment"
      },
      "amount": {
        "total": "25.00",
        "currency": "NZD"
      }
    },
    "payments": [
      {
        "payment_id": "9f8e7d6c-5b4a-3c2b-1a09-8f7e6d5c4b3a",
        "type": "single",
        "status": "AcceptedSettlementInProcess",
        "creation_timestamp": "2025-12-16T10:05:00+13:00",
        "status_updated_timestamp": "2025-12-16T10:06:00+13:00",
        "detail": {
          "consent_id": "9f8e7d6c-5b4a-3c2b-1a09-8f7e6d5c4b3a"
        },
        "refunds": []
      }
    ]
  }
}
```

## Payment Status Values

| Status | Description |
| --- | --- |
| `Pending` | Payment initiated, awaiting bank processing. |
| `AcceptedSettlementInProcess` | Bank has accepted the payment for processing. Treat as "in flight, not yet confirmed". |
| `AcceptedSettlementCompleted` | The payer's bank has sent funds via BECS. |
| `Rejected` | Payment rejected by bank, or the customer declined the consent. |
If the customer declines the payment, the consent status becomes `Rejected` and `consent.payments` contains a single payment record with `status: Rejected`. This means the most recent record in `consent.payments` tells you the outcome whether the payment was authorised or declined. The exception is a consent that never reached the bank at all — one that was revoked (`Revoked`), or that ran out of time before the customer authorised it — where `consent.payments` remains empty. Check `consent.status` for those cases rather than relying on the payments array.

> **WARNING**
>
> **Determining settlement: which fields to trust**
> 
> Use `payment.status = AcceptedSettlementCompleted` as the only signal that funds have settled.
> 
> Do **not** use `consent.status` to determine whether a payment has settled. `consent.status = Consumed` only means the consent has been used by a payment being created against it — the underlying payment may still be in flight, may settle later, or may be rejected. See the [payment lifecycle](concepts/payment-lifecycle#determining-settlement-which-fields-to-trust) for details.
> 
> `AcceptedSettlementCompleted` confirms that the payer's bank has sent the funds through BECS. It does not guarantee funds have arrived in your account. Always reconcile with actual bank statements.

## Sandbox Testing

| Setting | Value |
| --- | --- |
| Base URL | `https://sandbox.debit.blinkpay.co.nz` |
| Mock Bank | PNZ |
| Test Username | `user02` |
## Next Steps

- **[Single Payments](https://merchants.blinkpay.co.nz/docs/debit/guides/single-payments)** - Implement one-off payments with more control
- **[Recurring Payments](https://merchants.blinkpay.co.nz/docs/debit/guides/recurring-payments)** - Set up subscriptions and repeat billing

---

Source: https://merchants.blinkpay.co.nz/docs/shared/authentication

# Authentication

BlinkPay uses OAuth 2.0 client credentials flow for API authentication. This guide explains how to obtain and manage access tokens for secure API communication.

## Overview

All BlinkPay API requests require authentication using OAuth 2.0 Bearer tokens. Here's the authentication flow:

![OAuth 2.0 Authentication Flow](https://merchants.blinkpay.co.nz/docs/images/shared/oauth-flow.png)

## Getting API Credentials

Before you can authenticate, you need API credentials:

### Sandbox Credentials

1. Sign up for a BlinkPay account
2. Access your portal
3. Navigate to API Credentials section
4. Copy your **Client ID** and **Client Secret**

### Production Credentials

1. Complete integration in sandbox
2. Click "Upgrade to Production" in client portal
3. Complete certification process
4. Receive production credentials

> **WARNING**
>
> **Keep Credentials Secure**
> 
> Never commit credentials to source control or expose them in client-side code. Store them securely using environment variables or secret management systems.

## Redirect URI Whitelisting

Redirect URIs must be whitelisted for your merchant account before they can be used in consent requests. This applies to all flows — Gateway, Redirect, and Decoupled. Users with the Developer or Administrator role can register URIs in the client portal under Settings > API, separately for each environment (sandbox, production). If you don't have access, email [support@blinkpay.co.nz](mailto:support@blinkpay.co.nz) with the URI(s) you need registered.

Two formats are supported:

| Format | Example | Matches |
| --- | --- | --- |
| Exact | `https://app.example.com/callback` | Only `https://app.example.com/callback` (and subpaths like `/callback/success`) |
| Wildcard subdomain | `https://*.example.com/callback` | Any subdomain: `https://staging.example.com/callback`, `https://a.b.example.com/callback`, etc. |
Scheme (`https://`) and port must match exactly. Path uses prefix matching, so `/callback` also allows `/callback/success`. Wildcard entries match subdomains only — the bare domain (`example.com`) is not matched by `*.example.com` and must be registered separately.

The wildcard `*.` must appear at the very start of the hostname. Only a single `*.` prefix is allowed, and the domain after `*.` must have at least two labels (e.g., `*.example.com` is valid, `*.com` is not).

## Obtaining an Access Token

### Token Endpoint

**Sandbox:**

```text
POST https://sandbox.debit.blinkpay.co.nz/oauth2/token
```

**Production:**

```text
POST https://debit.blinkpay.co.nz/oauth2/token
```

### Request Format

The `client_credentials` grant type is the only supported grant type.

```http
POST /oauth2/token HTTP/1.1
Host: sandbox.debit.blinkpay.co.nz
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET
```

For language-specific examples, see our [SDK documentation on GitHub](https://github.com/BlinkPay).

### Success Response

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "view:metadata view:single_consent create:single_consent view:enduring_consent create:enduring_consent view:payment create:payment create:quick_payment"
}
```

**Response Fields:**

- `access_token` - The Bearer token to use for API requests
- `token_type` - Always "Bearer"
- `expires_in` - Token lifetime in seconds (3600 = 1 hour)
- `scope` - Granted permissions (space-separated list)

### Error Responses

**401 Unauthorised - Invalid Credentials:**

```json
{
  "error": "invalid_client",
  "error_description": "Client authentication failed"
}
```

**400 Bad Request - Invalid Grant Type:**

```json
{
  "error": "unsupported_grant_type",
  "error_description": "The authorisation grant type is not supported"
}
```

## Using Access Tokens

Include the access token in the `Authorization` header with the `Bearer` prefix:

```http
GET /payments/v1/payments/{payment_id} HTTP/1.1
Host: sandbox.debit.blinkpay.co.nz
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Token Management

### Token Expiration

Access tokens expire after **1 hour** (3600 seconds). Your application should:

1. Cache the token with its expiry time
2. Request a new token before expiry (e.g., 5 minutes before)
3. Handle concurrent requests with a single token refresh

### Handling 401 Errors

When you receive a 401 Unauthorised response:

1. **Request a new token** - Your token may have expired
2. **Retry the request** - Use the new token
3. **Check credentials** - If still failing, verify client ID and secret

### Token Caching

> **TIP**
>
> **Best Practice**
> 
> Cache access tokens until they expire rather than requesting a new token for every API call. This reduces latency and load on the auth server.

**Recommended Approach:**

- Cache token with expiry time
- Refresh 5 minutes before expiry
- Handle concurrent requests with a single token refresh
- Store token in memory (not in database for each request)

## OAuth 2.0 Scopes

BlinkPay uses scopes to control API access. The following scopes are available:

### Payment API Scopes

| Scope | Description |
| --- | --- |
| `view:metadata` | View API metadata |
| `view:single_consent` | Retrieve single consent details |
| `create:single_consent` | Create single consents |
| `view:enduring_consent` | Retrieve enduring consent details |
| `create:enduring_consent` | Create enduring consents |
| `revoke:single_consent` | Revoke a single consent that has not been Consumed |
| `revoke:enduring_consent` | Revoke an enduring payment consent |
| `view:payment` | Retrieve payment details |
| `create:payment` | Initiate payments |
| `view:transaction` | View transaction history |
| `create:quick_payment` | Create quick payments |
| `view:quick_payment` | View quick payments |
### Data API Scopes

| Scope | Description |
| --- | --- |
| `read:meta` | View API metadata |
| `manage:consents` | Create, retrieve, and revoke data consents |
| `read:accounts` | Retrieve account details |
| `read:balances` | Retrieve account balances |
| `read:transactions` | Retrieve account transaction history |
| `read:statements` | Retrieve account statements |
| `read:party` | Retrieve account holder (party) details |
### Scope Assignment

Scopes are assigned when your account is created. The access token response includes all granted scopes.

> **WARNING**
>
> **Scope Restrictions**
> 
> If you attempt to use an API endpoint without the required scope, you'll receive a 403 Forbidden error.

## Security Best Practices

### Credential Storage

Store credentials securely using environment variables or secret management systems (AWS Secrets Manager, HashiCorp Vault). Encrypt credentials at rest and restrict access to necessary personnel only. Never commit credentials to source control, store them in code files, expose them in client-side code, or share them via email or chat.

### Token Security

Transmit tokens over HTTPS only and store them in memory rather than localStorage in browsers. Implement token rotation if a compromise is suspected, and log authentication failures for monitoring. Never log full access tokens, send tokens in URL parameters, store tokens in cookies without secure flags, or share tokens between services unnecessarily.

### HTTPS Only

All API calls must use HTTPS. HTTP requests will be rejected.

### Credential Rotation

Rotate credentials every 90 days, immediately if compromised, or when staff with access leave. Use the Client Portal to rotate your client secret.

## Using Client SDKs

BlinkPay's official SDKs handle authentication automatically - just provide your credentials and the SDK manages the token lifecycle for you. SDKs are available for Java, Node.js, and PHP on [GitHub](https://github.com/BlinkPay).

## Testing Authentication

Use sandbox credentials to test authentication without affecting production. The [Postman Collection](https://merchants.blinkpay.co.nz/docs/shared/reference/postman) includes a pre-configured "Generate access token" request.

## Troubleshooting

For common authentication errors (invalid credentials, expired tokens, grant type issues) and their solutions:

[View Troubleshooting Guide →](https://merchants.blinkpay.co.nz/docs/shared/help/troubleshooting#authentication-issues)

## Next Steps

- **[Gateway Flow](https://merchants.blinkpay.co.nz/docs/shared/flows/gateway-flow)** - Start integrating payments

---

Source: https://merchants.blinkpay.co.nz/docs/debit/concepts/consent-types

# Consent Types

BlinkPay supports multiple consent types to accommodate different payment and data access scenarios. Choosing the right consent type is crucial for optimal user experience and compliance.

## Overview of Consent Types

| Consent Type | Use Case | Payment Count | Duration | API Endpoint |
| --- | --- | --- | --- | --- |
| **Single Consent** | One-off payment | 1 | One-time | `POST /single-consents` |
| **Quick Payment** | Simplified one-off | 1 | One-time | `POST /quick-payments` |
| **Enduring Consent** | Recurring payments | Multiple | Until revoked/expired | `POST /enduring-consents` |
| **Data Consent** | Account information | N/A | Until revoked/expired | `POST /consents` |
## Single Consent

**Purpose:** Traditional two-step payment flow for one-off transactions

### Characteristics

- ✅ Customer reviews and authorises payment amount before approval
- ✅ Clear distinction between consent and payment execution
- ✅ Maximum control and transparency for customer
- ✅ Can only be used once
- ❌ Requires two API calls (consent + payment)

### When to Use

Use single consents when:

- Customer needs to review exact amount before authorisation
- You need time between authorisation and payment execution
- Compliance requires explicit amount approval
- You're processing standard e-commerce purchases

### Flow

![Single Consent Flow](https://merchants.blinkpay.co.nz/docs/images/debit/single-consent-flow.png)

### Lifecycle

Once a single consent is used to create a payment, it transitions to `Consumed` and cannot be reused.

**Status progression:** `GatewayAwaitingSubmission` → `AwaitingAuthorisation` → `Authorised` → `Consumed`

For complete API request/response examples, see the [OpenAPI Specification](https://merchants.blinkpay.co.nz/) or our [SDK documentation on GitHub](https://github.com/BlinkPay).

## Quick Payment

**Purpose:** Streamlined single payment with automatic execution

### Characteristics

- ✅ One API call combines consent + payment
- ✅ Faster integration and simpler code
- ✅ Payment automatically created upon authorisation
- ✅ Best for straightforward checkout flows
- ⚠️ Amount is locked at consent creation
- ⚠️ Cannot defer payment execution

### When to Use

Use quick payments when:

- You need the simplest possible integration
- Payment should execute immediately after authorisation
- Amount is final at checkout
- You don't need to defer payment timing
- User experience priority is speed

### Flow

Quick payments follow the same flow as single consents, but the payment is automatically created upon authorisation—no separate payment API call is needed.

### Comparison with Single Consent

| Feature | Single Consent | Quick Payment |
| --- | --- | --- |
| API Calls | 2 (consent + payment) | 1 (combined) |
| Payment Timing | Controlled | Automatic |
| Code Complexity | Higher | Lower |
| Amount Changes | Fixed at consent | Fixed at consent |
| Use Case | Flexible | Simple |
A single consent fixes the amount and PCR at consent creation, so the payment call carries only the `consent_id`.

> **TIP**
>
> **Quick Payment Recommendation**
> 
> For most e-commerce checkouts, quick payments provide the best balance of simplicity and functionality. Use single consents only if you need to defer payment execution.

## Enduring Consent

**Purpose:** Recurring payments for subscriptions and scheduled billing

### Characteristics

- ✅ Multiple payments from one authorisation
- ✅ Customer sets maximum amounts and frequency
- ✅ Flexible payment amounts within limits
- ✅ Customer can revoke anytime
- ✅ Optional expiry date
- ⚠️ Requires careful compliance handling

### When to Use

Use enduring consents when:

- Processing subscription payments
- Recurring billing (monthly, weekly, etc.)
- Variable amounts within agreed limits
- Long-term payment relationship
- Customer wants ongoing authorisation

### Key Parameters

| Parameter | Purpose | Example |
| --- | --- | --- |
| `maximum_amount_period` | Maximum total amount per billing period | `$500.00` |
| `maximum_amount_payment` | Maximum per individual payment | `$100.00` |
| `period` | Billing period frequency | `daily`, `weekly`, `fortnightly`, `monthly`, `annual` |
| `from_timestamp` | Period calculation start date | `2025-01-01T00:00:00Z` |
| `expiry_timestamp` | Optional consent expiry date | `2026-01-01T00:00:00Z` |
### Period Calculation

The billing period resets based on `from_timestamp`. For example, a monthly consent starting January 1:

- **Jan 1-31**: Up to $500 total
- **Feb 1-28**: Period resets, another $500 available
- **Mar 1-31**: Period resets again

> **WARNING**
>
> **Period Tracking**
> 
> The period starts from `from_timestamp`, not from the first payment. Track remaining allowance in your application if you need to prevent exceeding limits.

### Variable Amounts

Enduring consents support variable payment amounts. Each payment can be for a different amount, as long as:

- Individual payment ≤ `maximum_amount_payment`
- Total in period ≤ `maximum_amount_period`

### Indefinite Consents

Omit `expiry_timestamp` for consents that don't expire. The consent remains valid until explicitly revoked by the customer or merchant.

> **TIP**
>
> **Customer Control**
> 
> Customers can revoke enduring consents at any time through their bank. Always handle revocation gracefully and provide a way for customers to revoke through your app as well.

### Managing Enduring Consents

- **Check status** before creating payments - verify consent is still `Authorised`
- **Handle revocation** - consent may be revoked by customer through their bank
- **Programmatic revocation** - use DELETE endpoint to revoke: `DELETE /payments/v1/enduring-consents/{consent_id}`

For complete API examples, see the [OpenAPI Specification](https://merchants.blinkpay.co.nz/) or our [SDK documentation on GitHub](https://github.com/BlinkPay).

## Data Consent

**Purpose:** Access customer account information (balances, transactions, account details)

Data consents are part of **Blink Data**, a separate product from payment processing. For complete documentation including permissions and implementation, see the [Blink Data documentation](https://merchants.blinkpay.co.nz/docs/data/overview).

## Choosing the Right Consent Type

### Decision Tree

```text
Need to access account data?
├─ Yes → Data Consent
└─ No → Need recurring payments?
    ├─ Yes → Enduring Consent
    └─ No → Need to defer payment execution?
        ├─ Yes → Single Consent
        └─ No → Quick Payment
```

### Use Case Matrix

| Use Case | Recommended Consent | Why |
| --- | --- | --- |
| E-commerce checkout | Quick Payment | Simplest, fastest |
| Invoice payment with approval | Single Consent | Review before payment |
| Monthly subscription | Enduring Consent | Recurring authorisation |
| Pay-per-use service | Enduring Consent | Variable amounts |
| Loan application | Data Consent | Need account verification |
| Budgeting app | Data Consent | Transaction history access |
| One-time donation | Quick Payment | Simple flow |
| Escrow payment | Single Consent | Delayed execution |
## Best Practices

✅ **Do:**

- Choose the simplest consent type for your use case
- Explain to customers what they're authorising
- Set reasonable maximums for enduring consents
- Provide easy revocation process
- Test all flows in sandbox

❌ **Don't:**

- Use enduring consents for one-off payments
- Set unrealistic maximum amounts
- Forget to handle consent revocation
- Assume indefinite consent validity

## Consent Comparison Summary

| Aspect | Single | Quick | Enduring | Data |
| --- | --- | --- | --- | --- |
| **API Calls** | 2 | 1 | 2+ | 1 |
| **Use Count** | Once | Once | Multiple | Multiple |
| **Duration** | One-time | One-time | Until revoked | Until expiry/revoked |
| **Amount** | Fixed | Fixed | Variable | N/A |
| **Timing** | Controlled | Immediate | Scheduled | On-demand |
| **Complexity** | Medium | Low | High | Medium |
---

Source: https://merchants.blinkpay.co.nz/docs/debit/concepts/consent-lifecycle

# Consent Lifecycle

Consents in BlinkPay follow a defined lifecycle from creation through authorisation to completion or termination. Understanding these states is crucial for proper error handling and user experience.

## Consent States Overview

Consents progress through these states, and the starting state depends on your flow:

- **Gateway Flow**: **GatewayAwaitingSubmission** → **AwaitingAuthorisation** → **Authorised** → **Consumed**
- **Redirect and Decoupled Flow**: **AwaitingAuthorisation** → **Authorised** → **Consumed**
- Card payments authenticate with 3DS instead of at a bank, so they skip **AwaitingAuthorisation**: **GatewayAwaitingSubmission** → **Authorised** → **Consumed**
- Alternative endings: **Rejected** or **Revoked** - plus **GatewayTimeout** for a Gateway Flow consent abandoned before the customer picks a bank

## State Descriptions

### GatewayAwaitingSubmission

**Initial state for Gateway Flow consents**

The consent has been created and is waiting for the customer to be redirected to the Blink Gateway. This is a transient state that occurs immediately after consent creation.

**Typical duration:** Seconds (until redirect)

**Next states:**

- `AwaitingAuthorisation` - Customer selected their bank at the Gateway and was sent to it to authorise
- `Authorised` - Card payment only: 3DS authentication succeeded
- `Rejected` - Card payment only: 3DS authentication failed
- `GatewayTimeout` - The Gateway session cutoff elapsed before the customer chose a bank - see [Authorisation timeouts](#authorisation-timeouts)

**Merchant actions:**

- Redirect customer to the `redirect_uri` returned in the consent response
- Display loading state or instruction to customer

> **TIP**
>
> **This state only applies to Gateway Flow. Redirect and Decoupled flows skip directly to `AwaitingAuthorisation`.**

### AwaitingAuthorisation

**Consent is waiting for customer approval at their bank**

The consent has reached the customer's bank and is waiting for them to authenticate and approve the request. **All three flows use this state**, and they reach it differently:

- **Redirect flow** - the customer has been redirected to their bank's authorisation page
- **Decoupled flow** - the request has been pushed to the customer's banking app; there is no redirect
- **Gateway flow** - the customer has chosen their bank at the Gateway and has been sent on to it

**Typical duration:** 1-5 minutes, bounded by the authorisation window for that bank and flow - see [Authorisation timeouts](#authorisation-timeouts)

**Next states:**

- `Authorised` - Customer approved the consent
- `Rejected` - Customer declined, the bank rejected it, or the authorisation window elapsed

**Merchant actions:**

- Display waiting/processing state to customer
- Don't refresh or poll too frequently
- Have fallback for timeout scenarios

### Authorised

**Customer has approved the consent**

The customer successfully authenticated with their bank and approved the consent. The consent is now ready to be used for payments (single or enduring) or data access.

**For single consents:**

- Transitions to `Consumed` when payment is created
- Consent can only be used once

**For enduring consents:**

- Remains in `Authorised` state
- Can be used for multiple payments
- May transition to `Revoked` if customer or merchant cancels

**For data consents:**

- Remains in `Authorised` state
- Can be used to retrieve account data
- May transition to `Revoked` or expire naturally

**Merchant actions:**

- Create payment(s) using the consent_id
- For enduring consents, store the consent_id securely
- Monitor for revocation events via webhooks

### Consumed

**Consent has been used by a payment and is no longer reusable** *(Final state)*

The consent has been used and cannot be reused for further payments.

**Applicable to:**

- Single consents - after a payment is created against the consent
- Quick payments - after the combined consent + payment is created
- Enduring consents - after the expiry date is reached

> **`Consumed` does not mean the payment has settled.** It only means the consent has been used by a payment being created against it. The underlying payment may still be `Pending`, `AcceptedSettlementInProcess`, `AcceptedSettlementCompleted`, or `Rejected`. Use `payment.status = AcceptedSettlementCompleted` as the only signal that funds have settled. See the [payment lifecycle settlement guide](payment-lifecycle#determining-settlement-which-fields-to-trust) for details.

**Merchant actions:**

- Track the associated payment status via the embedded `payments[]` array or the payment endpoint
- No further actions possible with this consent
- Create new consent for additional payments

### Rejected

**The consent was declined, or was never authorised in time** *(Final state)*

The consent was rejected either by:

- Customer declining at the bank
- Bank rejecting due to validation errors
- Insufficient permissions or account issues
- Authentication failures
- The authorisation window elapsing before the customer approved it

**Common reasons:**

- Customer clicked "Cancel" or "Decline"
- Customer never completed authorisation - see [Authorisation timeouts](#authorisation-timeouts)
- Customer failed authentication too many times
- Account doesn't support requested operation
- Insufficient funds (for payment consents)
- Technical issues at the bank

**Merchant actions:**

- Display appropriate error message to customer
- Offer to retry with new consent
- Don't retry automatically (customer explicitly declined)
- Log reason if provided by bank

For quick payments, a rejected consent also creates a payment record with `status: Rejected` in the embedded `payments[]` array, so the payment status reflects the outcome for both authorised and rejected quick payments.

> **TIP**
>
> **Error Details**
> 
> When a consent is rejected, check the error details in the consent response for specific reasons. This helps provide better feedback to customers.

### GatewayTimeout

**Gateway session expired before the customer chose a bank** *(Final state)*

The customer didn't select a bank within the Gateway session cutoff - see [Authorisation timeouts](#authorisation-timeouts). This state applies only while a Gateway Flow consent is still at the Gateway. Once the customer has reached a bank, an unauthorised consent ends as `Rejected` instead.

**Common causes:**

- Customer abandoned the flow before choosing a bank
- Customer closed the browser or app at the Gateway
- Technical issues prevented bank selection

**Merchant actions:**

- Inform customer the session expired
- Offer to restart the payment process
- Create new consent for retry

> **WARNING**
>
> **Timeout Prevention**
> 
> Keep the checkout flow simple and fast, clearly communicate what will happen, and minimise the steps before initiating the consent.

### Revoked

**Consent was cancelled** *(Final state)*

The consent was explicitly revoked by either:

- The customer (through their bank or your application)
- The merchant (via API)
- The bank (due to account closure, etc.)

**Revocation sources:**

- Customer action at bank
- Merchant calling `DELETE /payments/v1/single-consents/{consent_id}` or `DELETE /payments/v1/enduring-consents/{consent_id}`
- Automatic revocation (account closure, etc.)

**Merchant actions:**

- Stop any scheduled payments using this consent
- Remove consent_id from customer records
- Notify customer if revoked by merchant
- Offer to create new consent if needed

## Authorisation Timeouts

The time a customer has to authorise a consent is set per bank and per flow, not a single platform-wide figure. Windows currently run from about four to ten minutes, and are not always a whole number of minutes. Decoupled windows are usually the shorter of the two at a given bank, though not always. Read the live value for the bank you're sending the customer to from the [bank metadata endpoint](https://merchants.blinkpay.co.nz/docs/shared/reference/metadata#payment-metadata-fields) rather than assuming a fixed figure. Applying your own shorter cutoff is reasonable if it suits your checkout — just reconcile the consent afterwards rather than assuming it failed, since the customer may still authorise it.

Gateway Flow consents have a second, earlier cutoff - 15 minutes by default - that applies while the consent is still at the Gateway and the customer hasn't chosen a bank yet. Gateway Flow has no authorisation window of its own: once the customer picks a bank, that bank's redirect or decoupled window applies.

If the customer never returns, the consent ends as `Rejected` - or as `GatewayTimeout` if it was a Gateway Flow consent still waiting on bank selection. No payment is created and no funds move, so create a new consent if the customer wants to retry.

## Status Changes

These are the status changes you can expect to observe, and what causes each one:

| From State | To State | Applies to | Cause |
| --- | --- | --- | --- |
| GatewayAwaitingSubmission | AwaitingAuthorisation | Gateway | Customer chose their bank and was sent to it |
| GatewayAwaitingSubmission | Authorised | Gateway, card payments only | Card 3DS authentication succeeded |
| GatewayAwaitingSubmission | Rejected | Gateway, card payments only | Card 3DS authentication failed |
| GatewayAwaitingSubmission | GatewayTimeout | Gateway | Gateway session cutoff elapsed before bank selection |
| AwaitingAuthorisation | Authorised | Gateway, Redirect, Decoupled | Customer approved |
| AwaitingAuthorisation | Rejected | Gateway, Redirect, Decoupled | Customer or bank declined, or the authorisation window elapsed |
| Authorised | Consumed | All | Payment created (single) or expiry reached (enduring) |
| Authorised | Revoked | All | Consent cancelled |
Only Gateway Flow consents reach `GatewayAwaitingSubmission`, so the first four rows never apply to a redirect or decoupled integration.

Terminal states (`Consumed`, `Rejected`, `GatewayTimeout`, `Revoked`) are permanent - a consent never moves out of one. You can't reuse a consumed single consent, reauthorise a rejected one, revive a timed-out one, or un-revoke a revoked one, so **always create a new consent for retries**.

## Checking Consent Status

### API Polling

Retrieve consent status via the GET endpoint:

```http
GET /payments/v1/single-consents/{consent_id} HTTP/1.1
Host: sandbox.debit.blinkpay.co.nz
Authorization: Bearer {access_token}
```

**Polling recommendations:**

- Don't poll more than once every 2-3 seconds.
- The consent-authorisation phase (customer approving in their bank app) typically completes within a few minutes, bounded by the authorisation window for that bank and flow — see [Authorisation timeouts](#authorisation-timeouts).
- Once that window has elapsed, authorisation won't succeed. Ideally poll until the consent reaches a terminal state, since that is what confirms the outcome. If you'd rather stop at a cutoff of your own, make it at least as long as the bank's window and reconcile the consent afterwards rather than treating it as failed.
- Polling for **payment settlement** is a different concern and uses a longer window — see [payment lifecycle](payment-lifecycle).
- Webhooks are emitted only for individual FPE outcomes within a [Fixed Recurring Payment](https://merchants.blinkpay.co.nz/docs/debit/guides/fixed-recurring-payments#webhooks) schedule. Consent status changes do not currently emit webhooks — polling the consent endpoint or your decoupled-flow [`callback_url`](https://merchants.blinkpay.co.nz/docs/shared/flows/decoupled-flow#consent-authorisation-callback) (where supported) is the recommended way to track consent status.

### Callbacks (Decoupled Flow)

For Decoupled Flow, you can provide a `callback_url` in the consent request. BlinkPay will call this URL when the consent status changes, appending the consent ID (`cid`) as a query parameter.

## Handling Terminal States

| State | Recommended Action |
| --- | --- |
| **Consumed** | Consent has been used by a payment and is no longer reusable. **Does not imply the underlying payment has settled** — check `payments[].status` for that. Create a new consent for additional payments. |
| **Rejected** | Display friendly error message. Offer retry with new consent or alternative payment method. |
| **GatewayTimeout** | Inform customer the session expired. Offer to restart the payment process. |
| **Revoked** | Stop any scheduled payments for this consent. Notify customer if revoked by merchant. |
> **TIP**
>
> **Retry Guidance**
> 
> For `Rejected` and `GatewayTimeout` states, always create a **new consent** rather than attempting to reuse the existing one. Terminal states are permanent.

## Enduring Consent Lifecycle

Enduring consents (AutoPay) have a different lifecycle pattern than single consents:

1. **Create** - Enduring consent created with period limits and optional expiry
2. **Authorize** - Customer approves the consent
3. **Use** - Create multiple payments over time (consent stays `Authorised`)
4. **End** - Consent transitions to `Consumed` when expiry date is reached, or `Revoked` if cancelled

**Key difference from single consents:** Enduring consents remain in `Authorised` state for multiple payments until expiry or revocation.

### Expiry Behaviour

- **With `expiry_timestamp`**: Consent transitions to `Consumed` on that date
- **Without `expiry_timestamp`**: Consent remains `Authorised` indefinitely until explicitly revoked

## Best Practices

- **Always check consent status** before creating a payment - verify it's `Authorised`
- **Handle all terminal states** (`Consumed`, `Rejected`, `GatewayTimeout`, `Revoked`) gracefully
- **Create new consents for retries** - never try to reuse terminal state consents
- **Store consent IDs securely** for enduring consents to enable future payments

---

Source: https://merchants.blinkpay.co.nz/docs/debit/concepts/payment-lifecycle

# Payment Lifecycle

Payments in BlinkPay progress through a defined lifecycle from initiation through settlement. Understanding these states helps you provide accurate payment tracking and handle edge cases appropriately.

## Payment States Overview

```text
┌─────────┐     ┌─────────────────────────────┐     ┌─────────────────────────────┐
│ Pending │ ──► │ AcceptedSettlementInProcess │ ──► │ AcceptedSettlementCompleted │
└─────────┘     └─────────────────────────────┘     └─────────────────────────────┘
     │
     │ (if declined)
     ▼
┌──────────┐
│ Rejected │
└──────────┘
```

| State | Description |
| --- | --- |
| **Pending** | Payment created, awaiting bank response |
| **AcceptedSettlementInProcess** | Bank accepted, processing via BECS |
| **AcceptedSettlementCompleted** | Settlement complete, funds transferred |
| **Rejected** | Bank declined the payment, or the customer declined a quick payment consent |
## State Descriptions

### Pending

**Initial state immediately after payment creation**

The payment has been created via the BlinkPay API and submitted to the customer's bank for processing.

**Typical duration:** Seconds to minutes

**Next states:**

- `AcceptedSettlementInProcess` - Bank accepted and is processing
- `Rejected` - Bank rejected the payment

**What's happening:**

- Bank is validating the payment request
- Checking account status and available balance
- Applying fraud detection and compliance checks
- Determining if payment can be processed

**Merchant actions:**

- Display "Payment processing" status to customer
- Don't assume success until state changes
- Have timeout handling (typically resolves within minutes)

> **TIP**
>
> **Normal Behaviour**
> 
> Most payments transition from `Pending` to `AcceptedSettlementInProcess` within seconds. If a payment remains pending for more than 6 hours, contact support with the consent ID—banks occasionally have maintenance windows that can delay processing.

### AcceptedSettlementInProcess

**Bank has accepted and is processing the payment**

The customer's bank has accepted the payment and initiated the settlement process through the BECS (Bulk Electronic Clearing System).

**Typical duration:** 1-2 hours (can be longer for late-day payments)

**Next states:**

- `AcceptedSettlementCompleted` - Payment sent via BECS
- `Rejected` - Bank rejected the payment at settlement time (rare but possible)

**What's happening:**

- Funds are being debited from customer's account
- Payment is queued for BECS settlement
- Bank is preparing the direct credit instruction
- Payment will be included in next BECS batch

**Merchant actions:**

- Display "Payment in progress" or "Processing" to customer
- Can consider payment as successful for order fulfillment
- Final confirmation will come with `AcceptedSettlementCompleted`

> **WARNING**
>
> **Settlement Time**
> 
> Settlement timing is subject to the transfer times and rules of the BECS (Bulk Electronic Clearing System) and participating banks.

### AcceptedSettlementCompleted

**Payment sent to merchant's bank via BECS** *(Final state)*

The customer's bank has successfully sent the payment through BECS Direct Credit. This means the funds have been sent from the customer's bank to your merchant bank account.

**What this means:**

- Funds have been sent by the customer's bank
- Payment instruction is in the BECS system
- Your bank should receive funds shortly

**What this doesn't mean:**

- Funds are not guaranteed to be in your account yet
- Your bank may still be processing the incoming payment
- In rare cases, payments can still be reversed (e.g., account closed)

**Typical timing:**

- Most payments reach merchant bank within 2 hours
- Check your bank statement for actual receipt
- Settlement runs 365 days a year, including weekends and public holidays, within the daily SBI operating window

**Merchant actions:**

- Payment can be considered successful for most purposes
- Mark order as paid/fulfiled
- Send confirmation to customer
- Reconcile with bank statements using PCR fields

> **WARNING**
>
> **Avoid Duplicate Charges**
> 
> On an accepted payment from BlinkPay, do not also take a payment from another payment channel (e.g., credit card) that the customer may have on file. This could result in the customer being charged twice for the same order.

> **TIP**
>
> **Reconciliation**
> 
> Use the PCR (Particulars, Code, Reference) fields to match BlinkPay payments with entries in your bank statement. Each field can contain up to 12 characters.

### Rejected

**Bank rejected the payment** *(Final state)*

The payment was rejected by the customer's bank and will not be processed.

For quick payments, a payment record with `status: Rejected` is also created when the customer declines the consent — check `consent.status` to distinguish a declined consent from a payment the bank rejected after authorisation.

**Common rejection reasons:**

| Reason | Description |
| --- | --- |
| Insufficient Funds | Account doesn't have enough balance |
| Account Closed | Customer's account is no longer active |
| Invalid Account | Account number or details incorrect |
| Payment Blocked | Bank fraud detection or customer block |
| Exceeds Limits | Payment exceeds daily/transaction limits |
| Technical Error | Bank system issue |
**Merchant actions:**

- Notify customer of payment failure
- Provide rejection reason if available
- Offer alternative payment methods
- Don't automatically retry (address underlying issue first)
- Log rejection for analysis

> **DANGER**
>
> **Don't Auto-Retry**
> 
> Never automatically retry rejected payments. The customer needs to resolve the underlying issue (add funds, unblock account, etc.) before retrying.

## State Transition Timeline

```text
Time    State                           Action
------  ------------------------------  --------------------------------
0s      [Payment Created]
0-30s   Pending                         Bank validates payment
30s     AcceptedSettlementInProcess     Bank accepts, queues for BECS
2hr     AcceptedSettlementCompleted     Payment sent via BECS
2-4hr   [Funds in merchant account]     Merchant bank receives funds
```

## Settlement Process

### BECS Direct Credit

All BlinkPay payments use New Zealand's BECS (Bulk Electronic Clearing System) for Direct Credit transfers.

**How BECS works:**

1. Customer's bank debits their account
2. Payment instruction sent to BECS network
3. BECS routes payment to merchant's bank
4. Merchant's bank credits merchant account

**Settlement timing:**

- BlinkPay payments clear through BECS and settle via Settlement Before Interchange (SBI365), which processes 365 days a year — including weekends and public holidays
- Settlement runs multiple times a day within the daily SBI operating window (approx. 9am–midnight NZ time); payments made outside this window complete when it next opens
- Timing is also subject to individual bank processing schedules

### Settlement Guarantees

> **WARNING**
>
> **Important: Settlement vs Receipt**
> 
> `AcceptedSettlementCompleted` verifies that the funds have been **sent** by the payer's bank, not that they've been **received** by your bank.
> 
> While payments rarely fail after this point, there may be limited circumstances where the merchant bank does not accept funds sent to it—for example, if it has reason to suspect fraudulent activity. Always reconcile with your actual bank statements.

**Best practice:**

- Consider `AcceptedSettlementCompleted` as "paid" for fulfillment
- Reconcile with actual bank statements
- Have process for handling rare post-settlement reversals

### Determining settlement: which fields to trust

> Use `payment.status = AcceptedSettlementCompleted` as the only signal that the payment has succeeded and the payer's bank has sent the funds. Do **not** use `consent.status` to determine this — a `Consumed` consent only means it has been used to create a payment, not that the payment succeeded.

### Settlement Speed

Settlement timing varies based on when the payment is initiated and the participating banks' processing schedules. Payments clear through BECS and settle via SBI365, which runs 365 days a year within a daily operating window (approx. 9am–midnight NZ time). Most payments settle within about 2 hours; a payment initiated outside the operating window completes once it next opens.

**Factors affecting settlement:**

- Time payment is initiated
- Individual bank processing schedules
- Time of day relative to the daily SBI operating window
- BECS batch processing times

## Checking Payment Status

### API Polling

Retrieve payment status via API:

```http
GET /payments/v1/payments/{payment_id} HTTP/1.1
Host: sandbox.debit.blinkpay.co.nz
Authorization: Bearer {access_token}
```

> **WARNING**
>
> **Required: poll to a terminal status — don't assume success early**
> 
> - **Poll** the payment endpoint until it reaches a terminal status (`AcceptedSettlementCompleted` or `Rejected`) or you hit a sensible timeout — then fall back to your [wash-up](#run-a-periodic-wash-up).
> - **Do not** treat an intermediate status (`Pending` or `AcceptedSettlementInProcess`) as "paid" — these mean the payment is in flight, not complete.
> - **The success signal is `payment.status = AcceptedSettlementCompleted`** — confirmation that the payer's bank has sent the funds. Don't infer this from `consent.status`; see [Determining settlement](#determining-settlement-which-fields-to-trust) for which fields to trust.

**Polling recommendations:**

- Poll every 30-60 seconds until the payment reaches a terminal status (`AcceptedSettlementCompleted` or `Rejected`).
- Bank settlement timing is asynchronous and varies by bank and BECS processing schedule (see [Settlement Speed](#settlement-speed) above). A payment initiated late in the day may not reach `AcceptedSettlementCompleted` until the SBI operating window next opens the following morning. Plan your polling window accordingly, and use bank-statement reconciliation as the final source of truth for fund receipt.
- Webhooks are emitted only for individual FPE outcomes within a [Fixed Recurring Payment](https://merchants.blinkpay.co.nz/docs/debit/guides/fixed-recurring-payments#webhooks) schedule. Single, quick, and one-off enduring payments do not currently emit settlement webhooks — poll instead.

## Payment Reconciliation

> **TIP**
>
> **Reconcile against your own bank records**
> 
> We recommend running regular bank reconciliation against your settlement account — confirm every payment you expect has arrived, and that the amount received matches the amount expected. Your own bank account is the source of truth for whether funds were actually received: `AcceptedSettlementCompleted` confirms the payer's bank *sent* the funds via BECS, but does not by itself guarantee receipt (see [Settlement Guarantees](#settlement-guarantees)).

### Using PCR Fields

Match payments to bank statements using Particulars, Code, and Reference (PCR) fields. Each field supports up to **12 characters**.

| Field | Purpose | Example |
| --- | --- | --- |
| Particulars | Primary identifier | `INV-123456` |
| Code | Transaction type | `SALE` |
| Reference | Secondary identifier | `CUST-789` |
> **TIP**
>
> **PCR Best Practices**
> 
> - Use consistent formats across all payments
> - Include unique identifiers (invoice #, order #)
> - **Avoid customer personal information** (names, addresses, contact details) — PCR fields appear on the customer's and your own bank statements, so use opaque identifiers (e.g. a customer or order ID) rather than personal data
> - Document your PCR schema for your accounting team
> - **Allowed characters:** Letters, numbers, spaces, and common punctuation (hyphen, ampersand, hash, question mark, colon, underscore, forward slash, comma, period, apostrophe)

### Run a periodic wash-up

Real-time [polling](#api-polling) resolves the vast majority of payments quickly, but some are still reported by the bank as non-terminal (`Pending` or `AcceptedSettlementInProcess`) when your polling window ends — for example payments initiated late in the day (outside the SBI operating window) or during a [bank maintenance window](https://merchants.blinkpay.co.nz/docs/shared/help/troubleshooting). If your integration stops polling at that point, those payments can be left in a stale state in your own records even though the bank later resolved them.

To catch these, run a recurring **wash-up** (a sweep) on a schedule that suits your business — every 12 hours is a sensible default, but anything from a few hours to daily works depending on volume and how quickly you need certainty:

1. Query your own records for any payment you still hold as `Pending` or `AcceptedSettlementInProcess` and older than your normal polling window (e.g. older than 6 hours, or from a previous day).
2. Re-fetch each one via `GET /payments/v1/payments/{payment_id}` to pull it to its current status.
3. Update your records to the bank's terminal status (`AcceptedSettlementCompleted` or `Rejected`) and reconcile it against your bank statement.

> **TIP**
>
> **Why a wash-up matters**
> 
> The wash-up is a safety net for payments that outlive a single polling session — it catches the rare cases where settlement actually completed but the status update was delayed. The vast majority of payments resolve on their own, and if you run thorough bank reconciliation you may well catch these there instead. But not every integration has that in place, so we recommend the wash-up as a simple, programmatic way to make sure no payment is left sitting as "processing" in your system.

## Refunds

### Refund Types

| Refund Type | Status | Description |
| --- | --- | --- |
| **Account Number Refund** | ✅ Supported | Retrieve customer's verified bank account and process refund via your bank |
| **Full Refund** | ❌ Not yet supported | API-initiated refund for the full payment amount |
| **Partial Refund** | ❌ Not yet supported | API-initiated refund for less than the full amount |
### Available Refund Option

**Account Number Refund:** When a payment is completed, BlinkPay can expose the verified bank account number that the customer used to make the payment. This allows you to process refunds through your own banking channels (internet banking or direct credit).

To access the customer's verified account details for refund purposes, contact BlinkPay support.

### Refund Processing

Until API refunds are available:

1. Retrieve the customer's verified bank account from the payment details
2. Process the refund as a direct credit through your bank
3. Use PCR fields to identify the refund in your records

> **TIP**
>
> **Refund Best Practice**
> 
> Include the original payment reference in the refund particulars so the customer can identify the credit on their statement.

## Troubleshooting

### Long-Running Pending Status

If a payment stays `Pending` for more than 6 hours, contact support with the consent ID. Banks occasionally have maintenance windows that can delay processing.

### Settlement Timing

Settlement runs 365 days a year, including weekends and public holidays (SBI365), so weekend and holiday payments are no longer held to the next business day. Payments initiated outside the daily SBI operating window (approx. 9am–midnight NZ time) complete once it next opens. Settlement timing remains subject to individual bank processing schedules.

---

Source: https://merchants.blinkpay.co.nz/docs/shared/flows/gateway-flow

# Gateway Flow

The Gateway Flow is the **strongly recommended integration method** for most use cases. BlinkPay hosts an interface that handles bank selection and customer authentication, significantly reducing your integration complexity.

This flow works for both Payment APIs (PayNow, AutoPay) and Data APIs, providing a consistent experience across all BlinkPay products. For Payment API integrations, the Gateway also supports [card payments](https://merchants.blinkpay.co.nz/docs/debit/guides/card-payments) — when enabled, the gateway presents card as a payment option alongside bank accounts.

> **TIP**
>
> **Strongly Recommended**
> 
> Use Gateway Flow unless you have specific requirements for complete UX control. It's the fastest to implement, handles all compliance requirements automatically, and adapts as banks add new features.

## What BlinkPay Gateway Handles

The Gateway manages the complete payment authorisation experience. It presents a bank selection interface, automatically chooses the optimal authentication flow based on the customer's device, collects any required identifiers for decoupled flow, and handles the redirect orchestration between your site, the gateway, and the bank. For Payment API integrations, the gateway can also render a secure card payment form when [card payments](https://merchants.blinkpay.co.nz/docs/debit/guides/card-payments) are enabled.

All interactions comply with Payments NZ industry guidelines, and the gateway gracefully handles errors including timeouts, rejections, and bank-specific issues.

## Why Use Gateway Flow?

Gateway Flow is the fastest path to integration. You don't need to build bank selection UI, implement compliance workflows, or handle bank-specific authentication logic. The gateway optimises the experience for each bank and device type, and automatically enables new features as banks add capabilities—no code changes required on your end.

## How Gateway Flow Works

The Gateway handles both [Redirect](https://merchants.blinkpay.co.nz/docs/shared/flows/redirect-flow) and [Decoupled](https://merchants.blinkpay.co.nz/docs/shared/flows/decoupled-flow) authentication flows under the hood—customers select their preferred method during the consent process, and the gateway manages the technical details automatically.

## User Experience in Gateway

After selecting their bank, customers choose how to approve the consent. The gateway presents appropriate options based on their platform and bank.

On **desktop**, customers typically see "Internet banking website" (opens their bank's site in a new tab) or "Send to app" (enter mobile number to receive a notification on their banking app). On **mobile**, most banks support "Open in app" which deep links directly to the banking app for a seamless experience. BNZ is the exception—it uses browser-based authentication on all devices.

> **TIP**
>
> **Faster Experience for Repeat Customers**
> 
> To enhance the consent experience for repeat customers, provide your customer's previous `consent_id` in the gateway request. When BlinkPay provides this to the bank, the customer can be identified without re-entering their phone number, email, or banking username. They simply approve the new consent directly in their mobile banking app.
> 
> Provide the last successful Consent ID (status `Authorised` or `Consumed`) in Gateway Flow requests to activate this feature.

## Consent Timeout

Gateway consents timeout after **15 minutes** of inactivity if the customer doesn't begin the authorisation process. Once they've chosen a bank and been sent to it, that bank's own authorisation window applies instead — currently between about four and ten minutes, depending on the bank and flow.

## Integration Steps

### Step 1: Create Consent with Gateway Flow

When creating a consent, specify `gateway` as the flow type. The example below shows a Payment API single consent — for Data API consents, see [Data Retrieval](https://merchants.blinkpay.co.nz/docs/data/guides/data-retrieval).

**Payment API — Single Consent (PayNow):**

```http
POST /payments/v1/single-consents HTTP/1.1
Host: sandbox.debit.blinkpay.co.nz
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "flow": {
    "detail": {
      "type": "gateway",
      "redirect_uri": "https://www.yourwebsite.com/payment/callback",
      "flow_hint": {
        "type": "redirect"
      }
    }
  },
  "amount": {
    "currency": "NZD",
    "total": "45.00"
  },
  "pcr": {
    "particulars": "Invoice 123",
    "code": "INV123",
    "reference": "Payment"
  }
}
```

**Payment API — Quick Payment:**

```http
POST /payments/v1/quick-payments HTTP/1.1
Host: sandbox.debit.blinkpay.co.nz
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "flow": {
    "detail": {
      "type": "gateway",
      "redirect_uri": "https://www.yourwebsite.com/payment/callback",
      "flow_hint": {
        "type": "redirect"
      }
    }
  },
  "amount": {
    "currency": "NZD",
    "total": "45.00"
  },
  "pcr": {
    "particulars": "Invoice 123",
    "code": "INV123",
    "reference": "Payment"
  }
}
```

**Payment API — Enduring Consent (AutoPay):**

```http
POST /payments/v1/enduring-consents HTTP/1.1
Host: sandbox.debit.blinkpay.co.nz
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "flow": {
    "detail": {
      "type": "gateway",
      "redirect_uri": "https://www.yourwebsite.com/payment/callback",
      "flow_hint": {
        "type": "redirect"
      }
    }
  },
  "maximum_amount_period": {
    "currency": "NZD",
    "total": "500.00"
  },
  "period": "monthly",
  "from_timestamp": "2024-12-16T00:00:00Z",
  "expiry_timestamp": "2025-12-16T00:00:00Z"
}
```

**Response:**

```json
{
  "consent_id": "3a3b7f7d-f8e6-4c3e-b2a1-5f9c8d7e6a5b",
  "redirect_uri": "https://secure.blinkpay.co.nz/gateway/pay/3a3b7f7d-f8e6-4c3e-b2a1-5f9c8d7e6a5b"
}
```

### Step 2: Redirect Customer to Gateway

Your backend should securely pass the `redirect_uri` to your frontend, which then redirects the customer to the gateway:

```html
<!-- Redirect button -->
<a href="{{ redirect_uri }}" class="btn-pay"> Continue to Payment </a>

<!-- Or automatic redirect -->
<script>
  window.location.href = '{{ redirect_uri }}';
</script>
```

### Step 3: Customer Experience at Gateway

When redirected to the Gateway, customers see the consent details, select their bank, choose an authentication method, and complete authorisation at their bank. For Payment API integrations with [card payments](https://merchants.blinkpay.co.nz/docs/debit/guides/card-payments) enabled, the gateway also presents a card payment option.

![Gateway Customer Experience](https://merchants.blinkpay.co.nz/docs/images/shared/gateway-customer-flow.png)

### Step 4: Handle Return Callback

After authorisation (or cancellation), the customer is redirected back to your `redirect_uri`:

```text
https://www.yourwebsite.com/payment/callback?cid=3a3b7f7d-f8e6-4c3e-b2a1-5f9c8d7e6a5b
```

**Query Parameters:**

- `cid` - Consent ID
- `error` - (Optional) Error message if something went wrong

> **WARNING**
>
> **Always Verify via API**
> 
> The redirect URL does not indicate the final result. You must call the API to retrieve the consent status. An `error` parameter may be present if something went wrong, but the absence of an error does not guarantee success.

### Step 5: Verify Consent Status

Always verify the consent status on your backend by calling the GET endpoint for the consent before proceeding. This is the only reliable way to determine the outcome.

## Flow Hints

The `flow_hint` parameter tells Gateway which authentication method to optimise for:

### Redirect Flow Hint

```json
{
  "flow_hint": {
    "type": "redirect"
  }
}
```

Best for desktop users and browser-based checkout flows. The gateway offers redirect-based authentication, opening the bank website or deep linking to the app on mobile.

### Decoupled Flow Hint

```json
{
  "flow_hint": {
    "type": "decoupled",
    "bank": "BNZ",
    "identifier_type": "consent_id",
    "identifier_value": "prev_consent_id_123"
  }
}
```

Best for returning customers with previous consents or when customers prefer app authorisation. The gateway can pre-fill bank selection and the customer authorises on their mobile device.

> **TIP**
>
> **Smart Flow Selection**
> 
> If you don't specify a flow hint, Gateway will intelligently select the best option based on device type and customer history.

## Gateway Features

The gateway provides a polished, accessible bank selection interface with visual logos and search capability. It's fully responsive and WCAG 2.1 AA compliant.

### Automatic Flow Optimisation

Gateway automatically selects the optimal authentication flow for each bank:

| Bank | Mobile Device | Desktop Device |
| --- | --- | --- |
| **ANZ** | App deep link | Send to app (QR code for redirect) |
| **ASB** | App deep link | Send to app (QR code for redirect) |
| **BNZ** | Send to app | Redirect to website |
| **Kiwibank** | Redirect to website | Redirect to website |
| **Westpac** | App deep link | Redirect to website |
### Error Handling

Gateway handles common error scenarios gracefully, showing clear messages to customers for session timeouts, bank errors, and rejections. Customers can restart payments, try different banks, or return to your site as appropriate.

## Advanced Configuration

### Custom Branding

You can display your brand logo on the Gateway. Configure co-branding options in the [BlinkPay Client Portal](https://merchants.blinkpay.co.nz/).

### Metadata

Attach metadata to track additional information. This example shows a Payment API consent — Data API consents support metadata in the same way.

```json
{
  "flow": {
    "detail": {
      "type": "gateway",
      "redirect_uri": "https://www.yourwebsite.com/payment/callback"
    }
  },
  "amount": {
    "currency": "NZD",
    "total": "45.00"
  },
  "pcr": {
    "particulars": "Invoice 123",
    "code": "INV123",
    "reference": "Payment"
  },
  "metadata": {
    "order_id": "ORD-12345",
    "customer_id": "CUST-67890",
    "campaign": "summer-sale"
  }
}
```

Metadata is returned with consent responses for reconciliation.

## Gateway URLs

The gateway URL is returned in the `redirect_uri` field of the consent response—always use the URL provided by the API rather than hardcoding.

> **TIP**
>
> **Testing**
> 
> Use sandbox to test the complete customer journey without real banking credentials. Select "PNZ" as the mock bank.

## Troubleshooting

For common issues and solutions, see the [Troubleshooting Guide](https://merchants.blinkpay.co.nz/docs/shared/help/troubleshooting).

**Quick checks:**

- Gateway not loading? Verify your `redirect_uri` is correct and check for ad blockers
- Customer redirected back immediately? Check consent status—may be `Rejected` or `GatewayTimeout`
- Wrong redirect location? Ensure URL is fully qualified (includes https://) and whitelisted

## Best Practices

**Redirect URIs:** Always use HTTPS, include order/transaction IDs for tracking, and handle both success and failure scenarios. Never trust query parameters alone—always verify consent status on your backend. If you use multiple subdomains, consider registering a wildcard entry (e.g., `https://*.example.com/callback`) rather than individual URIs. See [Redirect URI Whitelisting](https://merchants.blinkpay.co.nz/docs/shared/authentication#redirect-uri-whitelisting) for details.

**User Experience:** Show loading states while creating consents, provide clear instructions before redirect, and offer "Try again" options for failures. Don't use iFrames (not supported) or popups (may be blocked).

---

Source: https://merchants.blinkpay.co.nz/docs/shared/flows/redirect-flow

# Redirect Flow

Redirect Flow (also known as Pay by Bank) is a browser-based authentication method where customers are redirected directly to their bank and then back to your application after authorization.

## Overview

In Redirect Flow, the customer:

1. Initiates payment on your website/app
2. Selects their bank (you provide the UI)
3. Gets redirected to their bank's website or mobile app
4. Authenticates and authorises the payment
5. Gets redirected back to your website/app

![Redirect Flow Diagram](https://merchants.blinkpay.co.nz/docs/images/shared/redirect-flow-detailed.png)

## When to Use Redirect Flow

Use Redirect Flow when you need full control over the bank selection UI, custom branding throughout the flow, or specific UX patterns for your use case.

For most integrations, [Gateway Flow](https://merchants.blinkpay.co.nz/docs/shared/flows/gateway-flow) is recommended—it handles bank selection, device optimisation, and compliance automatically.

## Bank Support

### Redirect Flow Behaviour by Bank

| Bank | Desktop | Mobile |
| --- | --- | --- |
| **ANZ** | Redirect to website | Deep link to app |
| **ASB** | Redirect to website | Deep link to app |
| **BNZ** | Redirect to website | Redirect to website* |
| **Kiwibank** | Redirect to website | Redirect to website |
| **Westpac** | Redirect to website | Deep link to app |
* BNZ does not support mobile app deep linking

> **TIP**
>
> **Mobile Experience**
> 
> On mobile devices, most banks will deep link directly to their mobile app, providing a seamless app-to-app experience.

## Integration Steps

### Step 1: Build Bank Selection UI

Create a UI for customers to select their bank:

```html
<div class="bank-selector">
  <h2>Select Your Bank</h2>

  <button class="bank-button" data-bank="ANZ">
    <img src="/images/banks/anz-logo.png" alt="ANZ" />
    <span>ANZ</span>
  </button>

  <button class="bank-button" data-bank="ASB">
    <img src="/images/banks/asb-logo.png" alt="ASB" />
    <span>ASB</span>
  </button>

  <button class="bank-button" data-bank="BNZ">
    <img src="/images/banks/bnz-logo.png" alt="BNZ" />
    <span>BNZ</span>
  </button>

  <button class="bank-button" data-bank="Westpac">
    <img src="/images/banks/westpac-logo.png" alt="Westpac" />
    <span>Westpac New Zealand</span>
  </button>
</div>

<script>
  document.querySelectorAll('.bank-button').forEach((button) => {
    button.addEventListener('click', async (e) => {
      const bank = e.currentTarget.dataset.bank;
      await initiatePayment(bank);
    });
  });
</script>
```

**Bank Identifiers:**

- ANZ: `"ANZ"`
- ASB: `"ASB"`
- BNZ: `"BNZ"`
- Kiwibank: `"Kiwibank"`
- Westpac: `"Westpac"`

### Step 2: Create Consent with Redirect Flow

When customer selects a bank, create a consent specifying redirect flow:

**For Single Consents (PayNow):**

```http
POST /payments/v1/single-consents HTTP/1.1
Host: sandbox.debit.blinkpay.co.nz
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "flow": {
    "detail": {
      "type": "redirect",
      "bank": "ANZ",
      "redirect_uri": "https://www.yourwebsite.com/payment/callback"
    }
  },
  "amount": {
    "currency": "NZD",
    "total": "75.00"
  },
  "pcr": {
    "particulars": "Invoice",
    "code": "12345",
    "reference": "Payment"
  }
}
```

**For Quick Payments:**

```http
POST /payments/v1/quick-payments HTTP/1.1
Host: sandbox.debit.blinkpay.co.nz
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "flow": {
    "detail": {
      "type": "redirect",
      "bank": "ANZ",
      "redirect_uri": "https://www.yourwebsite.com/payment/callback"
    }
  },
  "amount": {
    "currency": "NZD",
    "total": "75.00"
  },
  "pcr": {
    "particulars": "Invoice",
    "code": "12345",
    "reference": "Payment"
  }
}
```

**For Enduring Consents (AutoPay):**

```http
POST /payments/v1/enduring-consents HTTP/1.1
Host: sandbox.debit.blinkpay.co.nz
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "flow": {
    "detail": {
      "type": "redirect",
      "bank": "ANZ",
      "redirect_uri": "https://www.yourwebsite.com/payment/callback"
    }
  },
  "maximum_amount_period": {
    "currency": "NZD",
    "total": "500.00"
  },
  "period": "monthly",
  "from_timestamp": "2024-12-16T00:00:00Z"
}
```

**Response:**

```json
{
  "consent_id": "8f7e6d5c-4b3a-2c1b-0a09-8f7e6d5c4b3a",
  "redirect_uri": "https://api-nomatls.apicentre.middleware.co.nz/middleware-nz-ais/open-banking-nz/v2.3/consents/..."
}
```

> **WARNING**
>
> **Bank-Specific URLs**
> 
> The `redirect_uri` returned by BlinkPay is the bank's authorization URL. It's different for each bank and will redirect the customer to their bank's platform.

### Step 3: Redirect Customer to Bank

Your backend should securely pass the `redirect_uri` to your frontend, which then immediately redirects the customer to the bank's authorization URL.

### Step 4: Customer Authorization at Bank

The customer is now at their bank's platform where they authenticate with their banking credentials, review the payment details, select their account, and confirm the authorization.

On desktop, all banks redirect to their internet banking website. On mobile, ANZ, ASB, and Westpac deep link to their mobile apps for a native experience, while BNZ and Kiwibank use web-based authorization on all devices.

### Step 5: Handle Return Callback

After authorization, the customer is redirected back to your `redirect_uri`:

```text
https://www.yourwebsite.com/order/12345/complete?cid=8f7e6d5c-4b3a-2c1b-0a09-8f7e6d5c4b3a
```

**Query Parameters:**

- `cid` - Consent ID
- `error` - (Optional) Error message if something went wrong

The redirect URL does not indicate the final result—you must verify via API.

### Step 6: Verify and Complete Payment

Always verify consent status on your backend by calling the GET endpoint for the consent. Confirm status is `Authorised`, then create the payment. For enduring consents, include amount and PCR details. Poll payment status until completion.

## Mobile App Integration

For mobile apps, use `SFSafariViewController` (iOS) or Chrome Custom Tabs (Android) rather than WebViews. Handle custom URL schemes for return URLs and test deep linking to banking apps on real devices.

For complete implementation guidance, see the [Mobile Integration Guide](https://merchants.blinkpay.co.nz/docs/shared/flows/mobile-integration).

> **WARNING**
>
> **App Scheme Whitelisting Required**
> 
> To enable a seamless app-to-app return experience, your custom URL scheme (e.g., `myapp://`) must be whitelisted with BlinkPay. Without whitelisting, customers returning from the bank will land in a standard browser instead of returning directly to your app—breaking the native experience.
> 
> Contact BlinkPay to register your app's custom URL scheme before going live.

> **WARNING**
>
> **iFrames Not Supported**
> 
> iFrames cannot be used due to bank security policies. WebViews work but secure browser components are recommended.

## Troubleshooting

For common issues and solutions, see the [Troubleshooting Guide](https://merchants.blinkpay.co.nz/docs/shared/help/troubleshooting).

**Quick checks:**

- Redirect loop? Ensure callback handling doesn't re-initiate payment
- Bank page not loading? Check bank is operational and customer has online banking enabled
- Deep link not working? Ensure banking app is installed and up to date
- Consent not authorised? Customer may have cancelled or session timed out—check the specific status

## Best Practices

**Bank Selection UI:** Show all four major banks with official logos. Make buttons touch-friendly, show loading states during redirect, and always provide a cancel option.

**Redirect Handling:** Always validate consent status on your backend—never trust query parameters alone. Handle both outcomes (`Authorised` and `Rejected`) and provide clear retry options. Status values are case-sensitive.

**Mobile:** Use secure browser components (Custom Tabs/SFSafariViewController) rather than WebViews. Test on real devices and provide fallback to web browser if deep linking fails.

## Testing

Test in sandbox with the mock bank "PNZ" and username `user02`. Before going live, test with real banks using small amounts ($0.01) across multiple devices and browsers.

[View going live checklist →](https://merchants.blinkpay.co.nz/docs/shared/help/going-live)

---

Source: https://merchants.blinkpay.co.nz/docs/shared/flows/decoupled-flow

# Decoupled Flow

Decoupled Flow (also known as Pay by Mobile) allows customers to authorise payments on a different device or at a different time using their banking mobile app.

## Overview

Decoupled Flow separates the authorisation process from the initial payment request:

1. Customer initiates payment on your website or app
2. You create a consent with decoupled flow
3. Customer receives authorisation request on their mobile device
4. Customer authorises using their banking app
5. You poll for authorisation status and complete payment

![Decoupled Flow Diagram](https://merchants.blinkpay.co.nz/docs/images/shared/decoupled-flow-detailed.png)

## When to Use Decoupled Flow

Decoupled Flow is best for scenarios where authorisation happens asynchronously—bill payment systems, desktop-initiated transfers where customers prefer mobile authorisation, recurring payment setup, and returning customers with saved payment methods.

For most integrations, [Gateway Flow](https://merchants.blinkpay.co.nz/docs/shared/flows/gateway-flow) is recommended as it handles flow selection automatically. If customers are already on mobile, use Redirect Flow with app deep linking instead.

## Bank Support

### Decoupled Flow Support by Bank

| Bank | Login Hint Required | Push Notifications | Notes |
| --- | --- | --- | --- |
| **ANZ** | Mobile number or consent ID | ❌ No | Customer must manually check app |
| **ASB** | Mobile number or consent ID | ✅ Yes | If enabled in app settings |
| **BNZ** | Mobile number, email, or consent ID | ✅ Yes |  |
| **Kiwibank** | Consent ID | ❌ No | Customer must manually check app |
| **Westpac** | Banking username (9-digit customer ID) or consent ID | ✅ Yes | If enabled in app settings |
> **WARNING**
>
> **ANZ Limitation**
> 
> ANZ currently does not support push notifications for decoupled flow. Customers must manually open their app to see pending authorisation requests.

> **WARNING**
>
> **Kiwibank Limitation**
> 
> Kiwibank currently does not support push notifications for decoupled flow. Customers must manually open their app to see pending authorisation requests.

## Integration Steps

### Step 1: Collect Login Hint

Decoupled flow requires a login hint to identify the customer at their bank:

| Bank | Supported Identifiers |
| --- | --- |
| **ANZ** | Mobile number or previous consent ID |
| **ASB** | Mobile number or previous consent ID |
| **BNZ** | Mobile number, email, or previous consent ID |
| **Kiwibank** | Previous consent ID |
| **Westpac** | Banking username (9-digit customer ID) or previous consent ID |
> **TIP**
>
> **Using Previous Consents**
> 
> If you've previously created a consent for this customer, using the consent ID as a login hint is the easiest option and works with all banks.

### Step 2: Create Consent with Decoupled Flow

**For Single Consents (PayNow):**

```http
POST /payments/v1/single-consents HTTP/1.1
Host: sandbox.debit.blinkpay.co.nz
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "flow": {
    "detail": {
      "type": "decoupled",
      "bank": "ANZ",
      "identifier_type": "mobile_number",
      "identifier_value": "+64212345678",
      "callback_url": "https://www.yourwebsite.com/webhooks/consent-status"
    }
  },
  "amount": {
    "currency": "NZD",
    "total": "45.00"
  },
  "pcr": {
    "particulars": "Invoice",
    "code": "12345",
    "reference": "Payment"
  }
}
```

**For Quick Payments:**

```http
POST /payments/v1/quick-payments HTTP/1.1
Host: sandbox.debit.blinkpay.co.nz
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "flow": {
    "detail": {
      "type": "decoupled",
      "bank": "ANZ",
      "identifier_type": "mobile_number",
      "identifier_value": "+64212345678",
      "callback_url": "https://www.yourwebsite.com/webhooks/payment-status"
    }
  },
  "amount": {
    "currency": "NZD",
    "total": "45.00"
  },
  "pcr": {
    "particulars": "Invoice",
    "code": "12345",
    "reference": "Payment"
  }
}
```

**For Enduring Consents (AutoPay):**

```http
POST /payments/v1/enduring-consents HTTP/1.1
Host: sandbox.debit.blinkpay.co.nz
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "flow": {
    "detail": {
      "type": "decoupled",
      "bank": "Westpac",
      "identifier_type": "banking_username",
      "identifier_value": "349373893",
      "callback_url": "https://www.yourwebsite.com/webhooks/consent-status"
    }
  },
  "maximum_amount_period": {
    "currency": "NZD",
    "total": "500.00"
  },
  "period": "monthly",
  "from_timestamp": "2024-12-16T00:00:00Z"
}
```

**Response:**

```json
{
  "consent_id": "9f8e7d6c-5b4a-3c2b-1a09-8f7e6d5c4b3a"
}
```

> **WARNING**
>
> **No Redirect URI**
> 
> Unlike redirect and gateway flows, decoupled flow does not return a `redirect_uri`. The customer authorises on their mobile device asynchronously.

### Step 3: Show Status to Customer

Display a waiting screen informing the customer that authorisation is pending:

```html
<div class="payment-pending">
  <div class="spinner"></div>
  <h2>Waiting for Authorization</h2>
  <p>Please check your ANZ mobile app to authorise this payment.</p>

  <!-- For banks with push notifications -->
  <p class="help-text">You should receive a push notification on your mobile device. If not, please open your banking app and check for pending authorisations.</p>

  <!-- For ANZ (no push notifications) -->
  <p class="help-text">Open your ANZ mobile app and navigate to the authorisations section to approve this payment.</p>

  <div class="payment-details">
    <p>Amount: $45.00</p>
    <p>Reference: Invoice 12345</p>
  </div>

  <button onclick="cancelPayment()">Cancel</button>
</div>
```

### Step 4: Poll for Authorization Status

Poll the consent status until it's authorised or reaches a terminal state. Poll every 5 seconds, using exponential backoff for longer operations, and stop immediately when you receive a terminal status.

Bound your polling by the bank's own window rather than a flat figure. Decoupled windows are set per bank and currently range from about four minutes to ten, so a fixed five-minute cutoff abandons consents at some banks while they're still live. Read the bank's window from `features.decoupled_flow.request_timeout` on the [metadata endpoint](https://merchants.blinkpay.co.nz/docs/shared/reference/metadata#payment-metadata-fields). If you do stop polling at a cutoff of your own, reconcile the consent afterwards rather than assuming it failed.

### Step 5: Complete Payment

Once authorised, initiate the payment. For single consents, the amount is already specified. For enduring consents, include the amount and PCR details. Handle rejected, timeout, and revoked statuses with appropriate error messages.

## Consent Authorisation Callback

To avoid polling continuously, include a `callback_url` when creating the consent. When the customer authorises, Blink fires a single unsigned HTTP `GET` to that URL with the consent ID appended as a query parameter:

```text
GET https://yourapp.example.com/webhooks/consent-status?cid=9f8e7d6c-5b4a-3c2b-1a09-8f7e6d5c4b3a
```

Treat the callback as a "wake-up" signal — it tells you something changed on this consent, but carries no body, no signature, and no status field. Always re-fetch the consent via `GET /payments/v1/enduring-consents/{cid}` (or the equivalent single-consent endpoint) to determine its actual state before acting.

The callback fires **only when the consent transitions to `Authorised`**. There is no callback for `Rejected` or `Revoked` — you must continue to poll to detect those terminal states.

Delivery is **best-effort and not guaranteed**: a callback that fails because your endpoint is unreachable, slow, or returns an error may not be delivered at all. Treat polling as the authoritative mechanism and the callback purely as an optimisation that lets you poll sooner.

> **WARNING**
>
> **The callback is unsigned — don't trust the `cid` blindly**
> 
> Anyone who learns your `callback_url` can spoof a ping. Authentication of the state change comes from the follow-up `GET` you make against Blink's API using your own credentials, not from the callback itself. Never act on `cid` alone — always re-fetch.

This callback is distinct from [Fixed Recurring Payment webhooks](https://merchants.blinkpay.co.nz/docs/debit/guides/fixed-recurring-payments#webhooks), which are signed POSTs with a JSON event payload. Don't conflate the two — the security model and contract are different.

## Customer Experience

For ASB, BNZ, and Westpac, customers receive a push notification on their mobile device, tap to open their banking app, review and authorise the payment, then return to your website.

For ANZ and Kiwibank (which don't support push notifications), customers must manually open their app and navigate to pending authorisations. Always clearly instruct ANZ and Kiwibank customers to check their app manually.

## Troubleshooting

For common issues and solutions, see the [Troubleshooting Guide](https://merchants.blinkpay.co.nz/docs/shared/help/troubleshooting).

**Quick checks:**

- No push notification? Verify bank supports it (ANZ and Kiwibank don't), check customer has notifications enabled
- Authorisation never completes? Verify login hint is correct, and check the consent hasn't passed the bank's authorisation window
- Wrong bank or account? Verify bank parameter and login hint identify the correct customer
- Multiple pending authorisations? Avoid creating duplicate consents; add unique references in PCR fields

## Best Practices

**Login Hints:** Validate mobile numbers (E.164 format) before use and store previous consent IDs for returning customers. Never use invalid identifiers or store them insecurely.

**Polling:** Use 5-second intervals and bound them by the bank's own authorisation window rather than a fixed figure. Handle network errors gracefully and stop immediately on terminal status.

**User Experience:** Show clear, bank-specific instructions—differentiate between banks with and without push notifications. Provide a cancel option and progress indicator.

## Testing

Test in sandbox with `bank: "PNZ"` and any mobile number—the mock bank immediately authorises. Before going live, test with real banks using your own mobile number to verify push notifications and manual authorisation flows.

---

Source: https://merchants.blinkpay.co.nz/docs/shared/flows/mobile-integration

# Mobile Integration

BlinkPay supports mobile applications on iOS and Android. This guide covers the recommended approaches for integrating BlinkPay into native mobile apps.

## Overview

Mobile integration requires handling:

- Deep linking between your app and banking apps
- Custom URL schemes for return navigation
- Secure browser components for authentication
- Platform-specific considerations

> **DANGER**
>
> **iFrames Not Supported**
> 
> iFrames cannot be used for BlinkPay flows. Bank Content Security Policies (CSP) block iframe embedding for security reasons. Use SFSafariViewController (iOS) or Chrome Custom Tabs (Android) instead.

## Platform Support

BlinkPay recommends the Gateway Flow for mobile applications as it handles bank selection, flow routing, and platform detection automatically.

> **TIP**
>
> **Recommended Approach**
> 
> Use Gateway Flow with custom URL schemes for mobile integration. BlinkPay automatically detects mobile devices and optimizes the flow accordingly.

## Architecture

### iOS

```text
Your App → SFSafariViewController → Gateway → Banking App → Your App
```

### Android

```text
Your App → Chrome Custom Tabs → Gateway → Banking App → Your App
```

## Reference Implementation

For complete mobile integration examples, see the official Flutter Demo:

**Repository**: [github.com/BlinkPay/BlinkPay-Flutter-Demo](https://github.com/BlinkPay/BlinkPay-Flutter-Demo)

> **WARNING**
>
> **Reference Implementation Only**
> 
> The Flutter Demo is a reference implementation, not a supported SDK package. Use it as a guide for implementing mobile integration in your application.

The reference implementation demonstrates:

- Complete consent flow
- Deep linking implementation
- Custom URL scheme handling
- iOS and Android support
- SFSafariViewController (iOS) and Chrome Custom Tabs (Android) usage
- Return URL handling
- Status polling

## Platform Requirements

### iOS

**Recommended Components:**

- `SFSafariViewController` for Gateway display (recommended)
- Custom URL scheme registered in `Info.plist`
- URL handling in AppDelegate or SceneDelegate

**Not Recommended:**

- `WKWebView` or `UIWebView` - While technically supported, SFSafariViewController provides better security and user experience
- iFrames are NOT supported (bank CSP policies)

### Android

**Recommended Components:**

- Chrome Custom Tabs for Gateway display (recommended)
- Intent filter in `AndroidManifest.xml`
- Custom URL scheme handling

**Not Recommended:**

- `WebView` - While technically supported, Chrome Custom Tabs provides better security and user experience
- iFrames are NOT supported (bank CSP policies)

## Custom URL Schemes

Custom URL schemes enable deep linking back to your app after the customer completes authorisation at their bank. Without custom schemes, users would return to a browser instead of your app.

### Setup Requirements

> **WARNING**
>
> **Bank Whitelisting Required**
> 
> Before using custom URL schemes in production, banks must whitelist your URIs. Contact [support@blinkpay.co.nz](mailto:support@blinkpay.co.nz) with your deeplink URIs to initiate this process.

1. **Register with BlinkPay** - Provide your custom URL schemes to BlinkPay support
2. **Bank whitelisting** - BlinkPay coordinates with banks to whitelist your URIs
3. **Configure your app** - Register schemes in your app configuration (Info.plist / AndroidManifest.xml)

For seamless app-to-app returns (skipping the browser), see the [App-to-App Flow](https://merchants.blinkpay.co.nz/docs/shared/flows/app-to-app) guide.

## Important Constraints

### Not Supported

**iFrames:**

- Bank CSP policies block iframe embedding
- Security requirements prevent iframe usage

### Recommended vs Supported

**WebViews:**

- iOS: `WKWebView` and `UIWebView` are technically supported but NOT recommended
- Android: `WebView` is technically supported but NOT recommended
- For best security and user experience, use secure browser components instead

### Recommended Components

| Platform | Recommended Component | Alternative |
| --- | --- | --- |
| iOS | SFSafariViewController | WKWebView (not recommended) |
| Android | Chrome Custom Tabs | WebView (not recommended) |
| Flutter | flutter_custom_tabs package | - |
| React Native | React Native WebBrowser or equivalent | - |
> **TIP**
>
> **Why Use Secure Browser Components?**
> 
> SFSafariViewController and Chrome Custom Tabs provide better security isolation, shared cookies with the system browser, and a more familiar experience for customers completing bank authentication.

## Security

### Client Credentials

Client credentials (`client_id` and `client_secret`) must never be embedded in mobile applications.

**Required Architecture:**

1. Mobile app calls your backend API
2. Backend creates consent with BlinkPay API
3. Backend returns `redirect_uri` to mobile app
4. Mobile app opens `redirect_uri` in secure browser
5. Customer completes authorisation
6. Mobile app handles callback with `consent_id`
7. Mobile app sends `consent_id` to backend for processing

```text
Mobile App → Backend API → BlinkPay API
         ↓
   Receive redirect_uri
         ↓
Open in SFSafariViewController/Chrome Custom Tabs
         ↓
Handle callback with consent_id
         ↓
   Send to backend for processing
```

### Callback Validation

Validate all callback URLs:

- Verify URL scheme matches your registered scheme
- Verify host and path match expected values
- Validate `consent_id` format (UUID)
- Never trust callback parameters without server-side verification

## Testing

### Simulator/Emulator Testing

- Test Gateway flow in simulators
- Use `localhost` or ngrok for callback URLs during development
- Banking apps are not available in simulators (cannot test deep linking to bank apps)

### Device Testing

Test on real devices before production:

- Deep linking to banking apps
- Callback handling
- Network error scenarios
- App backgrounding/foregrounding

---

Source: https://merchants.blinkpay.co.nz/docs/shared/flows/app-to-app

# App-to-App Flow

App-to-app flow enhances the mobile experience by enabling direct transitions between your mobile app and customer banking apps. This eliminates the browser step, creating a seamless journey where users return directly to your app after approving in their banking app.

> **WARNING**
>
> **Feature Request Required**
> 
> App-to-app flow requires bank whitelisting of your app's deep links. Contact [support@blinkpay.co.nz](mailto:support@blinkpay.co.nz) to request this feature. Bank approval is at each bank's discretion.

## Prerequisites

Before implementing app-to-app flow, you must have completed the standard [Mobile Integration](https://merchants.blinkpay.co.nz/docs/shared/flows/mobile-integration) setup, including custom URL scheme registration and bank whitelisting.

## Supported Banks

| Bank | App-to-App Support | Note |
| --- | --- | --- |
| ANZ | No | ANZ policy does not allow for app-to-app deep linking |
| ASB | Supported |  |
| BNZ | No | BNZ app does not support deep linking for third-party apps |
| Kiwibank | No | No app-to-app flow yet (expected second half 2026) — redirects to website instead of app on mobile devices |
| Westpac | Supported |  |
## How It Works

### Flow

1. **Customer initiates action** in your mobile app
2. Your app creates a consent request with `redirect_to_app=true`
3. Customer is redirected to their banking app (where supported)
4. **Customer approves** in their banking app
5. Banking app redirects back using your registered deep/universal link
6. Your app completes the process using the returned parameters

### Flow Type

App-to-app works exclusively with **Redirect Flow**. It does not support Decoupled Flow.

## Getting Started

To enable app-to-app flow:

1. Contact [support@blinkpay.co.nz](mailto:support@blinkpay.co.nz) to request the feature
2. Provide your deep/universal link URLs for both sandbox and production
3. BlinkPay will coordinate registration with participating banks

Bank whitelisting is a manual process requiring coordination with each bank. Approval timelines vary, but you can proceed with development using the standard flow (which involves a browser step before returning to your app) in the meantime.

> **WARNING**
>
> **Plan Your URLs Carefully**
> 
> Deep links are difficult to change once registered with banks. Ensure your URL scheme and paths are finalised before requesting whitelisting.

## Implementation

Once your app's deep links are whitelisted, add `redirect_to_app=true` to your consent creation request:

```http
POST /payments/v1/single-consents HTTP/1.1
Host: sandbox.debit.blinkpay.co.nz
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "flow": {
    "detail": {
      "type": "redirect",
      "bank": "ANZ",
      "redirect_uri": "https://yourapp.com/callback",
      "redirect_to_app": true
    }
  },
  "amount": {
    "currency": "NZD",
    "total": "50.00"
  },
  "pcr": {
    "particulars": "Order",
    "code": "12345",
    "reference": "Ref"
  }
}
```

### Step 2: Handle the Return

When the banking app redirects back to your app, capture the `code` and `state` parameters from the deep link. You have two options for completing the flow:

#### Option A: API Method (Recommended)

Keep your WebView open during bank authentication and make an API call with the returned parameters:

```http
GET /bank/1.0/return?state={state}&code={code}&redirect=false HTTP/1.1
Host: debit.blinkpay.co.nz
```

The UI updates automatically once complete.

#### Option B: WebView Redirect Method

Update your WebView URL with the returned code:

```text
https://secure.blinkpay.co.nz/gateway/pay?id={consent_id}&code={code}
```

The UI updates automatically once complete.

### Step 3: Configure App Launch Mode

Configure your app to handle deep links returning to the existing instance:

**Android:** Set `singleTask` or `singleInstance` launch mode to preserve the open WebView when the deep link returns.

**iOS:** Universal links typically return to the existing app instance by default, maintaining WebView state.

## Error Handling

### Deep Link Failures

If the device cannot open your app via deep link, users land on a fallback web page. Create a page at your universal link URL explaining that the app couldn't be found and the action wasn't completed. This provides a graceful fallback experience.

---

Source: https://merchants.blinkpay.co.nz/docs/debit/guides/single-payments

# Single Payments

BlinkPay offers two methods for single payments:

| Method | API Calls | Use Case |
| --- | --- | --- |
| **Quick Payments** | 1 (combined consent + payment) | E-commerce checkout, simple payments |
| **Single Consents** | 2 (consent, then payment) | Invoice payments, pre-authorisation |
For bank payments, both methods result in a Direct Credit payment through New Zealand's BECS network. When using the Gateway flow, [card payments](https://merchants.blinkpay.co.nz/docs/debit/guides/card-payments) are also available — card transactions are settled to you by your acquirer bank.

## Quick Payments

Creates consent and initiates payment in a single API call.

### Create Quick Payment

**Request:**

```http
POST /payments/v1/quick-payments HTTP/1.1
Host: sandbox.debit.blinkpay.co.nz
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "flow": {
    "detail": {
      "type": "gateway",
      "redirect_uri": "https://www.yourwebsite.com/payment/complete"
    }
  },
  "amount": {
    "currency": "NZD",
    "total": "50.00"
  },
  "pcr": {
    "particulars": "Online Shop",
    "code": "ORDER-123",
    "reference": "Customer"
  }
}
```

> **WARNING**
>
> **PCR Field Limits**
> 
> Each PCR field (particulars, code, reference) has a maximum length of 12 characters. Requests with longer values are rejected with a `400` validation error.

**Response:**

```json
{
  "quick_payment_id": "3a3b7f7d-f8e6-4c3e-b2a1-5f9c8d7e6a5b",
  "redirect_uri": "https://sandbox.debit.blinkpay.co.nz/gateway/pay?id=3a3b7f7d..."
}
```

Redirect the customer to `redirect_uri` to complete authorisation.

### Check Quick Payment Status

**Request:**

```http
GET /payments/v1/quick-payments/{quick_payment_id} HTTP/1.1
Host: sandbox.debit.blinkpay.co.nz
Authorization: Bearer {access_token}
```

**Response:**

```json
{
  "quick_payment_id": "3a3b7f7d-f8e6-4c3e-b2a1-5f9c8d7e6a5b",
  "consent": {
    "consent_id": "9f8e7d6c-5b4a-3c2b-1a09-8f7e6d5c4b3a",
    "status": "Authorised",
    "creation_timestamp": "2025-12-16T10:00:00+13:00",
    "status_updated_timestamp": "2025-12-16T10:05:00+13:00",
    "detail": {
      "type": "single",
      "flow": {
        "detail": {
          "type": "gateway",
          "redirect_uri": "https://www.yourwebsite.com/payment/complete"
        }
      },
      "pcr": {
        "particulars": "Online Shop",
        "code": "ORDER-123",
        "reference": "Customer"
      },
      "amount": {
        "total": "50.00",
        "currency": "NZD"
      }
    },
    "payments": [
      {
        "payment_id": "9f8e7d6c-5b4a-3c2b-1a09-8f7e6d5c4b3a",
        "type": "single",
        "status": "AcceptedSettlementInProcess",
        "creation_timestamp": "2025-12-16T10:05:00+13:00",
        "status_updated_timestamp": "2025-12-16T10:06:00+13:00",
        "detail": {
          "consent_id": "9f8e7d6c-5b4a-3c2b-1a09-8f7e6d5c4b3a"
        },
        "refunds": []
      }
    ]
  }
}
```

> **WARNING**
>
> **Determining the Outcome**
> 
> Once the consent reaches `Consumed` or `Rejected`, the outcome is in `consent.payments`. A rejected consent carries exactly one payment record with `status: Rejected`, created at rejection time with its detail (amount, PCR) populated from the consent request:
> 
> ```json
> "payments": [
>   {
>     "payment_id": "1c2d3e4f-5a6b-7c8d-9e0f-1a2b3c4d5e6f",
>     "type": "single",
>     "status": "Rejected",
>     "creation_timestamp": "2025-12-16T10:05:00+13:00",
>     "status_updated_timestamp": "2025-12-16T10:05:00+13:00",
>     "detail": {
>       "consent_id": "9f8e7d6c-5b4a-3c2b-1a09-8f7e6d5c4b3a",
>       "amount": { "total": "50.00", "currency": "NZD" },
>       "pcr": { "particulars": "Online Shop", "code": "ORDER-123", "reference": "Customer" }
>     },
>     "refunds": []
>   }
> ]
> ```
> 
> A consumed consent carries the real payment progressing through the [payment lifecycle](https://merchants.blinkpay.co.nz/docs/debit/concepts/payment-lifecycle). This is normally the only entry, but a payment the bank failed can be retried, leaving its `Rejected` record alongside the successful one — read the most recent payment (by `creation_timestamp`) rather than assuming a single element.
> 
> If the consent was never authorised (`Rejected`, or `GatewayTimeout` for a gateway consent abandoned before bank selection) or was revoked (`Revoked`), `consent.payments` remains empty — check `consent.status` for those cases.

## Single Consents

Two-step payment process with separate consent and payment creation.

### Step 1: Create Single Consent

**Request:**

```http
POST /payments/v1/single-consents HTTP/1.1
Host: sandbox.debit.blinkpay.co.nz
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "flow": {
    "detail": {
      "type": "gateway",
      "redirect_uri": "https://www.yourwebsite.com/payment/callback"
    }
  },
  "amount": {
    "currency": "NZD",
    "total": "75.00"
  },
  "pcr": {
    "particulars": "Invoice",
    "code": "INV-456",
    "reference": "Payment"
  }
}
```

**Response:**

```json
{
  "consent_id": "8f7e6d5c-4b3a-2c1b-0a09-8f7e6d5c4b3a",
  "redirect_uri": "https://sandbox.debit.blinkpay.co.nz/gateway/pay?id=8f7e6d5c..."
}
```

Redirect the customer to `redirect_uri` to complete authorisation.

### Step 2: Check Consent Status

**Request:**

```http
GET /payments/v1/single-consents/{consent_id} HTTP/1.1
Host: sandbox.debit.blinkpay.co.nz
Authorization: Bearer {access_token}
```

**Response:**

```json
{
  "consent_id": "8f7e6d5c-4b3a-2c1b-0a09-8f7e6d5c4b3a",
  "status": "Authorised",
  "creation_timestamp": "2025-12-16T10:00:00+13:00",
  "status_updated_timestamp": "2025-12-16T10:05:00+13:00",
  "detail": {
    "type": "single",
    "flow": {
      "detail": {
        "type": "gateway",
        "redirect_uri": "https://www.yourwebsite.com/payment/callback"
      }
    },
    "pcr": {
      "particulars": "Invoice",
      "code": "INV-456",
      "reference": "Payment"
    },
    "amount": {
      "total": "75.00",
      "currency": "NZD"
    }
  },
  "payments": []
}
```

### Step 3: Create Payment

**Request:**

```http
POST /payments/v1/payments HTTP/1.1
Host: sandbox.debit.blinkpay.co.nz
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "consent_id": "8f7e6d5c-4b3a-2c1b-0a09-8f7e6d5c4b3a"
}
```

**Response:**

```json
{
  "payment_id": "9f8e7d6c-5b4a-3c2b-1a09-8f7e6d5c4b3a"
}
```

### Step 4: Check Payment Status

**Request:**

```http
GET /payments/v1/payments/{payment_id} HTTP/1.1
Host: sandbox.debit.blinkpay.co.nz
Authorization: Bearer {access_token}
```

**Response:**

```json
{
  "payment_id": "9f8e7d6c-5b4a-3c2b-1a09-8f7e6d5c4b3a",
  "type": "single",
  "status": "AcceptedSettlementCompleted",
  "creation_timestamp": "2025-12-16T10:10:00+13:00",
  "status_updated_timestamp": "2025-12-16T10:15:00+13:00",
  "detail": {
    "consent_id": "8f7e6d5c-4b3a-2c1b-0a09-8f7e6d5c4b3a"
  },
  "refunds": []
}
```

## Payment Amounts

| Constraint | Value |
| --- | --- |
| Minimum | $0.01 NZD |
| Maximum | Varies by bank — see [Bank Coverage](https://merchants.blinkpay.co.nz/docs/shared/bank-coverage#payment-limits) |
| Currency | NZD only |
| Format | Exactly 2 decimal places (e.g., `100.00`, not `100`) |
> **WARNING**
>
> **Bank-Specific Limits**
> 
> Individual banks may have lower limits based on customer account settings. For large payments, inform customers they may need to increase their daily limits.

## PCR Fields (Reconciliation)

PCR (Particulars, Code, Reference) fields appear on bank statements for reconciliation.

| Field | Max Length | Purpose |
| --- | --- | --- |
| `particulars` | 12 characters | General description |
| `code` | 12 characters | Specific identifier (invoice number, order ID) |
| `reference` | 12 characters | Additional reference (customer ID) |
Avoid putting customer personal information (names, addresses, contact details) in PCR fields — they appear on bank statements. Use opaque identifiers such as a customer or order ID instead. See [Payment Reconciliation](https://merchants.blinkpay.co.nz/docs/debit/concepts/payment-lifecycle#payment-reconciliation) for full reconciliation guidance.

> **TIP**
>
> **Character Handling**
> 
> Some special characters may be stripped depending on the bank. Stick to alphanumeric characters and common punctuation for best compatibility.

## Choosing Between Quick Payments and Single Consents

Quick Payments combine consent and payment into a single API call, ideal for immediate e-commerce payments. Single Consents separate these steps, giving you control over when the payment is initiated — useful for invoice payments or pre-authorisation scenarios.

If you need to accept card payments, use either method with the Gateway flow. See the [Card Payments guide](https://merchants.blinkpay.co.nz/docs/debit/guides/card-payments) for details.

For a detailed comparison of all consent types, see [Consent Types](https://merchants.blinkpay.co.nz/docs/debit/concepts/consent-types).

---

Source: https://merchants.blinkpay.co.nz/docs/debit/guides/recurring-payments

# Recurring Payments

AutoPay uses **enduring consents** for recurring payments. Enduring consents authorise multiple payments over time within predefined limits. Once authorised, payments can be initiated on a regular schedule without requiring authorisation for each payment.

## Choosing Your Approach

BlinkPay offers two ways to handle recurring payments:

| Approach | Description | Best For |
| --- | --- | --- |
| **Variable Recurring** | You initiate each payment via API, controlling timing and amount | Usage-based billing, variable subscriptions, instalments |
| **[Fixed Recurring](https://merchants.blinkpay.co.nz/docs/debit/guides/fixed-recurring-payments)** | BlinkPay automatically executes payments on schedule (requires an authorised enduring consent) | Fixed-fee subscriptions, charity donations, loan repayments |
> **TIP**
>
> **Which should I use?**
> 
> - **Variable Recurring (this page)**: Use when payment amounts change, you need custom timing logic, or you want full control over when payments are taken.
> - **[Fixed Recurring](https://merchants.blinkpay.co.nz/docs/debit/guides/fixed-recurring-payments)**: Use when the same amount is charged on a regular schedule and you want BlinkPay to handle the automation.

This page covers **Variable Recurring Payments** where you control payment initiation. For automated fixed-amount payments, see [Fixed Recurring Payments](https://merchants.blinkpay.co.nz/docs/debit/guides/fixed-recurring-payments).

## How Enduring Consents Work

![Enduring Consent Flow](https://merchants.blinkpay.co.nz/docs/images/debit/enduring-consent-flow.png)

## Important Limitations

> **WARNING**
>
> **Consent Immutability**
> 
> Once an Enduring Payment Consent is submitted, its parameters (amount ranges, expiry date, etc.) cannot be changed. A new consent must be issued to modify any parameters.

> **WARNING**
>
> **Account Closure**
> 
> If a customer's bank account is closed, all Enduring Payment Consents linked to that account are no longer valid for use.

## Creating an Enduring Consent

**Request:**

```http
POST /payments/v1/enduring-consents HTTP/1.1
Host: sandbox.debit.blinkpay.co.nz
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "flow": {
    "detail": {
      "type": "gateway",
      "redirect_uri": "https://www.blinkpay.co.nz/sample-return"
    }
  },
  "maximum_amount_period": {
    "total": "5001.00",
    "currency": "NZD"
  },
  "maximum_amount_payment": {
    "total": "5001.00",
    "currency": "NZD"
  },
  "period": "fortnightly",
  "from_timestamp": "2025-10-15T13:21:00+12:00",
  "expiry_timestamp": "2026-10-15T13:21:00+12:00"
}
```

**Response:**

```json
{
  "consent_id": "8f7e6d5c-4b3a-2c1b-0a09-8f7e6d5c4b3a",
  "redirect_uri": "https://sandbox.debit.blinkpay.co.nz/gateway/pay?id=8f7e6d5c..."
}
```

Redirect the customer to `redirect_uri` to complete authorisation.

## Consent Parameters

### Required Fields

| Field | Type | Description |
| --- | --- | --- |
| `flow` | object | Authentication flow configuration |
| `maximum_amount_period` | object | Maximum total amount per period |
| `period` | string | Billing period type |
| `from_timestamp` | string | Period calculation start (ISO 8601) |
### Optional Fields

| Field | Type | Description |
| --- | --- | --- |
| `expiry_timestamp` | string | When consent expires (null for indefinite) |
| `maximum_amount_payment` | object | Maximum amount per single payment |
### Date Validation Rules

| Rule | Description |
| --- | --- |
| `from_timestamp` | Required. May be in the past or the future — it anchors the consent period |
| `expiry_timestamp` | Must not be in the past (or `null` for indefinite) |
| Order | `from_timestamp` must not be after `expiry_timestamp` |
### Period Types

| Period | Description |
| --- | --- |
| `daily` | Every day |
| `weekly` | Every 7 days |
| `fortnightly` | Every 14 days |
| `monthly` | Every calendar month |
| `annual` | Every year |
> **WARNING**
>
> **Period Limits Reset**
> 
> The `maximum_amount_period` limit resets at the start of each period. Periods are calculated from `from_timestamp`, not from authorisation date.

## Creating Payments

Once an enduring consent is authorised, create payments against it:

**Request:**

```http
POST /payments/v1/payments HTTP/1.1
Host: sandbox.debit.blinkpay.co.nz
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "consent_id": "8f7e6d5c-4b3a-2c1b-0a09-8f7e6d5c4b3a",
  "amount": {
    "total": "99.00",
    "currency": "NZD"
  },
  "pcr": {
    "particulars": "Subscription",
    "code": "Month 1",
    "reference": "Service"
  }
}
```

> **WARNING**
>
> **PCR Field Limits**
> 
> Each PCR field (particulars, code, reference) has a maximum length of 12 characters. Requests with longer values are rejected with a `400` validation error.

**Response:**

```json
{
  "payment_id": "9f8e7d6c-5b4a-3c2b-1a09-8f7e6d5c4b3a"
}
```

### Payment Amount Rules

| Rule | Description |
| --- | --- |
| Minimum | $0.01 NZD |
| Maximum per payment | Must not exceed `maximum_amount_payment` (if set) |
| Period total | Sum of payments in period must not exceed `maximum_amount_period` |
| Consent status | Consent must be `Authorised` |
## Checking Consent Status

**Request:**

```http
GET /payments/v1/enduring-consents/{consent_id} HTTP/1.1
Host: sandbox.debit.blinkpay.co.nz
Authorization: Bearer {access_token}
```

**Response:**

```json
{
  "consent_id": "8f7e6d5c-4b3a-2c1b-0a09-8f7e6d5c4b3a",
  "status": "Authorised",
  "creation_timestamp": "2025-10-15T10:00:00+12:00",
  "status_updated_timestamp": "2025-10-15T10:05:00+12:00",
  "detail": {
    "type": "enduring",
    "flow": {
      "detail": {
        "type": "gateway",
        "redirect_uri": "https://www.blinkpay.co.nz/sample-return"
      }
    },
    "maximum_amount_period": {
      "total": "5001.00",
      "currency": "NZD"
    },
    "maximum_amount_payment": {
      "total": "5001.00",
      "currency": "NZD"
    },
    "period": "fortnightly",
    "from_timestamp": "2025-10-15T13:21:00+12:00",
    "expiry_timestamp": "2026-10-15T13:21:00+12:00"
  },
  "payments": []
}
```

## Revoking a Consent

**Request:**

```http
DELETE /payments/v1/enduring-consents/{consent_id} HTTP/1.1
Host: sandbox.debit.blinkpay.co.nz
Authorization: Bearer {access_token}
```

**Response:** `204 No Content`

> **WARNING**
>
> **Immediate Effect**
> 
> Once revoked, the consent cannot be used for any further payments. A new consent must be created if the customer wants to resume.

## Use Cases

### Monthly Subscription

| Parameter | Value |
| --- | --- |
| `period` | `monthly` |
| `maximum_amount_period` | Fixed subscription amount |
| `maximum_amount_payment` | Same as period amount |
| `expiry_timestamp` | `null` (indefinite) |
### Instalment Plan

| Parameter | Value |
| --- | --- |
| `period` | `monthly` |
| `maximum_amount_period` | Monthly instalment amount |
| `expiry_timestamp` | Date after final instalment |
### Variable Usage Billing

| Parameter | Value |
| --- | --- |
| `period` | `monthly` |
| `maximum_amount_period` | Maximum expected monthly usage |
| `maximum_amount_payment` | Maximum single charge |
## Choosing Enduring Consents

Enduring Consents differ from Quick Payments and Single Consents in that they authorise multiple payments over time within defined limits. A single authorisation allows you to initiate payments repeatedly without customer intervention for each transaction.

For a detailed comparison of all consent types, see [Consent Types](https://merchants.blinkpay.co.nz/docs/debit/concepts/consent-types).

---

Source: https://merchants.blinkpay.co.nz/docs/debit/guides/fixed-recurring-payments

# Fixed Recurring Payments

Fixed Recurring Payments automate scheduled payments against an authorised enduring consent. Once set up, payments execute automatically on a recurring basis without further merchant or customer intervention.

> **TIP**
>
> **When to Use Fixed Recurring**
> 
> Fixed Recurring is ideal when:
> 
> - The payment amount stays the same each period (e.g., $29.99/month)
> - You want BlinkPay to handle payment execution automatically
> - You don't need custom timing logic
> 
> **Common use cases:** Fixed-fee subscriptions, charity donations, membership dues, loan repayments, gym memberships.
> 
> For variable amounts or custom timing, use [Variable Recurring Payments](https://merchants.blinkpay.co.nz/docs/debit/guides/recurring-payments) instead.

## FRP and FPE

Two concepts to keep straight:

- **Fixed Recurring Payment (FRP)** — the schedule itself. One row per recurring arrangement, tied to one authorised enduring consent. It holds the recurring rules (amount, frequency, start/end dates, next payment date, status). Long-lived: lives until cancelled, the consent is revoked, or the end date is reached. Think of it as the **direct debit mandate**.
- **Fixed Payment Execution (FPE)** — one occurrence of an FRP firing on a specific date. Many FPEs per FRP. Created by the scheduler ahead of its scheduled date, and links to the actual payment row created at the bank when it executes. Think of it as **one individual debit under that mandate**.

Each FPE has its own status, retry behaviour, and webhook events, so you get granular visibility into every individual debit. Throughout this guide, "schedule" or "FRP" refers to the recurring rule and "FPE" refers to an individual scheduled execution.

## How Fixed Recurring Payments Work

**One-Time Setup:**

1. Create an Enduring Consent and have the customer authorise it
2. Create a Fixed Recurring Payment schedule linked to that consent

**Automated Payments:**
BlinkPay automatically initiates payments at 9am NZ time on each scheduled date. Payments continue until the schedule is cancelled or the underlying consent is revoked.

## Prerequisites

Before creating a Fixed Recurring Payment schedule, you must first have an authorised enduring consent. See [Recurring Payments](https://merchants.blinkpay.co.nz/docs/debit/guides/recurring-payments) for how to create and authorise an enduring consent.

**Requirements:**

- An enduring consent in `Authorised` status
- Payment amount must not exceed the consent's `maximum_amount_payment` or `maximum_amount_period`
- `start_date` must be today or in the future (NZ timezone)
- For `daily` consents, `start_date` cannot be today if the request is submitted after 21:45 NZ — set it to tomorrow instead
- Only one active schedule allowed per consent

> **WARNING**
>
> **One Schedule Per Consent**
> 
> Each enduring consent can have only one active Fixed Recurring Payment schedule at a time. To change the schedule, cancel the existing one and create a new schedule.

## API Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/payments/v1/fixed-recurring-payments` | Create schedule |
| `GET` | `/payments/v1/fixed-recurring-payments/{fixed_recurring_payment_id}` | Get schedule |
| `DELETE` | `/payments/v1/fixed-recurring-payments/{fixed_recurring_payment_id}` | Cancel schedule |
## Creating a Schedule

**Request:**

```http
POST /payments/v1/fixed-recurring-payments HTTP/1.1
Host: sandbox.debit.blinkpay.co.nz
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "consent_id": "8f7e6d5c-4b3a-2c1b-0a09-8f7e6d5c4b3a",
  "start_date": "2026-01-14",
  "amount": {
    "total": "99.00",
    "currency": "NZD"
  },
  "pcr": {
    "particulars": "Subscription",
    "code": "Monthly",
    "reference": "Service"
  },
  "retry_strategy": "same_day"
}
```

### Request Fields

| Field | Required | Description |
| --- | --- | --- |
| `consent_id` | yes | An authorised enduring consent. |
| `amount` | yes | Per-payment amount. Must not exceed the consent's `maximum_amount_payment` or `maximum_amount_period`. |
| `pcr` | yes | Particulars, Code, and Reference shown on the customer's bank statement. Each field max 12 characters. |
| `start_date` | no | First scheduled payment date (NZ timezone). Must be today or in the future. Defaults to today if omitted. For `daily` consents, cannot be today when the request is submitted after 21:45 NZ. |
| `retry_strategy` | no | `none` (default) or `same_day` — see [Retry Strategies](#retry-strategies). |
> **WARNING**
>
> **PCR Field Limits**
> 
> Each PCR field (particulars, code, reference) has a maximum length of 12 characters. Requests with longer values are rejected with a `400` validation error — values are never truncated.

**Response:**

```json
{
  "fixed_recurring_payment_id": "9f8e7d6c-5b4a-3c2b-1a09-8f7e6d5c4b3a"
}
```

## Checking Schedule Status

**Request:**

```http
GET /payments/v1/fixed-recurring-payments/{fixed_recurring_payment_id} HTTP/1.1
Host: sandbox.debit.blinkpay.co.nz
Authorization: Bearer {access_token}
```

**Response:**

```json
{
  "fixed_recurring_payment_id": "9f8e7d6c-5b4a-3c2b-1a09-8f7e6d5c4b3a",
  "consent_id": "8f7e6d5c-4b3a-2c1b-0a09-8f7e6d5c4b3a",
  "status": "active",
  "start_date": "2025-12-17",
  "next_payment_date": "2026-01-17",
  "amount": {
    "total": "99.00",
    "currency": "NZD"
  },
  "pcr": {
    "particulars": "Subscription",
    "code": "Monthly",
    "reference": "Service"
  },
  "retry_strategy": "same_day",
  "creation_timestamp": "2025-12-17T09:00:00+13:00"
}
```

### Response Fields

| Field | Description |
| --- | --- |
| `fixed_recurring_payment_id` | Unique identifier for the schedule. |
| `consent_id` | The underlying enduring consent. |
| `status` | `active` or `cancelled`. |
| `start_date` | The first scheduled payment date. Taken from the create request; defaults to today (NZ timezone) if not supplied. |
| `next_payment_date` | Next scheduled payment date. |
| `amount` | Per-payment amount, as supplied at creation. |
| `pcr` | Particulars, Code, and Reference shown on the customer's bank statement. |
| `retry_strategy` | `none` or `same_day` — see [Retry Strategies](#retry-strategies). |
| `creation_timestamp` | When the schedule was created (ISO 8601). |
| `status_updated_timestamp` | When the status was last updated (ISO 8601). |
## Cancelling a Schedule

**Request:**

```http
DELETE /payments/v1/fixed-recurring-payments/{fixed_recurring_payment_id} HTTP/1.1
Host: sandbox.debit.blinkpay.co.nz
Authorization: Bearer {access_token}
```

**Response:** `204 No Content`

> **WARNING**
>
> **Cancellation Does Not Revoke Consent**
> 
> Cancelling a Fixed Recurring Payment schedule does NOT revoke the underlying enduring consent. The consent remains active and can be used for manual payments or a new schedule.

## Payment Schedule

### Timing

| Event | Timing |
| --- | --- |
| First payment | Initiated at the first scheduler tick at or after 09:00 NZ time on `start_date`; at some banks, if the consent's `from_timestamp` is later that day, the first payment waits until the consent is active. |
| Subsequent payments | Anchored to the FRP's `start_date`, advanced by the period count (not chained off the previous FPE). Initiated at the first tick from 09:00 NZ time on the scheduled date, except at banks with their own payment spacing rules — see Bank-specific timing below. |
| Operating window | Ticks every 15 minutes from 09:00 NZ time (`Pacific/Auckland`) with the last tick at 21:45; the retry window closes at 22:00 |
The operating window governs when payment attempts and `same_day` retries start — it does not delay webhook events, which fire whenever an FPE actually resolves, at any hour. If an FPE's scheduled date passes before the scheduler processes it (for example, a schedule created later in the day with today's `start_date`), it is **not skipped** and its `scheduledDate` is **not rewritten** — it processes at the next scheduler tick. Periods always roll forward.

> **INFO**
>
> **Daily schedules only:** a `daily` FRP is rejected at creation if its first payment could not run on `start_date` — either the request is submitted after the day's last scheduler tick (21:45 NZ), or the consent does not become active until after that tick on that date. Set `start_date` to the following day and retry. Doesn't apply to other periods.

Once an FPE has been submitted to the bank, its outcome is resolved 24/7 — the operating window only governs when first attempts and retries start, not when in-flight payments settle. An FPE submitted at 21:40 that the bank confirms at 23:00 reaches its terminal status that night and fires the corresponding webhook.

#### Bank-specific timing

ANZ measures a consent's period between payments to the second, so ANZ instalments are initiated at around the same time of day as the previous payment rather than at 09:00. Blink applies the spacing; the scheduled date is unchanged. ASB, BNZ, Kiwibank and Westpac use calendar period boundaries, so their instalments are initiated at the first tick from 09:00.

### Period Types

The payment frequency is determined by the underlying enduring consent's `period`:

| Period | Nth date calculation (`N` = number of periods elapsed) |
| --- | --- |
| `daily` | `start_date` + N days |
| `weekly` | `start_date` + N weeks |
| `fortnightly` | `start_date` + (N × 2) weeks |
| `monthly` | `start_date` + N months |
| `annual` | `start_date` + N years |
> **TIP**
>
> **Period Alignment**
> 
> The schedule is anchored to the FRP's `start_date`. For example, a monthly schedule starting on 14 January fires on 14 January, 14 February, 14 March, and so on.

> **INFO**
>
> **Month-End Behaviour**
> 
> For `monthly` schedules, each scheduled date is calculated from the FRP's `start_date` anchor, not from the previous scheduled date. When the anchor day doesn't exist in a given month (e.g. the 31st of a 30-day month), the schedule falls back to the last day of that month for that period only and resumes the original anchor day in the next month where it exists.
> 
> For example, a schedule starting on 31 January fires on 31 Jan → 28 Feb (or 29 in leap years) → 31 Mar → 30 Apr → 31 May → 30 Jun → 31 Jul. This matches the NZ Open Banking Payment Initiation period definition for monthly anchoring.

## Retry Strategies

| Strategy | Behaviour |
| --- | --- |
| `none` | No retries — the schedule advances to the next period on failure. |
| `same_day` | Retries hourly within the same calendar day, then advances to the next period. |
### Retry Strategy: `none` (Default)

On failure the FPE is marked failed, the `fixed-recurring-payment-failed` webhook fires, and the schedule advances to its next scheduled date. No retries are attempted.

### Retry Strategy: `same_day`

On failure, the FPE is retried roughly hourly through the day, up to 22:00 NZ time. If it still hasn't succeeded by then, the FPE is marked failed and the schedule advances. Retries do not carry over to the next day.

Retries are safe — they will not produce a duplicate charge, even if a previous attempt's outcome was ambiguous.

Some bank rejections cannot be cleared by retrying within the same period and are not retried — the FPE is marked failed immediately and the schedule advances to its next scheduled date. This covers cases like the consent's per-payment or per-period cap being exceeded and the consent's frequency or total-count limit being reached. If the bank's rejection shows the consent itself has been revoked or is no longer authorised, the schedule is cancelled instead — the `fixed-recurring-payment-cancelled` webhook fires rather than `failed` (see [Auto-Cancellation](#auto-cancellation)). Transient infrastructure failures (bank 5xx, network errors) still follow the hourly retry budget.

## Schedule Status

| Status | Description |
| --- | --- |
| `active` | Schedule is running and will execute payments |
| `cancelled` | Schedule has been cancelled (manually or automatically) |
## Auto-Cancellation

Schedules are automatically cancelled when the underlying consent becomes unusable. The timing depends on how the consent ended:

- **Merchant calls `DELETE /enduring-consents/{id}`** — the FRP is cancelled synchronously as part of the revoke transaction, and the `fixed-recurring-payment-cancelled` webhook fires immediately.
- **Customer revokes from their bank, or the consent reaches its `expiry_timestamp`** — the FRP is cancelled the next time Blink refreshes the consent status from the bank (typically when the schedule next attempts to execute, but possibly sooner if another flow refreshes the consent first), not at the instant the consent changes. The `fixed-recurring-payment-cancelled` webhook fires at that point.

## FPE Tracking

Each FPE is recorded as a standard payment. Query the parent enduring consent to retrieve every FPE that has run against it:

**Request:**

```http
GET /payments/v1/enduring-consents/{consent_id} HTTP/1.1
Host: sandbox.debit.blinkpay.co.nz
Authorization: Bearer {access_token}
```

The response includes a `payments` array containing every FPE made against the consent, each with its own status, timestamp, and amount.

## Webhooks

Rather than polling each FPE for an outcome, register a webhook subscription and Blink will deliver a signed event each time an FPE completes, fails, or is cancelled. Webhooks are the recommended pattern for FRP — payment timing is determined by Blink rather than the merchant, so push notification fits the workflow.

> **INFO**
>
> **Scope:** Webhooks fire for FRP events only. PayNow, quick payments, and one-off enduring payments use polling — see the [payment lifecycle](https://merchants.blinkpay.co.nz/docs/debit/concepts/payment-lifecycle#checking-payment-status) for those. Decoupled-flow consent authorisation uses a separate unsigned [callback mechanism](https://merchants.blinkpay.co.nz/docs/shared/flows/decoupled-flow#consent-authorisation-callback).

### Subscription management

Webhook subscriptions are managed via the API. Each subscription is merchant-wide and can be filtered to specific event types. You can register multiple subscriptions (for example, to route different events to different URLs).

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/payments/v1/subscriptions` | Create a subscription |
| `GET` | `/payments/v1/subscriptions` | List subscriptions |
| `DELETE` | `/payments/v1/subscriptions/{id}` | Delete a subscription |
**Create a subscription:**

**Request:**

```http
POST /payments/v1/subscriptions HTTP/1.1
Host: sandbox.debit.blinkpay.co.nz
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "callback_url": "https://yourapp.example.com/webhooks/blinkpay",
  "event_types": [
    "urn:nz:co:blinkpay:debit:events:fixed-recurring-payment-completed",
    "urn:nz:co:blinkpay:debit:events:fixed-recurring-payment-failed",
    "urn:nz:co:blinkpay:debit:events:fixed-recurring-payment-cancelled"
  ]
}
```

**Response:**

```json
{
  "subscription_id": "9f8e7d6c-5b4a-3c2b-1a09-8f7e6d5c4b3a",
  "callback_url": "https://yourapp.example.com/webhooks/blinkpay",
  "event_types": [
    "urn:nz:co:blinkpay:debit:events:fixed-recurring-payment-completed",
    "urn:nz:co:blinkpay:debit:events:fixed-recurring-payment-failed",
    "urn:nz:co:blinkpay:debit:events:fixed-recurring-payment-cancelled"
  ],
  "secret": "whsec_a1b2c3d4e5f6",
  "creation_timestamp": "2026-01-14T09:00:00+13:00"
}
```

| Field | Description |
| --- | --- |
| `subscription_id` | Unique identifier for the subscription. |
| `secret` | Signing secret (`whsec_…` prefix). **Store immediately** — returned only on create. |
| `callback_url` | HTTPS URL BlinkPay POSTs event payloads to. |
| `event_types` | The event types this subscription receives. |
| `creation_timestamp` | When the subscription was created (ISO 8601). |
Sandbox and production are separate environments with separate subscriptions and separate secrets. There is no pause or disable; to stop deliveries, delete the subscription.

### Events

All three events share a single payload schema. The event type identifies which lifecycle moment fired.

| Event type | Fires when |
| --- | --- |
| `urn:nz:co:blinkpay:debit:events:fixed-recurring-payment-completed` | An FPE has been accepted by the bank. |
| `urn:nz:co:blinkpay:debit:events:fixed-recurring-payment-failed` | An FPE has failed terminally and the schedule has advanced to the next period. |
| `urn:nz:co:blinkpay:debit:events:fixed-recurring-payment-cancelled` | The schedule has been cancelled — either via the API or because the underlying consent was revoked or expired. |
A `failed` event covers two cases that look identical to the receiver: a **bank decline** (insufficient funds, frozen account, daily-limit breach) or an **operational failure** (the bank did not respond within our execution window). Receivers that need to distinguish the two should fetch the underlying payment via `GET /payments/v1/payments/{payment_id}` and inspect the bank-response detail.

**Mental model:** `failed` means "this debit didn't go through, but the schedule is still active and will try again next period" — typically prompt the customer to update payment details, but don't terminate their subscription. `cancelled` means "the schedule itself is gone, no more debits will happen" — typically revert the customer to a non-active state and prompt re-authorisation if you want them back.

### Payload

| Field | Type | Notes |
| --- | --- | --- |
| `event_type` | string (URN) | One of the three event types above. |
| `event_id` | UUID | Stable across delivery retries — use this to dedupe. |
| `timestamp` | ISO 8601 with offset | When the event was generated. |
| `frp_id` | UUID | The schedule the event relates to. |
| `consent_id` | UUID | The underlying enduring consent. |
| `payment_id` | UUID, conditional | The specific FPE. Always present on `completed`. Present on `failed` when a payment record was created (i.e. the failure occurred after the bank submission was attempted). Omitted on `cancelled` — schedule cancellation is not tied to a specific payment. |
**Example:**

```json
{
  "consent_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "event_id": "12345678-1234-1234-1234-123456789012",
  "event_type": "urn:nz:co:blinkpay:debit:events:fixed-recurring-payment-completed",
  "frp_id": "11111111-2222-2222-2222-333333333333",
  "payment_id": "87654321-4321-4321-4321-210987654321",
  "timestamp": "2025-01-01T12:00:00+13:00"
}
```

Check for the key's presence (not its value) when reading `payment_id`. Use `frp_id` and `consent_id` as your primary correlation keys — both are present on every event.

Payloads contain identifiers only — no customer name, account number, amount, or PCR fields. To retrieve those, call `GET /payments/v1/payments/{payment_id}` or the consent endpoint with your normal API credentials.

### Delivery headers

Each delivery includes:

- `X-Signature` — Unix timestamp and HMAC-SHA256 signature, separated by a comma. See [Signature verification](#signature-verification) below.
- `X-Idempotency-Key` — UUID that is stable across delivery retries of the same event. Use this (or `event_id` from the body) to dedupe.

```text
X-Signature: t=1739545800,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd
X-Idempotency-Key: 7b9c8e2a-4d1f-4a3b-9e5c-6f8a2b4d3e1c
Content-Type: application/json
```

### Signature verification

To verify:

1. Parse `t` and `v1` from the header.
2. Build the signed string by concatenating the timestamp, a literal dot, and the **raw request body bytes** — for example `1739545800.{...body...}`. Do not re-serialise the JSON; whitespace and key order matter.
3. Compute `HMAC-SHA256(signed_string, your_signing_secret)` and hex-encode the result in lowercase. The signed string and the secret are both treated as UTF-8 bytes; use the full secret including the `whsec_` prefix as the HMAC key.
4. Compare against `v1` using a constant-time comparison.
5. Reject the request if `t` is older than 5 minutes (allowing ±60 seconds of clock skew).

**Worked example:**

| Input | Value |
| --- | --- |
| Secret | `whsec_test_secret` |
| Timestamp (`t`) | `1739545800` |
| Raw body | `{"event_id":"abc"}` |
| Signed string | `1739545800.{"event_id":"abc"}` |
| Expected `v1` | `6fc0de6006119436f09db0d062c6d181b7e10778533152586b5a03c0b93b73bc` |
If your implementation produces a different `v1` for the same inputs, re-check the body bytes (no re-serialisation), the secret encoding (UTF-8, prefix included), and the hex case (lowercase).

> **WARNING**
>
> **Use the raw body, not a re-serialised object**
> 
> Most web frameworks parse JSON before your handler runs. Re-serialising the parsed object will not reproduce the bytes that were signed. Capture the raw body bytes before parsing.

### Delivery semantics

| Aspect | Behaviour |
| --- | --- |
| Success criteria | Any `2xx` response. `3xx`, `4xx`, and `5xx` are all treated as failures. |
| Timeout | 10 seconds per attempt. |
| Retries | Up to 4 attempts (initial + 3) with short exponential backoff. 5xx and network errors retry; 4xx fails fast. |
| Ordering | Best-effort — a later event can land before an earlier one's final retry. |
| Dedupe | Use `event_id` from the body. It is stable across retries. |
| Failure visibility | After the final attempt the event is dropped. There is no dead-letter queue, replay endpoint, or failure alert. |
Respond `2xx` as soon as the event is accepted and queue it for processing — don't do slow work inside the 10-second window. The receiver must be reachable over public TLS; we don't follow `3xx` redirects, so an `http → https` rewrite at your edge will fail silently.

### Testing webhooks in sandbox

Webhook events are emitted by real FRP execution against the sandbox, so producing each event means driving the underlying behaviour. Authorise the underlying enduring consent using PNZ auto-approve (see the [Testing Guide](https://merchants.blinkpay.co.nz/docs/debit/testing) for credentials), then:

| Event | How to produce it in sandbox |
| --- | --- |
| `completed` | Create an FRP with a small amount and `start_date` of today (before 09:00 NZ), then wait. |
| `cancelled` | Call `DELETE /payments/v1/fixed-recurring-payments/{id}` — the cleanest deterministic trigger. |
| `failed` | Not currently triggerable on demand in sandbox. |
---

Source: https://merchants.blinkpay.co.nz/docs/debit/guides/gateway-integration

# Gateway Integration

This guide shows how to implement the Gateway Flow for payment integrations (PayNow and AutoPay). For a conceptual overview of how Gateway Flow works, see [Gateway Flow](https://merchants.blinkpay.co.nz/docs/shared/flows/gateway-flow).

> **TIP**
>
> **Strongly Recommended**
> 
> Gateway Flow is the fastest way to integrate BlinkPay payments. It handles bank selection, authentication flows, and compliance automatically.

## Quick Start

This guide provides payment-specific implementation examples using BlinkPay SDKs and JavaScript. You'll learn how to:

- Create payment consents with Gateway Flow
- Handle customer redirects and callbacks
- Process one-off and recurring payments
- Implement complete e-commerce and subscription flows

## Integration Steps

### Step 1: Create Consent with Gateway Flow

Specify the `gateway` flow type when creating a consent:

**For Single Payments (Quick Payment):**

Specify the `gateway` flow type with your redirect URI and flow hint.

**For Single Consents:**

Create a single consent with the `gateway` flow type and redirect the customer to the returned redirect URI.

**For Recurring Payments (Enduring Consent):**

Create an enduring consent with the `gateway` flow type, maximum amount period, and redirect the customer to the returned redirect URI.

### Step 2: Redirect Customer to Gateway

Your backend should securely pass the `redirect_uri` to your frontend, which then redirects the customer to the gateway. The Gateway will:

1. Display available banks
2. Allow customer to select their bank
3. Let customer choose authentication method (redirect or decoupled)
4. Handle the authentication flow
5. Return to your redirect_uri with the consent_id

**HTML Example:**

```html
<a href="{{ redirect_uri }}" class="btn-pay"> Continue to Payment </a>
```

### Step 3: Handle the Callback

When the customer completes authentication, they'll be redirected back to your `redirect_uri`:

```text
https://yourapp.com/payment/callback?cid={consent_id}
```

**Query Parameters:**

- `cid` - Consent ID
- `error` - (Optional) Error message if something went wrong

### Step 4: Verify and Process Payment

Always verify the consent status via API by retrieving the consent with the consent ID. The redirect URL does not indicate the final result.

## Configuration

### Redirect URI Requirements

Your redirect URI must:

- Use HTTPS in production (HTTP allowed in sandbox)
- Be registered with your BlinkPay merchant account
- Handle both success and failure scenarios
- Accept `cid` query parameter (and optional `error`)

> **WARNING**
>
> **Exact Match Required**
> 
> The redirect URI must exactly match what you registered with BlinkPay, including protocol, domain, path, and port. Trailing slashes matter!

### Timeout Handling

A Gateway consent is bound by two successive windows — the Gateway session cutoff while the customer is still choosing a bank, then that bank's own authorisation window. Both are covered in [Authorisation timeouts](https://merchants.blinkpay.co.nz/docs/debit/concepts/consent-lifecycle#authorisation-timeouts).

Either way the customer returns to your `redirect_uri`, so always verify the outcome via the API and prompt the customer to retry with a new consent if the consent didn't reach `Authorised`.

### Mobile Considerations

The Gateway works seamlessly in mobile browsers and WebViews:

- Responsive design adapts to all screen sizes
- Deep links to banking apps when available
- Handles app-to-app authentication flows
- Returns to your app after completion

> **TIP**
>
> **Mobile Apps**
> 
> For native mobile apps, see the [Mobile Integration Guide](https://merchants.blinkpay.co.nz/docs/shared/flows/mobile-integration) for custom URL schemes, platform requirements, and setup instructions.

---

Source: https://merchants.blinkpay.co.nz/docs/debit/guides/card-payments

# Card Payments

BlinkPay supports credit and debit card payments alongside account-to-account (A2A) bank transfers through a single API integration. Card payments are available through the [Gateway Flow](https://merchants.blinkpay.co.nz/docs/shared/flows/gateway-flow) for one-off payments (both Quick Payments and Single Consents).

## Overview

When card payments are enabled for your merchant account, the BlinkPay Gateway automatically presents card as a payment option alongside bank accounts. The card payment form securely tokenises card details so that card data never passes through BlinkPay or your systems.

**High-level flow:**

1. Create a one-off payment (Quick Payment or Single Consent) using the Gateway flow
2. Customer is redirected to the BlinkPay-hosted gateway and presented with payment options (bank accounts and/or card)
3. Customer selects card, completes card details in the card payment form, and authorises
4. The card transaction is processed
5. Customer is redirected back to your `redirect_uri`
6. Poll for final payment status
7. Response includes `card_network` field identifying the card type used

## Prerequisites

In addition to a standard Blink Debit merchant account with the [Gateway flow](https://merchants.blinkpay.co.nz/docs/shared/flows/gateway-flow) configured, card payments require your own acquirer — i.e. a merchant facility with your bank for card payment settlement. See [Onboarding](#onboarding) for details on getting set up.

## Checking Card Payment Capability

Use the metadata endpoint to confirm card payments are enabled for your account and to discover which card types and networks are available.

```http
GET /payments/v1/meta HTTP/1.1
Host: sandbox.debit.blinkpay.co.nz
Authorization: Bearer {access_token}
```

When card payments are enabled, the response includes a card payment entry with `card_payment.enabled: true`:

```json
{
  "banks": [
    {
      "name": "ASB",
      "features": {}
    },
    {
      "name": "Card",
      "features": {
        "card_payment": {
          "enabled": true,
          "allowed_card_payment_types": [
            "APPLEPAY",
            "CLICKTOPAY",
            "GOOGLEPAY",
            "PANENTRY"
          ],
          "allowed_card_networks": ["VISA", "MASTERCARD"]
        }
      }
    }
  ]
}
```

If `card_payment.enabled` is `true`, your account can accept card payments. The `allowed_card_payment_types` and `allowed_card_networks` arrays define which options are available to your customers.

For more details on the metadata endpoint, see [Metadata](https://merchants.blinkpay.co.nz/docs/shared/reference/metadata).

## Creating a Card Payment

Card payments use the same endpoints as A2A payments — either Quick Payments or Single Consents with the Gateway flow. No additional request fields are needed; the gateway automatically presents card as a payment option based on your merchant configuration.

### Quick Payment Example

```http
POST /payments/v1/quick-payments HTTP/1.1
Host: sandbox.debit.blinkpay.co.nz
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "flow": {
    "detail": {
      "type": "gateway",
      "redirect_uri": "https://www.yourwebsite.com/payment/callback"
    }
  },
  "amount": {
    "currency": "NZD",
    "total": "49.99"
  },
  "pcr": {
    "particulars": "Order1234",
    "code": "ONLINE",
    "reference": "INV-5678"
  }
}
```

**Response:**

```json
{
  "quick_payment_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "redirect_uri": "https://gateway.blinkpay.co.nz/redirect/a1b2c3d4-..."
}
```

Redirect the customer to the `redirect_uri`. The gateway presents all available payment methods — bank accounts and card — based on your configuration.

The two-step Single Consent flow also supports card payments. Create a single consent with `flow.detail.type: "gateway"`, redirect the customer, and create the payment after authorisation — see [Single Payments](https://merchants.blinkpay.co.nz/docs/debit/guides/single-payments) for the full two-step flow.

### Pre-selecting Card Payment (Optional)

By default, the gateway presents all available payment methods and the customer chooses. If you want to pre-select the card payment option, you can optionally include a `flow_hint`:

```json
{
  "flow": {
    "detail": {
      "type": "gateway",
      "redirect_uri": "https://www.yourwebsite.com/payment/callback",
      "flow_hint": {
        "type": "redirect",
        "bank": "Card"
      }
    }
  },
  "amount": {
    "currency": "NZD",
    "total": "49.99"
  },
  "pcr": {
    "particulars": "Order1234",
    "code": "ONLINE",
    "reference": "INV-5678"
  }
}
```

### Customer Return

After the customer completes or cancels payment, they are redirected to your `redirect_uri` with the following query parameters:

| Parameter | Description |
| --- | --- |
| `cid` | Consent ID. Use with `quick_payment_id` to poll for final status |
| `error` | Present only if the customer cancelled or an error occurred |
## Supported Card Payment Types

The following card payment types may be enabled for your merchant account. Available types are returned in the metadata response under `allowed_card_payment_types`.

| Type | Status | Description |
| --- | --- | --- |
| `PANENTRY` | Available | Traditional card entry — customer manually enters card number, expiry, and CVV in the card payment form |
| `GOOGLEPAY` | Available | Google Pay digital wallet. Tokenised payment via Chrome or Android devices |
| `CLICKTOPAY` | Available | Mastercard Click to Pay. Browser-based digital wallet with stored card credentials |
| `APPLEPAY` | Coming Soon | Apple Pay digital wallet |
## Supported Card Networks

| Network | Description |
| --- | --- |
| `VISA` | Visa credit and debit cards |
| `MASTERCARD` | Mastercard credit and debit cards |
| `AMEX` | American Express cards. Requires a separate acquiring account with Amex |
Visa and Mastercard are enabled by default. Amex can be enabled if you have an acquiring relationship with American Express.

Available networks are returned in `allowed_card_networks` in the metadata response.

## Polling for Payment Status

After the customer returns from the gateway, poll for the final payment status. The process is the same as for A2A payments — see [Single Payments](https://merchants.blinkpay.co.nz/docs/debit/guides/single-payments) for the full polling guide.

```http
GET /payments/v1/quick-payments/{quick_payment_id} HTTP/1.1
Host: sandbox.debit.blinkpay.co.nz
Authorization: Bearer {access_token}
```

**Card payment response example:**

```json
{
  "quick_payment_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "consent": {
    "status": "Consumed",
    "card_network": "VISA",
    "payments": [
      {
        "status": "AcceptedSettlementCompleted",
        "accepted_reason": "card_network_accepted",
        "amount": {
          "currency": "NZD",
          "total": "49.99"
        }
      }
    ]
  }
}
```

Poll at reasonable intervals (e.g. every 2 seconds, up to 60 seconds). Do not fulfil orders until `AcceptedSettlementCompleted` is received. If the customer declines, the consent is rejected and `consent.payments` contains a single payment record with `status: Rejected`, the same as for A2A quick payments.

## Identifying Card Payments in Responses

Two response fields distinguish card payments from bank A2A payments:

| Field | Location | Card Payment Value |
| --- | --- | --- |
| `card_network` | `consent` object | `VISA`, `MASTERCARD`, or `AMEX`. Null for bank payments |
| `accepted_reason` | `consent.payments[]` entries | `card_network_accepted` for card payments. `source_bank_payment_sent` for bank payments |
```javascript
// Example: checking payment type
if (response.consent.payments[0].accepted_reason === 'card_network_accepted') {
  const network = response.consent.card_network; // "VISA", "MASTERCARD", or "AMEX"
  console.log(`Card payment received via ${network}`);
} else {
  console.log('Bank payment received');
}
```

## Refunds

Refund a card payment with the same `POST /payments/v1/refunds` endpoint you use for bank payments. You do not choose how it is done — BlinkPay checks the payment's state with the card processor and picks:

| Request | Payment state | Operation | What the cardholder sees |
| --- | --- | --- | --- |
| `full_refund` | Not yet settled | **Void** — the capture is cancelled | No charge at all |
| `full_refund` | Settled | **Follow-on refund** — a separate credit | The original charge, then a credit |
| `partial_refund` | Either | **Follow-on refund** — a separate credit | The original charge, then a credit |
Cards settle in a daily batch. Refund the full amount before that day's batch closes and the payment is voided — the money never leaves your account, nothing ever appears on your customer's statement, and no interchange is charged. Once the batch has closed, or when you are returning only part of a payment, the money has already moved, so it comes back as a separate refund that usually reaches your customer within a few business days.

So there are only two things you ever need to tell a customer: either they will never see the charge at all, or they will see it followed by a refund a few business days later.

If BlinkPay cannot reach the card processor to check whether a payment has batched, the refund is not refused — it takes the follow-on refund path, which is valid either way. You lose the chance to void it, and nothing else.

### After a partial refund

Once a payment has been partly refunded, a `full_refund` against it is refused with `BP039`, because it would claim more than the balance left. Send the remainder as another `partial_refund` instead.

See [Error codes](https://merchants.blinkpay.co.nz/docs/debit/error-codes) for the responses a refund can return.

Refunds must be enabled for your merchant account, and card refunds are granted separately from bank refunds — contact [support@blinkpay.co.nz](mailto:support@blinkpay.co.nz) if you receive `BP047` or `BP049`.

If a card transaction is reversed or refunded by your acquirer outside BlinkPay and detected by BlinkPay, it will also appear as a refund in the BlinkPay API. This is provided on a best-effort basis.

## Onboarding

Card payments are typically configured during your initial BlinkPay onboarding. You need your own acquirer (i.e. a merchant facility with your bank) to use card payments — BlinkPay requires your acquirer merchant ID, Merchant Category Code (MCC), and acquirer bank name to complete the setup.

If card payments were not set up during your initial onboarding, contact [support@blinkpay.co.nz](mailto:support@blinkpay.co.nz) and the team will guide you through the process. Once configured, verify enablement by calling `GET /payments/v1/meta` and confirming that the card payment entry appears with `card_payment.enabled: true`.

## Error Codes and Troubleshooting

Card-specific error codes (BP020, BP256–BP261) are listed in the [Error Codes Reference](https://merchants.blinkpay.co.nz/docs/debit/error-codes). For general troubleshooting, see the [Troubleshooting Guide](https://merchants.blinkpay.co.nz/docs/shared/help/troubleshooting).

## Testing

**Sandbox Test Card Numbers:**

| Network | Card Number | Expiry | CVV |
| --- | --- | --- | --- |
| Visa | `4000 0000 0000 2503` | Any | Any |
| Mastercard | `5200 0000 0000 2151` | Any | Any |
For full card payment test scenarios, see the [Testing Guide](https://merchants.blinkpay.co.nz/docs/debit/testing).

## Next Steps

- [Gateway Flow](https://merchants.blinkpay.co.nz/docs/shared/flows/gateway-flow) — Integration details for the Gateway Flow
- [Going Live](https://merchants.blinkpay.co.nz/docs/shared/help/going-live) — Production checklist when testing is complete

---

Source: https://merchants.blinkpay.co.nz/docs/debit/testing

# Testing Guide

Testing your integration in the sandbox environment is essential before going live with BlinkPay.

## Sandbox Environment

**Sandbox URL:** `https://sandbox.debit.blinkpay.co.nz`

The sandbox environment provides:

- Full API functionality with mock bank (PNZ)
- Simulated payment flows with instant settlement
- All consent flows supported (Gateway, Redirect, Decoupled)

**Limitations:**

- Mock data only (not real customer data)
- Only PNZ mock bank available
- Some bank-specific behaviours simplified

### Getting Sandbox Credentials

1. Sign up at [Client Portal](https://merchants.blinkpay.co.nz/)
2. Receive sandbox client_id and client_secret
3. Configure your application with sandbox credentials
4. Start testing!

## Try the Gateway Experience

To see the Gateway flow in action before building your integration, visit our demo site:

**ACME Demo Site:** [https://acme-sandbox.blinkpay.co.nz](https://acme-sandbox.blinkpay.co.nz)

This demonstrates the full Gateway payment experience from a customer's perspective.

## Test Bank Credentials

### PNZ Bank (Payments NZ Mock Bank)

**For Redirect Flow (within Gateway):**

- Bank: PNZ
- Username: `user02`
- Password: `password`

**For Decoupled Flow (within Gateway):**

- Bank: PNZ
- Mobile number for auto-approve: `+64-259531933`
- Auto-approves instantly in sandbox

> **TIP**
>
> **Instant Approval**
> 
> In sandbox, the PNZ bank with mobile number `+64-259531933` will auto-approve consents instantly, making automated testing easier.

## Producing Sandbox Errors

To test your error handling, you can deliberately trigger error states:

| Error State | How to Trigger |
| --- | --- |
| `GatewayTimeout` | Create a gateway consent, follow the redirect, but don't select a bank. Wait out the 15-minute Gateway session cutoff. |
| `Rejected` | In the PNZ Test Bank interface, click "Decline" or cancel the authorisation. Leaving the authorisation incomplete until the bank's window elapses reaches the same status. |
| `Revoked` | After authorisation, call DELETE on the consent endpoint: `DELETE /payments/v1/single-consents/{consent_id}` |
## Test Scenarios

The primary integration path is the **Gateway flow**, which hosts the bank selection and handles the redirect or decoupled sub-flow automatically.

### Gateway Flow (Recommended)

**Objective:** Verify end-to-end payment using Gateway

**Steps:**

1. Create single consent with `flow.type: 'gateway'`
2. Redirect user to `consent.redirect_uri`
3. In Gateway: Select PNZ bank → Choose "Internet banking website" (redirect) or "Mobile app" (decoupled)
4. For redirect: Login as `user02` with password `password` → Approve
5. For decoupled: Use mobile number `+64-259531933` → Auto-approves instantly
6. Handle callback at your redirect_uri (check `consent_id` and `status` query params)
7. Verify consent status is `Authorised`
8. Create payment using the `consent_id`
9. Verify payment status is `AcceptedSettlementCompleted`

**Expected Results:**

- Consent status: `Authorised`
- Payment status: `AcceptedSettlementCompleted`
- Redirect back to your application

### Quick Payment

**Objective:** Test simplified single-step payment

**Steps:**

1. Create quick payment via `POST /quick-payments`
2. Redirect to Gateway and complete authorisation at PNZ bank
3. Verify consent status is `Consumed`
4. Verify payment was auto-created with status `AcceptedSettlementCompleted`

### Enduring Consent (AutoPay)

**Objective:** Test recurring payment setup

**Steps:**

1. Create enduring consent via `POST /enduring-consents` with `maximum_amount_period`, `maximum_amount_payment`, and `period`
2. Complete authorisation via Gateway
3. Create first payment with an amount within limits
4. Verify consent remains `Authorised` (not `Consumed`)
5. Create subsequent payments - consent should allow reuse within limits

### Card Payment (Gateway)

**Objective:** Verify card payment flow via Gateway

**Steps:**

1. Call `GET /payments/v1/meta` and confirm `card_payment.enabled: true`
2. Create a one-off payment (quick payment or single consent) with `flow.detail.type: "gateway"`
3. Follow the redirect to the sandbox gateway
4. Select the card payment option
5. Enter test card details from your sandbox onboarding pack
6. Handle callback at your `redirect_uri`
7. Poll for payment status — verify `AcceptedSettlementCompleted`
8. Confirm `card_network` field is present in the response (e.g. `VISA`)

**Sandbox Test Card Numbers:**

| Network | Card Number | Expiry | CVV |
| --- | --- | --- | --- |
| Visa | `4000 0000 0000 2503` | Any | Any |
| Mastercard | `5200 0000 0000 2151` | Any | Any |
**Expected Results:**

- Consent status: `Consumed`
- Payment status: `AcceptedSettlementCompleted`
- `accepted_reason`: `card_network_accepted`
- `card_network`: `VISA` or `MASTERCARD`

### Error Handling

Test these scenarios to ensure your integration handles errors gracefully:

**Timeout:** Create a consent and redirect to the Gateway. If you don't select a bank, the consent becomes `GatewayTimeout` once the 15-minute Gateway session cutoff elapses. If you select PNZ but never complete authorisation, it becomes `Rejected` once that bank's authorisation window elapses. See [Authorisation timeouts](https://merchants.blinkpay.co.nz/docs/debit/concepts/consent-lifecycle#authorisation-timeouts).

**Rejection:** During bank authorisation, click "Decline". The consent status becomes `Rejected` and you'll receive this in your redirect callback. For quick payments, the consent's `payments[]` array will contain a single payment record with status `Rejected`.

**Revocation:** After authorising a consent, call `DELETE /payments/v1/single-consents/{consent_id}`. Subsequent payment attempts will fail with a 422 error.

## Next Steps

- **[Going Live](https://merchants.blinkpay.co.nz/docs/shared/help/going-live)** - Production checklist when testing is complete

---

Source: https://merchants.blinkpay.co.nz/docs/debit/sdks/overview

# SDKs & Client Libraries

BlinkPay provides official SDKs for multiple languages and platforms. All SDKs are open source and actively maintained.

## Available SDKs

| SDK | Repository |
| --- | --- |
| **Java** | [github.com/BlinkPay/Blink-Debit-API-Client-Java](https://github.com/BlinkPay/Blink-Debit-API-Client-Java) |
| **Node.js** | [github.com/BlinkPay/Blink-Debit-API-Client-Node](https://github.com/BlinkPay/Blink-Debit-API-Client-Node) |
| **.NET** | [github.com/BlinkPay/Blink-Debit-API-Client-DotNet](https://github.com/BlinkPay/Blink-Debit-API-Client-DotNet) |
Installation instructions and package names are available in each repository.

## Reference Implementations

### Flutter Demo

> **WARNING**
>
> **Reference Implementation Only**
> 
> The Flutter Demo is a reference implementation for mobile integration, not a supported SDK package.

**Repository:** [github.com/BlinkPay/BlinkPay-Flutter-Demo](https://github.com/BlinkPay/BlinkPay-Flutter-Demo)

Demonstrates:

- Complete payment flow
- Deep linking implementation
- iOS and Android support

---

Source: https://merchants.blinkpay.co.nz/docs/shared/security

# Security & Compliance

Security is at the core of BlinkPay's design. We maintain bank-grade security standards to protect your business and your customers' financial data.

## ISO 27001:2022 Certification

BlinkPay is certified to ISO 27001:2022, the international standard for information security management systems. This certification demonstrates our commitment to:

- Systematic security management
- Regular risk assessments and audits
- Incident response and management
- Continuous improvement processes

## No Screen Scraping

Unlike some financial service providers, BlinkPay never uses screen scraping:

> **DANGER**
>
> **Screen Scraping Risks**
> 
> Screen scraping requires storing customer banking credentials and mimicking user actions. This approach:
> 
> - Exposes credentials to third parties
> - Creates security vulnerabilities
> - Breaks when banks update their interfaces
> - Violates many bank terms of service

> **TIP**
>
> **BlinkPay's Approach**
> 
> - Direct integration with official bank APIs
> - No credential storage required
> - Bank-to-bank secure communication
> - Compliant with bank security requirements

## Encrypted Data

All data is encrypted both in transit and at rest:

- **In Transit**: All communications use HTTPS/TLS encryption
- **At Rest**: Stored data is encrypted using industry-standard encryption

## Two-Way Authentication

All BlinkPay integrations use two-way authentication:

**BlinkPay ↔ Your Application:**

- OAuth 2.0 tokens for API access
- HTTPS with certificate validation

**BlinkPay ↔ Banks:**

- Mutual TLS authentication
- Certificate-based authentication

**Customer ↔ Bank:**

- Customers authenticate directly with their bank using their existing banking credentials
- BlinkPay never sees or stores banking credentials

## Consent Management

All access requires explicit customer consent:

- **Clear Purpose**: Customers see exactly what they're authorising
- **Scope Limitation**: Access limited to authorised accounts and actions
- **Revocable**: Customers can revoke consent at any time through their bank or your application

## Data Handling

BlinkPay operates as an integration layer between your application and banks:

> **TIP**
>
> **No Customer Data Storage**
> 
> BlinkPay does not hold any Customer Personally Identifiable Information for first-party use. We hold information solely on behalf of merchants and banks as part of the payment integration process.

## Testing & Security

> **WARNING**
>
> **Prior Permission Required**
> 
> Prior permission must be obtained before conducting penetration tests or load tests. This applies to any environment hosted by BlinkPay.

---

Source: https://merchants.blinkpay.co.nz/docs/shared/bank-coverage

# Bank Coverage

BlinkPay connects to all major New Zealand banks, providing comprehensive coverage for retail and personal banking accounts.

## Supported Banks

BlinkPay integrates with the following banks:

- **ANZ New Zealand**
- **ASB Bank**
- **Bank of New Zealand (BNZ)**
- **Kiwibank**
- **Westpac New Zealand**

Each bank supports different authentication flows and features. Understanding these differences helps you provide the best experience for your customers.

## Authentication Flow Support

Different banks support different authentication flows. Here's what's available:

### Redirect Flow Support

| Redirect Method | ASB | BNZ | Westpac | ANZ | Kiwibank |
| --- | --- | --- | --- | --- | --- |
| **Browser Redirect (Web)** | ✓ QR code | ✓ Direct (2FA) | ✓ Direct | ✓ QR code | ✓ Direct |
| **Mobile Deep Link** | ✓ Direct | ✗ | ✓ Direct | ✓ Direct | ✗ |
**Notes:**

- **ASB/ANZ Web:** Browser displays QR code. Customer scans with their banking app to approve.
- **BNZ:** Browser-based authentication only with 2FA required.
- **Mobile Deep Link:** Opens banking app directly on mobile devices.

### Decoupled Flow Support

| Identifier Type | ASB | BNZ | Westpac | ANZ | Kiwibank |
| --- | --- | --- | --- | --- | --- |
| **Mobile Number** | ✓ | ✓ | ✗ | ✓ | ✗ |
| **Email** | ✗ | ✓ | ✗ | ✗ | ✗ |
| **Banking Username** | ✗ | ✗ | ✓ | ✗ | ✗ |
| **Consent ID** (repeat customer) | ✓ | ✓ | ✓ | ✓ | ✓ |
### Gateway Flow

All banks support Gateway Flow, which is recommended for most integrations.

> **TIP**
>
> **Recommended: Gateway Flow**
> 
> The Gateway Flow is recommended for most integrations as it automatically selects the best available flow for each bank and handles all authentication complexity.

## Bank-Specific Features

### ANZ New Zealand

**Redirect Flow:**

- **Mobile:** Opens ANZ mobile app directly via deep link
- **Web/Desktop:** Redirects to ANZ web page displaying QR code. Customer scans with their ANZ app to approve.

**Decoupled Flow:**

- Mobile number required as login hint
- Customer authorises on their mobile device
- Push notifications not supported - customers must manually check app

**Payment Limits:**

- $5,000 per payment for PayNow (one-off payments)
- $1,000 per payment for AutoPay (recurring/enduring payments)
- These are per-payment caps, not daily aggregates. Structuring repeat payments to avoid the $5,000 cap is prohibited.

**Session Timeout:**

- Set per bank and per flow - see [Session Timeouts](#session-timeouts)

### ASB Bank

**Redirect Flow:**

- **Mobile:** Opens ASB mobile app directly via deep link
- **Web/Desktop:** Browser displays QR code. Customer scans with their ASB app to approve.
- Supports FastNet Classic and FastNet login
- Biometric authentication where enabled

**Decoupled Flow:**

- Mobile number or previous consent ID can be used as login hint
- Customer authorises on their mobile device
- Push notifications supported

**Payment Limits:**

- Up to $100,000 per customer per day
- Applies across all payments the customer makes with ASB that day, not just BlinkPay payments

**Session Timeout:**

- Set per bank and per flow - see [Session Timeouts](#session-timeouts)

**Special Features:**

- Supports both FastNet Classic and new FastNet
- Wide range of account types supported

### Bank of New Zealand (BNZ)

**Redirect Flow:**

- Opens BNZ website for authorisation (browser-based only)
- 2FA required for authorisation

**Decoupled Flow:**

- Supported identifiers: Mobile Number, Email, or Consent ID
- Customer authorises on their mobile device
- Push notifications supported

**Payment Limits:**

- Up to $50,000 per customer per day
- Applies across all payments the customer makes with BNZ that day, not just BlinkPay payments

**Session Timeout:**

- Set per bank and per flow - see [Session Timeouts](#session-timeouts)

**2FA Requirements:**

> **WARNING**
>
> **BNZ 2FA Restriction**
> 
> Devices registered with BNZ for less than 24 hours cannot make payments. This is a BNZ security requirement. Customers must wait 24 hours after registering a new device before completing payments.

### Kiwibank

**Redirect Flow:**

- Opens Kiwibank website for authorisation (browser-based only)

**Decoupled Flow:**

- Previous consent ID can be used as login hint
- Mobile Number identifier not supported - use the previous consent ID as the login hint
- Push notifications not supported - customers must manually check app

**Payment Limits:**

- Up to $50,000 per customer per day
- Applies across all payments the customer makes with Kiwibank that day, not just BlinkPay payments

**Session Timeout:**

- Set per bank and per flow - see [Session Timeouts](#session-timeouts)

### Westpac New Zealand

**Redirect Flow:**

- Opens Westpac mobile app directly on mobile devices
- Supports Westpac One authentication
- Fast app-to-app experience

**Decoupled Flow:**

- Supported identifiers: Banking Username (specifically 9-digit customer ID), Consent ID
- Customer authorises on their mobile device
- Push notifications supported

**Payment Limits:**

- Up to $30,000 per customer per day
- Applies across all payments the customer makes with Westpac that day, not just BlinkPay payments

**Session Timeout:**

- Set per bank and per flow - see [Session Timeouts](#session-timeouts)

**Special Features:**

- Westpac One unified authentication
- Supports personal and business accounts (v2.3 limitations apply)

## Login Hints by Bank

Login hints help pre-fill or identify the customer during authentication. Different banks support different hint types:

### Redirect Flow Login Hints

**All Banks:**

- No login hint required for redirect flow
- Customer identifies themselves at the bank
- Bank handles authentication entirely

### Decoupled Flow Login Hints

**ANZ:**

- `mobile_number` - Customer's mobile phone number (required)
- `consent_id` - Previous consent for this customer

**ASB:**

- `mobile_number` - Customer's mobile phone number
- `consent_id` - Previous consent for this customer

**BNZ:**

- `mobile_number` - Customer's mobile phone number
- `email` - Customer's email address
- `consent_id` - Previous consent for this customer

**Kiwibank:**

- `consent_id` - Previous consent for this customer

**Westpac:**

- `banking_username` - Customer's Westpac ID number
- `consent_id` - Previous consent for this customer

> **TIP**
>
> **Using Previous Consents**
> 
> If you've previously created a consent for a customer, you can use that consent ID as a login hint to skip bank selection and speed up future authorisations.

## Payment Limits

### Transaction Limits

Payment limits differ by bank:

| Bank | Limit |
| --- | --- |
| ASB | Up to $100,000 per customer per day |
| BNZ | Up to $50,000 per customer per day |
| Kiwibank | Up to $50,000 per customer per day |
| Westpac | Up to $30,000 per customer per day |
| ANZ | $5,000 per payment (PayNow), $1,000 per payment (AutoPay) |
Daily limits are per customer per day across **all** payments the customer makes with that bank, not just BlinkPay payments. ANZ's limits are per-payment caps rather than daily aggregates — structuring repeat payments to avoid the $5,000 cap is prohibited.

Limits are also subject to:

- Account type and customer relationship
- Bank's risk management policies

> **WARNING**
>
> **Verify Large Payments**
> 
> For payments over $10,000, it's recommended to inform customers in advance as some may need to increase their daily limits with their bank.

### Minimum Payment

The minimum payment amount across all banks is **$0.01 NZD**.

### Daily Limits

Customer daily limits vary by:

- Account type (personal vs business)
- Customer relationship with bank
- Security settings and authentication methods
- Historical transaction patterns

Customers can typically view and adjust their daily limits through their internet banking or mobile app.

## Session Timeouts

### Consent Authorisation Timeout

The time a customer has to authorise a consent is configured **per bank and per flow**, so it differs between the banks listed above and between redirect and decoupled at the same bank. Redirect windows run up to 10 minutes and decoupled windows start from about 4; gateway consents also have an earlier session cutoff, 15 minutes by default, before the customer has chosen a bank.

Because banks change these limits, read the live window for a bank from `redirect_flow.request_timeout` and `features.decoupled_flow.request_timeout` on the [metadata endpoint](https://merchants.blinkpay.co.nz/docs/shared/reference/metadata#payment-metadata-fields) instead of hard-coding one.

> **TIP**
>
> **Handle Timeouts Gracefully**
> 
> Monitor consent status and provide clear feedback to customers if their session expires. Allow them to easily restart the process.

### Payment Authorization

Once a consent is authorised, payment initiation typically has longer timeout periods:

- Payment must be initiated while consent is valid
- Single consents expire after first use
- Enduring consents remain valid until expiry date or revocation

## Account Type Support

### Supported Account Types

All banks support the following account types:

- **Savings Accounts** - Personal savings accounts
- **Checking Accounts** - Transaction/everyday accounts
- **Credit Cards** - Credit card accounts (where applicable)

### Account Identification

Accounts are identified using:

- Account number and suffix
- Bank branch code
- Account name/label

### Multiple Accounts

Customers can:

- Select from multiple accounts during authorisation
- Change accounts for subsequent payments (enduring consents)
- View all linked accounts (Blink Data)

## Mobile App Deep Linking

| Bank | App Deep Linking |
| --- | --- |
| ANZ | ✓ Supported |
| ASB | ✓ Supported |
| BNZ | ✗ Not supported |
| Kiwibank | ✗ Not supported |
| Westpac | ✓ Supported |
For complete mobile integration guidance including WebView support, custom URL schemes, and platform requirements:

[View Mobile Integration Guide →](https://merchants.blinkpay.co.nz/docs/shared/flows/mobile-integration)

## Business Account Limitations

> **WARNING**
>
> **Business Account Support**
> 
> To access a business account via open banking, it generally needs to be linked to a personal account. Current open banking standards (v2.3) are tailored for retail/personal banking, and business accounts with multi-authorisation requirements may have limitations.

### Future Support (Open Banking v3)

Version 3 of the open banking standard will address:

- Multi-authorisation requirements
- Enhanced business account support
- Corporate account types
- Improved delegation and permissions

## Bank-Specific Recommendations

### For ANZ Customers

- Encourage mobile app usage for best experience
- Inform about manual authorisation check for decoupled flow
- Payment limits are per payment ($5,000 PayNow / $1,000 AutoPay), not per day

### For ASB Customers

- Both FastNet types supported
- Excellent mobile app experience
- Push notifications working well in decoupled flow

### For BNZ Customers

- Inform customers about 24-hour new device restriction
- Browser-based authentication only (no app deep linking)
- Decoupled flow supports Mobile Number, Email, or Consent ID

### For Kiwibank Customers

- Inform about manual authorisation check for decoupled flow
- Browser-based authentication only (no app deep linking)
- Decoupled flow supports Consent ID

### For Westpac Customers

- Unified Westpac One experience
- Excellent app-to-app flow
- Banking username (9-digit customer ID) required for decoupled flow

## Troubleshooting

For common bank issues (authentication failures, payment limits, session timeouts) and their solutions:

[View Troubleshooting Guide →](https://merchants.blinkpay.co.nz/docs/shared/help/troubleshooting)

---

Source: https://merchants.blinkpay.co.nz/docs/debit/error-codes

# Error Codes Reference

This page lists common error codes returned by the Payment API. All errors include a `code` (format: `BPXXX`) and `message` field. Always check the message for specific details.

## Error Response Format

```json
{
  "timestamp": "2024-01-15T10:30:00.000+13:00",
  "path": "/payments/v1/payments",
  "status": 422,
  "error": "UNPROCESSABLE_ENTITY",
  "message": "Consent has been revoked",
  "code": "BP015",
  "bank_error_code": "Resource.Consent.InvalidStatus"
}
```

`bank_error_code` is only present when a rejection from the customer's bank caused the error. It
carries the bank's own error code verbatim, which is useful when contacting support. Branch on
`code`, never on `bank_error_code` — the bank's values differ between banks and can change without
notice.

## Common Error Codes

### Consent Errors

| Code | Description | Resolution |
| --- | --- | --- |
| BP101 | Consent does not exist | Verify the consent ID is correct |
| BP002 | Consent already consumed or rejected | Create a new consent |
| BP003 | Consent expired | Create a new consent with valid expiry |
| BP004 | Consent exceeded request timeout | Customer took too long; create new consent |
| BP005 | Consent not authorised or awaiting authorisation | Wait for customer to complete authorisation |
| BP015 | Consent has been revoked — possibly cancelled by the customer in their banking app | Create a new consent |
| BP017 | Consent not yet authorised | Customer hasn't approved yet; continue polling |
| BP021 | Gateway consent timed out (>15 min) | Create a new consent |
| BP701 | Consent was already revoked — either earlier via the API, or by the customer in their banking app | No action needed; create a new consent to take further payments |
### Request Errors

| Code | Description | Resolution |
| --- | --- | --- |
| BP035 | Referenced consent is for a different bank | Use a consent ID from the same bank |
| BP214 | Redirect URI not whitelisted | Register the URI under Settings > API |
| BP216 | Bank not configured for merchant | Contact BlinkPay to enable the bank |
| BP265 | Identifier value is not a valid consent ID | Pass a consent ID as the decoupled `identifier_value` |
### Idempotency and Concurrency Errors

An idempotency key is bound permanently to the payment it creates. These 409s tell you which of the
two situations you are in: the key is still busy with an earlier request (retry later), or it has
been spent (use a fresh key).

| Code | Description | Resolution |
| --- | --- | --- |
| BP702 | Duplicate idempotency key with different payload | Use a unique idempotency key per distinct request |
| BP703 | The named payment is still in flight | Poll the payment ID in the message until it reaches a terminal status |
| BP708 | A concurrent request holds the same key and has no payment yet | Retry once the in-flight request settles; nothing was submitted to the bank |
| BP710 | The key was already used by a payment that is now terminal | Read the status in the message: `Rejected` means you may re-submit under a fresh key, `AcceptedSettlementCompleted` means the money already moved and you must not |
| BP712 | A concurrent request on the same consent claimed the bank submission | Retrieve the consent's payments before retrying — the concurrent submission may already have settled |
| BP715 | The payment settled before the void completed, so it can no longer be voided | Retry — it will be refunded instead |
### Refund Errors

A card refund is carried out either as a void or as a follow-on refund, chosen automatically — see
the [Card Payments guide](https://merchants.blinkpay.co.nz/docs/debit/guides/card-payments) for how that choice is made.

| Code | Description | Resolution |
| --- | --- | --- |
| BP047 | Refunds are not enabled for the merchant | Contact BlinkPay support to have refunds enabled |
| BP049 | Card refunds are not enabled for the merchant | Contact BlinkPay support — card refunds are granted separately from bank refunds |
### Payment Errors

| Code | Description | Resolution |
| --- | --- | --- |
| BP020 | Card payment declined | Customer should retry with a different card or contact their card issuer |
| BP229 | Payment cap exceeded | Check metadata endpoint for limits |
### Fixed Recurring Payment Errors

See the [Fixed Recurring Payments guide](https://merchants.blinkpay.co.nz/docs/debit/guides/fixed-recurring-payments) for how `start_date` is resolved.

| Code | Description | Resolution |
| --- | --- | --- |
| BP009 | Start date is in the past | Use today or a future date (NZ timezone) |
| BP023 | Start date is before the consent's `from_timestamp` | Use a date on or after the consent's activation date |
| BP024 | Start date is after the consent's `expiry_timestamp` | Use a date inside the consent window, or create a new consent |
| BP025 | The consent has already expired | Create a new consent |
| BP030 | `daily` schedule cannot start today — submitted after the last tick (21:45 NZ) | Set `start_date` to tomorrow |
| BP038 | `daily` schedule whose consent only becomes active after 21:45 NZ on `start_date` | Set `start_date` to the following day |
| BP036 | The bank rejected the payment and it cannot be retried this consent period | Wait for the next period; the schedule continues |
| BP108 | Fixed recurring payment does not exist | Verify the schedule ID is correct |
| BP705 | Duplicate fixed recurring payment | Only one active schedule is allowed per consent |
| BP706 | Fixed recurring payment already cancelled | No action needed |
### Card Payment Errors

These errors are specific to card payment processing. For a detailed troubleshooting guide, see [Card Payments](https://merchants.blinkpay.co.nz/docs/debit/guides/card-payments).

| Code | Description | Resolution |
| --- | --- | --- |
| BP260 | No card payment types configured | Complete card payment onboarding with BlinkPay |
| BP261 | No card networks configured | Complete card payment onboarding with BlinkPay |
| BP270 | Missing Cybersource transacting merchant ID | Complete card payment onboarding with BlinkPay |
### Service Errors

| Code | Description | Resolution |
| --- | --- | --- |
| BP601 | Bank service unavailable | Retry with backoff; check for maintenance |
## Need Help?

For errors not listed here or for assistance troubleshooting:

1. Check the `message` field for specific details
2. Review the [Troubleshooting Guide](https://merchants.blinkpay.co.nz/docs/shared/help/troubleshooting)
3. Contact [support@blinkpay.co.nz](mailto:support@blinkpay.co.nz)

---

Source: https://merchants.blinkpay.co.nz/docs/shared/reference/api-policies

# API Policies

## Acceptable Use of Services

Use BlinkPay services only in accordance with their intended use, and additionally in accordance with the [BlinkPay Acceptable Use Policy](https://www.blinkpay.co.nz/aup).

## Security and Load Testing

Prior permission must be obtained before conducting penetration tests or load tests against any BlinkPay environment. Contact [support@blinkpay.co.nz](mailto:support@blinkpay.co.nz) to arrange testing windows.

## API Change Policy

To preserve backward compatibility, breaking changes such as endpoint naming updates or the removal of JSON elements will not occur until a major version (URL) change.

In general, additive changes may be made to request query parameters and JSON responses.

This policy applies only after your Go-Live Date.

### Non-Breaking Changes

These may occur at any time without advance notice:

- Addition of new endpoints
- Addition of new optional request parameters
- Addition of new fields in JSON responses
- Addition of new error codes
- Addition of new enum values
- Performance improvements
- Bug fixes

**Your Responsibility:**

- Design clients to ignore unknown response fields
- Don't rely on field order in JSON responses
- Handle new enum values gracefully

## Request Headers

### Optional Headers

The following optional headers can be included in API requests:

| Header | Description |
| --- | --- |
| `x-customer-ip` | The customer's IP address if they are currently logged in |
| `x-customer-user-agent` | The User-Agent of the application on the customer's device |
These headers help banks with fraud detection and compliance. Include them when available.

## Terms of Service

These API policies supplement BlinkPay's:

- [Terms of Service](https://merchants.blinkpay.co.nz/terms)
- [Privacy Policy](https://www.blinkpay.co.nz/privacy)
- [Acceptable Use Policy](https://www.blinkpay.co.nz/aup)

In case of conflict, the Terms of Service take precedence.

## Questions?

For questions about these policies:

- Email: [support@blinkpay.co.nz](mailto:support@blinkpay.co.nz)
- Documentation: [merchants.blinkpay.co.nz](https://merchants.blinkpay.co.nz/)

---

Source: https://merchants.blinkpay.co.nz/docs/shared/reference/metadata

# Metadata Endpoint

The metadata endpoint returns information about available banks and their capabilities. Use this to dynamically configure your integration based on bank features.

## Payment API (Blink Debit)

```http
GET /payments/v1/meta HTTP/1.1
Host: sandbox.debit.blinkpay.co.nz
Authorization: Bearer {access_token}
```

**Required scope:** `view:metadata`

### Response

```json
[
  {
    "name": "ASB",
    "payment_limit": {
      "total": "100000",
      "currency": "NZD"
    },
    "features": {
      "enduring_consent": {
        "enabled": true,
        "consent_indefinite": false
      },
      "decoupled_flow": {
        "enabled": true,
        "available_identifiers": [
          { "type": "mobile_number", "name": "Mobile Number" },
          { "type": "consent_id", "name": "Consent ID" }
        ],
        "request_timeout": "PT5M"
      }
    },
    "redirect_flow": {
      "enabled": true,
      "request_timeout": "PT10M"
    }
  }
]
```

### Payment Metadata Fields

| Field | Description |
| --- | --- |
| `payment_limit.total` | Maximum single payment amount |
| `features.decoupled_flow.enabled` | Whether decoupled flow is supported |
| `features.decoupled_flow.available_identifiers` | Supported identifier types |
| `features.decoupled_flow.request_timeout` | Timeout for decoupled consent (ISO 8601) |
| `features.enduring_consent.enabled` | Whether recurring payments are supported |
| `features.enduring_consent.consent_indefinite` | Whether indefinite consents are allowed |
| `features.enduring_consent.maximum_consent` | Maximum consent duration (ISO 8601) |
| `features.card_payment.enabled` | Whether card payments are supported |
| `features.card_payment.allowed_card_payment_types` | Supported card payment types (e.g. `PANENTRY`, `GOOGLEPAY`) |
| `features.card_payment.allowed_card_networks` | Supported card networks (e.g. `VISA`, `MASTERCARD`) |
| `redirect_flow.enabled` | Whether redirect flow is supported |
| `redirect_flow.request_timeout` | Timeout for redirect consent (ISO 8601) |
### Card Payment Metadata

When [card payments](https://merchants.blinkpay.co.nz/docs/debit/guides/card-payments) are enabled, a card payment entry appears in the metadata response alongside the bank entries:

```json
{
  "name": "Card",
  "features": {
    "card_payment": {
      "enabled": true,
      "allowed_card_payment_types": [
        "APPLEPAY",
        "CLICKTOPAY",
        "GOOGLEPAY",
        "PANENTRY"
      ],
      "allowed_card_networks": [
        "VISA",
        "MASTERCARD"
      ]
    }
  }
}
```

If the card payment entry is not present, card payment onboarding has not been completed. See the [Card Payments guide](https://merchants.blinkpay.co.nz/docs/debit/guides/card-payments) for onboarding steps.

## Data API (Blink Data)

```http
GET /v1/meta HTTP/1.1
Host: sandbox.data.blinkpay.co.nz
Authorization: Bearer {access_token}
```

**Required scope:** `read:meta`

### Response

```json
[
  {
    "bank_id": "59a68dd9-6070-11f0-bb8d-0ad2a4bc413d",
    "name": "ASB",
    "features": {
      "accounts": true,
      "balances": true,
      "transactions": true,
      "statements": true,
      "party": true
    }
  }
]
```

### Data Metadata Fields

| Field | Description |
| --- | --- |
| `bank_id` | Unique identifier for the bank |
| `name` | Bank display name |
| `features.accounts` | Whether account data is supported |
| `features.balances` | Whether balance data is supported |
| `features.transactions` | Whether transaction data is supported |
| `features.statements` | Whether statement data is supported |
| `features.party` | Whether party (account holder) data is supported |
## Caching

Metadata changes infrequently. Cache the response for up to **24 hours** to reduce API calls.

## Use Cases

- **Bank selection UI:** Show only banks supporting your required flow type
- **Payment limits:** Check payment amount against bank limits before submission
- **Feature detection:** Adjust UX based on available features
- **Card payment availability:** Check if card payments are enabled and which card types/networks are available
- **Timeout configuration:** Set appropriate polling timeouts based on bank values
- **Permission availability:** Check which data types each bank supports

---

Source: https://merchants.blinkpay.co.nz/docs/shared/reference/glossary

# Glossary

Key terms used in BlinkPay documentation and open banking.

### API (Application Programming Interface)

A technical integration bridge between the services provided by Banks, BlinkPay and Merchants. An API defines the kinds of calls or requests that can be made, how to make them, the data formats that should be used, the conventions to follow, etc.

### Authentication

The verification that a user is valid.

### Authorisation

The rights and permissions that an authenticated user is allowed to access, based on an access policy.

### Acquirer Bank

The bank that processes and settles card transactions on behalf of the merchant (e.g. BNZ, ASB). Required for [card payment](https://merchants.blinkpay.co.nz/docs/debit/guides/card-payments) onboarding.

### Acquirer Merchant ID

15-character alphanumeric identifier assigned by your acquirer bank to uniquely identify your business for card payment settlement. Required for [card payment](https://merchants.blinkpay.co.nz/docs/debit/guides/card-payments) onboarding.

### Bank

A financial institution that is authorised to perform monetary transactions and provide financial and other services to its Customers.

### Card Not Present (CNP)

A card transaction type where the physical card is not presented at point of sale — applicable to all online/e-commerce card payments.

### Customer

A person, organisation or entity that purchases goods and/or services from a Merchant and holds an account with a Bank.

### Decoupled Flow (Pay by Mobile)

A workflow to gather consent from an Online Banking Customer typically using a mobile device. The customer can authorise on a different device or at a different time from the merchant interaction.

### Direct Credit

An electronic transfer of funds through the "Bulk Electronic Clearing System" (BECS) administered by Payments NZ. The payment is initiated by or on behalf of the payer, which sends funds directly into the bank account of the payee.

### Enduring Payment Consent

A consent type that allows a Merchant to debit funds from an Online Banking Customer on an ongoing basis, subject to agreed parameters such as maximum amounts and periods.

### Fixed Payment Execution (FPE)

A single occurrence of a [Fixed Recurring Payment (FRP)](#fixed-recurring-payment-frp) schedule firing on a specific date — analogous to one individual debit on the 1st of the month under a direct debit mandate. Many FPEs exist per FRP. Each FPE is tracked independently with its own status, retries, and webhook events, and links to the actual payment row created at the bank.

### Fixed Recurring Payment (FRP)

The schedule that automatically initiates fixed-amount payments against an authorised enduring consent at a regular cadence — analogous to a direct debit mandate. The FRP holds the recurring rules (amount, frequency, start/end dates, status); each scheduled execution against it is a [Fixed Payment Execution (FPE)](#fixed-payment-execution-fpe).

### Gateway Flow

A consent flow that takes the Customer through a BlinkPay gateway to complete their consent and payment. It simplifies integration by handling bank selection, flow type selection, and — when enabled — [card payments](https://merchants.blinkpay.co.nz/docs/debit/guides/card-payments). The Gateway is the only flow that supports card payments.

### Go-Live Date

The date which the Merchant integration can go into production and be used by Merchant Customers as a payment channel.

### JSON (JavaScript Object Notation)

A lightweight data-interchange format commonly used for communication between web systems.

### Merchant

An organisation, person or entity that provides goods and/or services to Customers and receives payments in respect of those goods and/or services.

### Merchant Category Code (MCC)

4-digit code assigned by the acquirer bank that classifies a merchant's business type. Used by card networks for transaction routing and reporting. Required for [card payment](https://merchants.blinkpay.co.nz/docs/debit/guides/card-payments) onboarding.

### OAuth 2

The industry-standard protocol for Authorisation. BlinkPay uses OAuth 2.0 with the client_credentials grant type.

### One-off Payment

A payment made only once by a Customer to a Merchant. Uses a Single Consent or Quick Payment.

### Online Banking

The desktop and mobile internet banking experiences provided by Banks to Customers.

### Open Banking

The framework of APIs administered by Payments NZ and implemented by New Zealand Banks which enable access to underlying Bank functionality, e.g., data and payments.

### PAN (Primary Account Number)

The 16-digit number on a credit or debit card. In [card payments](https://merchants.blinkpay.co.nz/docs/debit/guides/card-payments), PAN entry refers to the customer manually entering their card number, expiry, and CVV.

### Personally Identifiable Information (PII)

Data that could be used to identify an individual person (e.g., name, address) and as otherwise defined by personal information in the Privacy Act 2020.

### Recurring Payment

A series of payments made by a Customer to a Merchant at a regular schedule. Uses an Enduring Payment Consent.

### Redirect Flow (Pay by Bank)

A workflow to gather consent from an Online Banking Customer typically using a web browser. The customer is redirected from the Merchant to the Bank for authentication, then redirected back upon completion.

### REST (Representational State Transfer)

An architectural style of HTTP web services, exposing uniform operations.

### UTF-8

A common standard for encoding of characters, supporting many character types.

### Variable Recurring Payment

A series of variable-amount Recurring Payments where the payment amount may differ each period within the limits of the Enduring Consent.

---

Source: https://merchants.blinkpay.co.nz/docs/shared/reference/postman

# Postman Collection

Test and explore BlinkPay APIs using our Postman collections.

## Workspaces

| API | Postman Workspace |
| --- | --- |
| **Payment API (Blink Debit)** | [blinkpay-merchant-workspace](https://www.postman.com/blinkpay/blinkpay-merchant-workspace/overview) |
| **Data API (Blink Data)** | [blinkpay-organisation-workspace](https://www.postman.com/blinkpay/blinkpay-organisation-workspace/overview) |
## Getting Started

### 1. Download Collection and Environment

Visit the appropriate workspace above and download both the collection and sample environment files to your local Postman.

### 2. Configure Environment Variables

Get your credentials from the [Client Portal](https://merchants.blinkpay.co.nz/) and update the environment variables:

| Variable | Value |
| --- | --- |
| `base_url` | See environment URLs below |
| `client_id` | Your OAuth client ID |
| `client_secret` | Your OAuth client secret |
**Environment URLs:**

| API | Sandbox | Production |
| --- | --- | --- |
| Payment API | `https://sandbox.debit.blinkpay.co.nz` | `https://debit.blinkpay.co.nz` |
| Data API | `https://sandbox.data.blinkpay.co.nz` | `https://data.blinkpay.co.nz` |
### 3. Generate Access Token

1. Run the **Authentication > Generate access token** request
2. The `access_token` variable is automatically set
3. Token is valid for 1 hour

## Sandbox Testing

Use the mock bank "PNZ" for testing:

| Flow | Credentials |
| --- | --- |
| **Redirect** | Username: `user01` or `user02` |
| **Decoupled** | Phone: `+64-259531933` (auto-approves) |
---

Source: https://merchants.blinkpay.co.nz/docs/shared/help/troubleshooting

# Troubleshooting

This guide covers common issues you may encounter when integrating BlinkPay, along with solutions and debugging strategies.

## Common Errors

### HTTP Error Codes

| Error Code | Meaning | Common Causes | Actions |
| --- | --- | --- | --- |
| 400 | Bad Request | Invalid request format, missing required fields, invalid date formats, redirect URI not whitelisted | Check request format, verify all required fields, ensure dates are ISO 8601 with timezone |
| 401 | Unauthorised | Invalid or expired access token | Refresh OAuth token automatically and retry request |
| 403 | Forbidden | Feature not enabled, wrong subscription tier, IP restrictions | Verify feature access with support, check subscription level |
| 404 | Not Found | Invalid consent ID, payment ID, or resource ID | Verify IDs are correct, check consent/payment hasn't expired |
| 409 | Conflict | Duplicate request, resource conflict | Check for duplicate submissions, verify resource state |
| 415 | Unsupported Media Type | Invalid payload format or missing Content-Type header | Ensure payload is valid JSON and Content-Type is application/json |
| 422 | Unprocessable Entity | Consent expired/revoked, invalid consent state, amount exceeds limits | Create new consent, verify consent status, check enduring consent limits |
| 5xx | Server Error | BlinkPay or bank system issue | Retry the request, contact support if persistent |
## Authentication Issues

### 401 Unauthorised

**Symptom:** All API requests return 401

**Causes:**

- Access token expired (lifetime: 1 hour)
- Invalid client credentials
- Environment mismatch (sandbox credentials in production)

**Solutions:**

1. Implement automatic token refresh - cache token with expiry, refresh 5 minutes before expiration
2. On 401 response: request new token and retry the original request
3. Verify credentials match your environment (sandbox vs production)

### 403 Forbidden

**Symptom:** Specific endpoints return 403

**Causes:**

- Feature not enabled for your account
- Wrong subscription tier
- IP whitelist restrictions
- Scope permissions issue

**Solutions:**

1. Contact support to verify feature access
2. Check your subscription includes required features
3. Verify IP address is whitelisted (if applicable)
4. Ensure OAuth scopes include required permissions

## Consent Issues

### Consent Stuck in AwaitingAuthorisation

**Symptom:** Consent doesn't progress after redirect

**Causes:**

1. Customer didn't complete authorisation
2. Customer closed browser/app
3. Bank system issue
4. Network timeout

**Solutions:**

1. Implement polling with timeout (poll every 3-5 seconds, max 15 minutes)
2. Check for terminal states: a consent waiting at the bank ends as either `Authorised` or `Rejected`
3. Display appropriate UI to customer while waiting

**Prevention:**

- Clearly explain the process to customers
- Minimise steps before redirect
- Provide clear instructions
- Consider decoupled flow for known customers

### Consent Times Out Before Authorisation

**Symptom:** The consent reaches a terminal status before the customer authorises it — `Rejected` if they'd already reached their bank, or `GatewayTimeout` if they never chose one

**Cause:** Authorisation windows are set per bank and per flow, and gateway consents have an earlier session cutoff before bank selection. Read the applicable window from `redirect_flow.request_timeout` and `features.decoupled_flow.request_timeout` on the [metadata endpoint](https://merchants.blinkpay.co.nz/docs/shared/reference/metadata#payment-metadata-fields) rather than hard-coding a figure.

**Handling:**

- Display user-friendly message: "Your payment session expired. Please try again."
- Offer retry option that creates a new consent
- Log the timeout for monitoring

**Prevention:**

- Streamline checkout flow
- Explain process upfront
- Set customer expectations
- Consider decoupled flow for complex cases

### Consent Rejected

**Symptom:** Consent status becomes 'Rejected'

**Common Causes:**

- Customer clicked "Cancel" or "Decline"
- Customer failed authentication multiple times
- Account doesn't support requested operation
- Insufficient funds (for payment consents)
- Bank fraud detection triggered

**Handling:**

- Display clear error message with the rejection reason
- Suggest: check account balance, use different account, contact bank
- Offer retry option or alternative payment method

**Important:** Never automatically retry rejected consents. Customer needs to resolve the underlying issue first.

For quick payments, a rejected consent also appears as a payment record with status `Rejected` in the consent's `payments[]` array.

## Payment Issues

### Payment Stuck in Pending

**Symptom:** Payment doesn't move to AcceptedSettlementInProcess

**Expected Timeline:** Most payments transition within 30 seconds

**If > 5 minutes:**

1. Log the issue with payment ID and age
2. Contact BlinkPay support with request ID
3. Monitor for status change

### Payment Rejected

**Symptom:** Payment status becomes 'Rejected'

**Common Causes:**

| Reason | Description | Action |
| --- | --- | --- |
| Insufficient Funds | Account balance too low | Ask customer to add funds or use different account |
| Account Closed | Account no longer active | Use different account |
| Invalid Account | Account number incorrect | Verify account details |
| Payment Blocked | Bank fraud detection or customer block | Contact bank, verify legitimacy |
| Exceeds Limits | Daily/transaction limit exceeded | Split payment or wait for limit reset |
| Technical Error | Bank system issue | Retry or contact support |
**Handling:**

- Log rejection reason for analysis
- Display user-friendly message with the reason
- Suggest appropriate actions based on rejection type
- Offer retry or alternative payment method

## Integration Issues

### Redirect URI Not Working

**Symptom:** Customer not redirected back after authorisation

**Checklist:**

- [ ]  URI matches a registered whitelist entry (exact or wildcard)
- [ ]  HTTPS in production (HTTP ok in sandbox)
- [ ]  No trailing slash differences
- [ ]  Port number matches exactly (if specified)
- [ ]  Query parameters handled correctly
- [ ]  Special characters properly encoded

**Common Mistakes:**

- Protocol mismatch: `http://` vs `https://`
- Trailing slash: `/callback` vs `/callback/`
- Subdomain differences: `yourapp.com` vs `www.yourapp.com` — consider using a wildcard entry like `https://*.yourapp.com/callback`
- Port number mismatch
- Using a wildcard entry but expecting the bare domain to match — `https://*.example.com` does **not** match `https://example.com`

**Debugging:**

- Log callback requests to see the full URL received
- Check for missing `consent_id` query parameter
- Verify the callback URL in browser network tools

### CORS Errors

**Symptom:** Browser console shows CORS errors

**Root Cause:** BlinkPay API calls must be made from your **backend server**, not browser JavaScript

**Solution:**

1. Frontend calls your backend API
2. Backend calls BlinkPay API
3. Backend returns result to frontend

Never expose your client credentials or make BlinkPay API calls directly from browser code.

### Mobile Deep Linking Issues

**Symptom:** Banking app doesn't open or return navigation fails

**Solutions:**

| Platform | Wrong Approach | Correct Approach |
| --- | --- | --- |
| **iOS** | WKWebView | SFSafariViewController |
| **Android** | WebView | Chrome Custom Tabs |
**Debugging:**

- Add logging to your deep link handler
- Verify URL scheme, host, and query parameters
- Test on actual devices (not simulators)

See [Mobile Integration Guide](https://merchants.blinkpay.co.nz/docs/shared/flows/mobile-integration) for complete details.

## Validation Errors (400)

### Common Validation Issues

**Invalid date format:**

- Wrong: `"from_timestamp": "2025-01-01"`
- Correct: `"from_timestamp": "2025-01-01T00:00:00+13:00"` (ISO 8601 with timezone)

**PCR fields too long:**

- Each PCR field (particulars, code, reference) must be 12 characters or less
- Example: `"particulars": "INV12345"`, `"code": "SALE"`, `"reference": "CUST001"`

**Invalid bank:**

- Supported banks: ANZ, ASB, BNZ, Kiwibank, Westpac, PNZ (sandbox)
- Use exact bank identifiers as documented

**Redirect URI not whitelisted:**

- Error: "Redirect URI not whitelisted"
- Solution: Register the URI in the client portal under Settings > API, for the environment you're calling (sandbox, production). You can add an exact URI or a wildcard subdomain entry (e.g., `https://*.example.com/callback`) to match multiple subdomains. This requires the Developer or Administrator role — otherwise email [support@blinkpay.co.nz](mailto:support@blinkpay.co.nz) with the URI(s) you need registered.

## Retry Logic

### When to Retry

| Error Type | Retry? | Notes |
| --- | --- | --- |
| **5xx Server Error** | ✅ Yes | Retry with exponential backoff |
| **429 Rate Limited** | ✅ Yes | Wait then retry |
| **4xx Client Error** | ❌ No | Fix the request - these indicate request problems |
### Retry Strategy

For 5xx errors, use exponential backoff:

- **Max retries:** 2
- **Initial delay:** 0.5 seconds
- **Multiplier:** 2x (delays: 0.5s, 1s)

Always use idempotency keys when retrying POST requests to prevent duplicates.

## Idempotency Keys

Idempotency keys prevent duplicate operations when retrying requests.

| Scenario | Result |
| --- | --- |
| Same key + same payload, within 24 hours | Original response returned (safe to retry) |
| Same key + different payload | 409 Conflict error (BP702) |
| Same key, earlier request still in flight | 409 Conflict error (BP708), or BP703 naming the in-flight payment — poll it |
| Same key, earlier payment terminal, replay window expired | 409 Conflict error (BP710) naming that payment and its status; use a fresh key |
**Best practices:**

- Use a unique UUID per distinct request
- Keys are cached for 24 hours, but the binding to the payment they created is permanent
- Always include when retrying payment creation requests

## Bank Maintenance

Banks may have scheduled maintenance windows, typically overnight (NZ time).

### How Maintenance Affects Payments

| Flow Type | Behaviour During Maintenance |
| --- | --- |
| **Gateway** | Affected bank is hidden from bank selection |
| **In-progress payments** | `AcceptedSettlementInProcess` payments complete after maintenance ends |
### Handling Maintenance

- **Don't** automatically retry payments that are `AcceptedSettlementInProcess`
- **Don't** automatically credit/fulfil orders until payment reaches `AcceptedSettlementCompleted`
- **Do** allow additional time for overnight payments to settle before treating as failed

## Debugging Techniques

### Request Headers for Debugging

Include these headers with your API requests to enable better tracing and debugging:

| Header | Purpose | Example |
| --- | --- | --- |
| `request-id` | Unique identifier for each request. Generate a UUID. Include when contacting support. | `request-id: 550e8400-e29b-41d4-a716-446655440000` |
| `x-correlation-id` | Track multiple related requests in a session. Useful for debugging multi-step flows. | `x-correlation-id: session-abc-123` |
| `idempotency-key` | Prevent duplicate payments. Use the same key if retrying a failed payment request. | `idempotency-key: payment-order-12345` |
| `x-customer-ip` | Customer's IP address. Helps with fraud detection and debugging. | `x-customer-ip: 203.0.113.42` |
> **TIP**
>
> **Request ID for Support**
> 
> When contacting BlinkPay support, include the `request-id` from your API calls. This allows BlinkPay to quickly locate your request in their logs.

### Logging Best Practices

For debugging and audit purposes:

- Log all API request/response pairs (sanitize sensitive data)
- Record the `request-id` returned in response headers
- Track request duration for performance monitoring
- Never log full access tokens or client secrets

## Getting Support

If issues persist after troubleshooting, contact [support@blinkpay.co.nz](mailto:support@blinkpay.co.nz) with your environment, consent/payment IDs, and steps to reproduce.

[View full support resources →](https://merchants.blinkpay.co.nz/docs/shared/help/support)

## Service Status

Check system status: [www.blinkpay.co.nz/service-status](https://www.blinkpay.co.nz/service-status)

It is recommended that merchants sign up for updates from this page to be notified of any incidents that occur.

---

Source: https://merchants.blinkpay.co.nz/docs/shared/help/going-live

# Going Live

This guide covers the process of taking your BlinkPay integration from sandbox to production.

## Production Readiness Checklist

### Integration

- [ ]  Consent creation and authorisation working
- [ ]  Payment initiation and status polling working
- [ ]  All authentication flows tested (Gateway/Redirect/Decoupled)
- [ ]  Return URL handling correct
- [ ]  Error handling implemented (401 token refresh, 5xx retry with backoff, timeouts)
- [ ]  Tested with mock bank (PNZ) in sandbox

### Card Payments (if applicable)

- [ ]  Card payment onboarding completed (acquirer merchant ID, MCC, acquirer bank provided to BlinkPay)
- [ ]  Card payment feature confirmed enabled via metadata endpoint
- [ ]  Card payment flow tested in sandbox with test card numbers

### Security

- [ ]  API credentials stored securely (environment variables or secret manager)
- [ ]  No credentials in source control
- [ ]  All API calls use HTTPS
- [ ]  Bearer tokens implemented correctly
- [ ]  No tokens exposed in client-side code

### User Experience

- [ ]  Clear payment instructions displayed
- [ ]  Loading states implemented
- [ ]  User-friendly error messages
- [ ]  Success confirmation displayed
- [ ]  Mobile responsive design

### Consent Management (Data API)

- [ ]  Customers can view active consents
- [ ]  Customers can revoke consents through same channel used for creation
- [ ]  Consent expiry handling implemented
- [ ]  Expired/revoked consent detection in place

### Monitoring

- [ ]  Signed up for service status updates: [blinkpay.co.nz/service-status](https://www.blinkpay.co.nz/service-status)
- [ ]  Request IDs logged for troubleshooting
- [ ]  Error rates monitored

### Compliance (Direct Flows Only)

If using Redirect/Decoupled flows directly (not Gateway):

- [ ]  Payments NZ Customer Experience Guidelines compliance verified
- [ ]  `x-customer-ip` and `x-customer-user-agent` headers implemented
- [ ]  Privacy policy updated to cover account data access

## Requesting Production Access

### Step 1: Log Into Portal

Visit [merchants.blinkpay.co.nz](https://merchants.blinkpay.co.nz/) and log in.

### Step 2: Click "Upgrade to Production"

1. Navigate to account settings
2. Click **Upgrade to Production**
3. This initiates the certification process

### Step 3: Complete Certification

BlinkPay will review your integration (1-2 business days):

- Integration patterns follow best practices
- Error handling is comprehensive
- Security requirements met
- User experience is acceptable

### Step 4: Receive Production Credentials

Once approved:

1. Production Client ID and Secret issued
2. Access to production environment enabled
3. Base URLs:
  - Debit: `https://debit.blinkpay.co.nz`
  - Data: `https://data.blinkpay.co.nz`

## Production Configuration

Configure your application to use production endpoints and credentials:

- Base URL for Debit APIs: `https://debit.blinkpay.co.nz`
- Base URL for Data APIs: `https://data.blinkpay.co.nz`
- Store Client ID and Client Secret in environment variables

> **WARNING**
>
> **Use Environment Variables**
> 
> Never hard-code production credentials. Always use environment variables or a secure secret management system.

## Key Metrics to Monitor

Track these metrics to understand your integration performance:

- Payment success rate
- API error rate
- Consent authorisation rate
- Average time to completion

---

Source: https://merchants.blinkpay.co.nz/docs/shared/help/demos

# Demo Applications

Explore BlinkPay's capabilities through our live demo applications and reference implementations.

## Live Payment Demos

### ACME Payments Demo (Sandbox)

**Live Demo**: [acme-sandbox.blinkpay.co.nz](https://acme-sandbox.blinkpay.co.nz)

A full-featured e-commerce checkout demo showcasing:

- **Gateway Flow** - Complete payment experience
- **Multiple Payment Amounts** - Test various transaction sizes
- **Real-time Status Updates** - See consent and payment state changes
- **Error Handling** - Examples of timeout, rejection scenarios

**How to Use:**

1. Select a product and amount
2. Click "Pay with BlinkPay"
3. Choose bank "PNZ" (sandbox bank)
4. Login with username `user02`, password `password`
5. Approve payment
6. Return to see payment confirmation

> **TIP**
>
> **Sandbox Testing**
> 
> This demo uses the BlinkPay sandbox environment. No real money is transferred, and you can test freely without consequences.

---

## Account Information Demo

### ACME Loans Demo

**Live Demo**: [acme-loans-dev.blinkpay.co.nz](https://acme-loans-dev.blinkpay.co.nz)

Demonstrates Blink Data (account information access):

- **Account Aggregation** - Connect multiple bank accounts
- **Balance Display** - View current and available balances
- **Transaction History** - Access historical transactions
- **Account Details** - See account metadata

**How to Use:**

1. Click "Connect Your Bank"
2. Select bank "PNZ"
3. Login with username `user02`, password `password`
4. Approve data access
5. View aggregated account information

---

## Mobile Demo Application

### Flutter Demo App

Reference implementation for mobile integration (iOS and Android).

**Repository**: [github.com/BlinkPay/BlinkPay-Flutter-Demo](https://github.com/BlinkPay/BlinkPay-Flutter-Demo)

---

## Testing Credentials

All demos use the sandbox environment with these test credentials:

### Mock Bank (PNZ)

**Bank Name:** PNZ
**Username:** `user02`**Password:** `password`

**Test Scenarios:**

| Scenario | Steps |
| --- | --- |
| Successful Payment | Select PNZ → Login with user02 → Approve |
| Timeout | Start authorisation → Don't complete → Wait out the bank's window (up to 10 minutes) |
| Customer Cancellation | Start authorisation → Click cancel or close window |
---

Source: https://merchants.blinkpay.co.nz/docs/shared/help/support

# Support & Help

Need assistance with your BlinkPay integration? We're here to help!

## Contact Support

### Email Support

**Primary Contact:** [support@blinkpay.co.nz](mailto:support@blinkpay.co.nz)

**Response Times:**

- **Urgent Issues** (Production impacting): 24/7 support via email and live chat
- **Standard Issues**: 2 business days for assignment

**When Contacting Support:**
Please include:

- Your client ID or company name
- Environment (sandbox or production)
- Description of the issue
- Steps to reproduce (if applicable)
- Error messages or codes
- Request/response examples (sanitise sensitive data)
- Approximate time of occurrence

> **TIP**
>
> **Faster Resolutions**
> 
> The more details you provide, the faster we can help resolve your issue!

---

### General Inquiries

**Website:** [www.blinkpay.co.nz/support](https://www.blinkpay.co.nz/support)

For:

- Sales inquiries
- Partnership opportunities
- General information
- Product demos

---

## Self-Service Resources

### Documentation Portal

**API Documentation:** [merchants.blinkpay.co.nz](https://merchants.blinkpay.co.nz/)

Comprehensive API reference including:

- Complete endpoint documentation
- Request/response schemas
- Authentication details
- Error codes and descriptions
- OpenAPI/Swagger specification

### Integration Guides

**Payment APIs:**

- [Quick Start Guide](https://merchants.blinkpay.co.nz/docs/debit/quick-start) - Get started with payments
- [Single Payments](https://merchants.blinkpay.co.nz/docs/debit/guides/single-payments) - One-off payment flows
- [Recurring Payments](https://merchants.blinkpay.co.nz/docs/debit/guides/recurring-payments) - Subscription billing

**Data APIs:**

- [Data Quick Start](https://merchants.blinkpay.co.nz/docs/data/quick-start) - Get started with data access
- [Data Retrieval](https://merchants.blinkpay.co.nz/docs/data/guides/data-retrieval) - Complete API documentation

**Shared Guides:**

- [Authentication Guide](https://merchants.blinkpay.co.nz/docs/shared/authentication) - OAuth 2.0 setup
- [Going Live Checklist](https://merchants.blinkpay.co.nz/docs/shared/help/going-live) - Production readiness

---

## Sandbox Testing

**Endpoint:** `https://sandbox.debit.blinkpay.co.nz`

**Mock Bank:** PNZ
**Test Credentials:** username `user02`, password `password`

**Features:**

- No real money transferred
- Instant settlement
- Unlimited testing

---

## Community & Resources

### GitHub

**Organisation:** [github.com/BlinkPay](https://github.com/BlinkPay)

- SDK repositories
- Code examples
- Feature requests

### Postman Workspace

**Public Workspace:** [postman.com/blinkpay](https://www.postman.com/blinkpay/blinkpay-merchant-workspace/overview)

- Complete API collection
- Example requests
- Test environments

---

## Useful Links

### Documentation

- **API Docs**: [merchants.blinkpay.co.nz](https://merchants.blinkpay.co.nz/)
- **Postman**: [postman.com/blinkpay](https://www.postman.com/blinkpay/blinkpay-merchant-workspace/overview)

### Code & SDKs

- **GitHub**: [github.com/BlinkPay](https://github.com/BlinkPay)

### Demos

- **ACME Demo**: [acme-sandbox.blinkpay.co.nz](https://acme-sandbox.blinkpay.co.nz)
- **Data Demo**: [acme-loans-dev.blinkpay.co.nz](https://acme-loans-dev.blinkpay.co.nz)

### Contact

- **Support**: [support@blinkpay.co.nz](mailto:support@blinkpay.co.nz)
- **Website**: [www.blinkpay.co.nz](https://www.blinkpay.co.nz)

---

# OpenAPI reference index

Source: https://merchants.blinkpay.co.nz/resources/DebitOAS

**Blink Debit (PayNow and AutoPay) Payments API — v1.0.49, OpenAPI 3.0.4**

The API executes Direct Credit payments for customers using online banking with supported banks. It powers Blink PayNow one-off payments and Blink AutoPay recurring payments.

All operation paths below are relative to `/payments/v1`.

| Group | Method | Path |
| --- | --- | --- |
| Bank Metadata | `GET` | `/meta` |
| Quick Payments | `POST` | `/quick-payments` |
| Quick Payments | `GET` | `/quick-payments/{quick_payment_id}` |
| Quick Payments | `DELETE` | `/quick-payments/{quick_payment_id}` |
| Single Consents | `POST` | `/single-consents` |
| Single Consents | `GET` | `/single-consents/{consent_id}` |
| Single Consents | `DELETE` | `/single-consents/{consent_id}` |
| Enduring Consents | `POST` | `/enduring-consents` |
| Enduring Consents | `GET` | `/enduring-consents/{consent_id}` |
| Enduring Consents | `DELETE` | `/enduring-consents/{consent_id}` |
| Enduring Consents | `POST` | `/fixed-recurring-payments` |
| Enduring Consents | `GET` | `/fixed-recurring-payments/{fixed_recurring_payment_id}` |
| Enduring Consents | `DELETE` | `/fixed-recurring-payments/{fixed_recurring_payment_id}` |
| Payments | `POST` | `/payments` |
| Payments | `GET` | `/payments/{payment_id}` |
| Refunds | `POST` | `/refunds` |
| Refunds | `GET` | `/refunds/{refund_id}` |
| Transactions | `GET` | `/transactions` |
| Transactions | `GET` | `/transactions/totals` |
| Subscriptions | `POST` | `/subscriptions` |
| Subscriptions | `GET` | `/subscriptions` |
| Subscriptions | `DELETE` | `/subscriptions/{subscription_id}` |

The guide sections above contain the request shapes, response examples, lifecycle rules, webhook contract, error handling, and integration guidance associated with these operations.
