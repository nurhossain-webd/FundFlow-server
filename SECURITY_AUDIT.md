# FundFlow Security Audit

Audit date: July 24, 2026

## Scope

This review covered the Next.js client and Express API, including authentication,
role authorization, ownership enforcement, validation, MongoDB transactions,
Stripe webhooks, notifications, browser token storage, CORS, rate limiting,
security headers, logging, uploads, and environment configuration.

## Fixes applied

1. **Service-layer role enforcement**
   - Sensitive campaign review/deletion, contribution creation/review, credit
     checkout, and withdrawal creation/approval now assert the trusted database
     role again at the service boundary.
   - Suspended actors are rejected at both middleware and service layers.
   - This prevents a future route-wiring mistake from bypassing role middleware.

2. **Webhook rate-limit ordering**
   - The global API rate limiter now runs before the raw Stripe webhook parser
     and webhook controller.
   - Signed webhooks remain verified against the exact raw request body.

3. **CORS tightening**
   - Express allows only the configured client origin, required methods, and
     required request headers.
   - Credentialed cross-origin cookies are disabled because Express API
     authentication uses the Bearer token.

4. **Sensitive request-log redaction**
   - Query strings are omitted from request logs.
   - Stripe Checkout Session IDs in route paths are redacted.
   - Authorization headers, webhook signatures, secrets, tokens, and payment
     metadata are never logged.
   - Production error logging records only the error class, not raw exception
     objects or messages that could contain database or provider context.

5. **CSRF/origin checks on custom Next.js POST handlers**
   - The access-token bridge and image-upload handlers now require the exact
     configured application origin.
   - Requests with a missing, malformed, or foreign `Origin` are rejected.

6. **Safe notification navigation**
   - Notification action paths must be local absolute paths.
   - Protocol-relative paths, backslashes, and control characters are rejected
     during server creation/model validation and checked again before client
     navigation.

7. **Campaign image URL validation**
   - Campaign image URLs now explicitly require HTTP or HTTPS.
   - Schemes such as `javascript:` are rejected before reaching Mongoose.

8. **Browser token handling**
   - The assignment-required Bearer token remains in `localStorage`.
   - Stored values are length/character validated, invalid values are removed,
     storage failures no longer crash authentication, tokens are cleared on
     logout/failed refresh, and tokens are never rendered or logged.

9. **Client security headers**
   - Next.js now sends a restrictive Content Security Policy, clickjacking
     protection, MIME-sniffing protection, a strict referrer policy, and a
     limited Permissions Policy.
   - Network connections and remote campaign images are restricted to the
     configured API origin and approved image host.

10. **Dependency vulnerabilities**
    - The latest stable Next.js package still resolved vulnerable transitive
      PostCSS and Sharp versions.
    - npm overrides now resolve PostCSS 8.5.22 and Sharp 0.35.3 without
      downgrading Next.js. Final production dependency audits report zero known
      vulnerabilities in both repositories.

## Controls verified

- Better Auth validates the Bearer session token; Express never decodes or
  trusts browser-provided identity claims.
- The Express profile is loaded by Better Auth user ID. Email and role used for
  authorization come only from `UserProfile`.
- Public onboarding accepts only `supporter` or `creator`; Admin cannot be
  registered publicly. Unique indexes and a transaction prevent repeated
  initial-credit allocation.
- Protected routes use authentication plus explicit role middleware.
- Creator campaign and contribution operations include creator ownership in
  database filters, preventing IDOR.
- Payment history, withdrawal history, checkout status, contributions, and
  notifications include the authenticated profile ID in queries.
- Notification read operations require both recipient profile ID and Better
  Auth user ID.
- Zod object schemas are strict, MongoDB IDs are validated, numeric values are
  bounded safe integers, and search regular expressions are escaped.
- React renders user content as text; no `dangerouslySetInnerHTML` usage was
  found. Uploads accept only JPEG, PNG, and WebP with size limits.
- Helmet is enabled and Express disables `x-powered-by`.
- Stripe verifies `Stripe-Signature` against the raw body and server secret.
  Package price and credit values come from the server catalog.
- Stripe completion checks order metadata, amount, currency, supporter identity,
  and payment status before allocation.
- Unique Stripe identifiers, conditional status updates, and a MongoDB
  transaction prevent duplicate payment credit allocation.
- Contribution submission uses an idempotency key and transactionally deducts
  credits. Approval/rejection require `pending` status, owner identity, and
  conditional transactional updates.
- Campaign deletion refunds only pending/approved contributions, marks them
  refunded, adjusts creator credits, and deletes the campaign in one transaction.
- Withdrawal requests reserve credits transactionally. Approval requires
  `pending` status and atomically decreases both raised and reserved credits.
- Secret environment variables are server-only. No secret uses a
  `NEXT_PUBLIC_` prefix, and `.env` files remain ignored.
- Production API errors omit stack traces; safe OAuth logging deliberately
  excludes codes, tokens, secrets, and provider response bodies.

## Residual considerations

- `localStorage` cannot be made inaccessible to JavaScript. A successful XSS
  could read the Bearer token. This storage choice is retained only because the
  assignment explicitly requires it. The preferred production design is an
  HttpOnly, Secure, SameSite cookie or a backend-for-frontend token exchange.
- MongoDB transactions require an Atlas replica set or sharded cluster.
- Production deployments should restrict direct access to the Express origin,
  terminate TLS at a trusted proxy, rotate all secrets regularly, and configure
  CSP/reporting at the hosting layer in addition to Helmet.
