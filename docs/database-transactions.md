# FundFlow database transaction boundaries

FundFlow must use MongoDB transactions whenever one business action changes
multiple documents or collections. Every query and write inside one operation
must receive the same Mongoose `ClientSession`.

Use `withMongoTransaction` from
`src/utils/mongo-transaction.ts` as the outer service boundary. Lower-level
financial helpers should call `assertActiveTransaction` when they require a
session.

MongoDB transactions require a replica set. MongoDB Atlas clusters provide this
capability; a local standalone MongoDB server does not.

## Required transactional service methods

The following names are recommended service contracts. Controllers should call
these methods but must not manage balances directly.

### `ContributionService.createContribution`

Must atomically:

1. Load an eligible campaign from the database.
2. Conditionally deduct the immutable contribution amount from the Supporter's
   `credits`, requiring `credits >= amount`.
3. Create the contribution with server-derived campaign, Creator, and Supporter
   details and `pending` status.

Without a transaction, a contribution could exist without its corresponding
debit, or credits could be deducted without a contribution record. The
Supporter-scoped idempotency index prevents duplicate submissions.

### `ContributionService.approveContribution`

Must atomically:

1. Conditionally change one contribution from `pending` to `approved`.
2. Add its stored amount to the campaign's `amountRaised`.
3. Add the same amount to the Creator's `raisedCredits`.

The contribution amount must come from the stored contribution, never from the
request. A conditional status update prevents concurrent approval or rejection
from processing the same contribution twice.

### `ContributionService.rejectContribution`

Must atomically:

1. Conditionally change one contribution from `pending` to `rejected`.
2. Return its stored amount to the Supporter's `credits`.
3. Record refund time and reason.

This prevents either a rejected contribution without a refund or a refund that
can be applied more than once.

### `CampaignService.deleteCampaignAndRefund`

Must atomically, or through idempotent transactional batches:

1. Move the campaign to a state that no longer accepts contributions.
2. Refund pending and approved contributions that have not already been
   refunded.
3. Mark each refunded contribution as `refunded`.
4. Reverse approved amounts from the campaign's `amountRaised` and the
   Creator's `raisedCredits`.
5. Mark the campaign deleted only after reconciliation succeeds.

A campaign with many contributions should use small transactional batches and
durable progress tracking instead of one unbounded transaction. Deletion must be
blocked when the Creator has already withdrawn credits needed for approved
contribution refunds, unless a separate liability policy is implemented.

### `WithdrawalService.approveWithdrawal`

Must atomically:

1. Conditionally change one withdrawal from `pending` to `approved` or
   `processing`.
2. Deduct the stored `requestedCredits` from the Creator's `raisedCredits`,
   requiring a sufficient balance.
3. Record the trusted reviewer and review time.

If credits are reserved when a withdrawal is requested in a later workflow,
the reservation method must instead be transactional and approval must not
deduct them a second time. Only one balance-reservation policy may be active.

External payout-provider calls must happen outside the transaction. Persist a
processing state first, call the provider with an idempotency key, and complete
or compensate the withdrawal in a subsequent transaction.

### `CreditPaymentService.completeCreditPurchase`

Must atomically:

1. Conditionally change a verified Stripe payment from `pending` or `created`
   to `completed`.
2. Add its stored `creditsPurchased` to the Supporter's `credits`.
3. Record its completion time.

This method runs only after server-side Stripe webhook verification. It must
match trusted local payment data and use the unique Stripe identifiers and
idempotency key so webhook retries cannot add credits twice.

## Transaction usage rules

- Pass `{ session }` to every Mongoose query, update, create, and delete in the
  transaction.
- Use conditional updates for balances and state transitions; an earlier read
  alone does not prevent races.
- Treat a zero-document conditional update as a conflict or insufficient-balance
  error and abort the transaction.
- Never use amounts, roles, ownership IDs, prices, or payment status from an
  untrusted client payload.
- Do not make Stripe, email, image-hosting, or other network calls inside the
  transaction callback.
- MongoDB can retry the transaction callback after transient failures. Keep it
  free of non-database side effects and use stable idempotency keys.
- Create notifications after commit, or use a transactional outbox when
  guaranteed delivery becomes necessary.
- Keep transactions short and avoid returning documents that will be mutated
  later without a session.
