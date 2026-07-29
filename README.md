# FundFlow API

The FundFlow API is the Express and MongoDB backend for the FundFlow crowdfunding platform. It owns application profiles, credits, campaigns, contributions, payments, withdrawals, reports, notifications, and role authorization.

## Links

- Live client: [https://fund-flow-client.vercel.app](https://fund-flow-client.vercel.app)
- Live API: [https://fund-flow-server-ten.vercel.app](https://fund-flow-server-ten.vercel.app)
- Health endpoint: [https://fund-flow-server-ten.vercel.app/api/v1/health](https://fund-flow-server-ten.vercel.app/api/v1/health)
- Client repository: [FundFlow-client](https://github.com/nurhossain-webd/FundFlow-client)
- Server repository: [FundFlow-server](https://github.com/nurhossain-webd/FundFlow-server)

## API capabilities

- Better Auth bearer-session verification.
- Server-side Supporter, Creator, and Admin authorization.
- Idempotent platform-profile onboarding and one-time starting credits.
- Public campaign exploration and top-funded campaign queries.
- Creator campaign creation, updates, and transactional deletion.
- Contribution submission with immediate credit reservation.
- Creator approval and rejection with transactional totals and refunds.
- Stripe Checkout sessions and verified idempotent webhooks.
- Creator withdrawal requests and Admin payout approval.
- Admin user, role, campaign, withdrawal, and report management.
- Targeted, paginated notification delivery.
- MongoDB transactions for financial and multi-document business rules.
- Zod request validation, rate limiting, CORS, Helmet, and safe error responses.

## Local setup

```bash
git clone https://github.com/nurhossain-webd/FundFlow-server.git
cd FundFlow-server
npm install
cp .env.example .env
npm run dev
```

Required configuration:

```env
NODE_ENV=development
PORT=4000
MONGODB_URI=
MONGODB_DB_NAME=fundflow
CLIENT_URL=http://localhost:3000
CLIENT_URLS=https://fund-flow-client.vercel.app
BETTER_AUTH_URL=http://localhost:3000
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

`BETTER_AUTH_URL` must point to the client deployment because Better Auth is hosted by the Next.js application.

## Scripts

```bash
npm run dev
npm run typecheck
npm run test
npm run build
npm run start
npm run seed:demo -- --confirm
```

The demo-data seed inserts public platform content for development and assessment. It does not create Better Auth login credentials.

## API base

Local:

```text
http://localhost:4000/api/v1
```

Production:

```text
https://fund-flow-server-ten.vercel.app/api/v1
```

## Verification

The server includes schema, authorization, security, and transactional integration tests. Run `npm test` before deployment.
