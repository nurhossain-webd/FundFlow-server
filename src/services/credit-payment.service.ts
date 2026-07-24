import mongoose from "mongoose";
import type Stripe from "stripe";

import {
  CREDIT_PACKAGES,
  getPublicCreditPackages,
  type CreditPackageId,
} from "../config/credit-packages.js";
import { env } from "../config/env.js";
import { getStripeClient } from "../config/stripe.js";
import { CreditPaymentModel } from "../models/credit-payment.model.js";
import { NotificationModel } from "../models/notification.model.js";
import { UserProfileModel } from "../models/user-profile.model.js";
import type { RequestUser } from "../types/auth-user.js";
import { AppError } from "../utils/app-error.js";
import {
  assertActiveTransaction,
  withMongoTransaction,
} from "../utils/mongo-transaction.js";

export { getPublicCreditPackages };

export const createCreditCheckoutSession = async (
  supporter: RequestUser,
  packageId: CreditPackageId,
) => {
  const stripe = getStripeClient();
  const creditPackage = CREDIT_PACKAGES[packageId];
  const paymentId = new mongoose.Types.ObjectId();
  const idempotencyKey = `checkout:${paymentId.toString()}`;
  let checkoutSession: Stripe.Checkout.Session | undefined;

  try {
    checkoutSession = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        client_reference_id: supporter.authUserId,
        customer_email: supporter.email,
        success_url: `${env.CLIENT_URL}/dashboard/supporter/credits?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.CLIENT_URL}/dashboard/supporter/credits?payment=cancelled`,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: creditPackage.currency,
              unit_amount: creditPackage.amountInCents,
              product_data: {
                name: `${creditPackage.credits.toLocaleString()} FundFlow credits`,
                description: "Credits for supporting campaigns on FundFlow",
              },
            },
          },
        ],
        metadata: {
          paymentId: paymentId.toString(),
          packageId: creditPackage.id,
          supporterAuthUserId: supporter.authUserId,
        },
        payment_intent_data: {
          metadata: {
            paymentId: paymentId.toString(),
            packageId: creditPackage.id,
            supporterAuthUserId: supporter.authUserId,
          },
        },
      },
      { idempotencyKey },
    );

    if (!checkoutSession.url) {
      throw new AppError(502, "Stripe did not return a checkout URL");
    }

    await CreditPaymentModel.create({
      _id: paymentId,
      packageId: creditPackage.id,
      supporterId: supporter.profileId,
      supporterAuthUserId: supporter.authUserId,
      supporterEmail: supporter.email,
      creditsPurchased: creditPackage.credits,
      amountInCents: creditPackage.amountInCents,
      currency: creditPackage.currency,
      status: "pending",
      idempotencyKey,
      stripeCheckoutSessionId: checkoutSession.id,
    });

    return {
      checkoutSessionId: checkoutSession.id,
      checkoutURL: checkoutSession.url,
    };
  } catch (error) {
    if (checkoutSession?.id) {
      await stripe.checkout.sessions.expire(checkoutSession.id).catch(() => {
        // Stripe will also expire an unused Checkout Session automatically.
      });
    }

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(502, "Unable to create Stripe Checkout Session");
  }
};

const getPaymentIntentId = (
  paymentIntent: string | Stripe.PaymentIntent | null,
): string | undefined => {
  if (typeof paymentIntent === "string") {
    return paymentIntent;
  }

  return paymentIntent?.id;
};

const completeCheckoutPayment = async (
  eventId: string,
  checkoutSession: Stripe.Checkout.Session,
) => {
  if (checkoutSession.payment_status !== "paid") {
    return { processed: false };
  }

  const paymentId = checkoutSession.metadata?.paymentId;

  if (!paymentId || !mongoose.isValidObjectId(paymentId)) {
    throw new AppError(400, "Stripe Checkout metadata is invalid");
  }

  return withMongoTransaction(async (session) => {
    assertActiveTransaction(session);

    const payment = await CreditPaymentModel.findOne({
      _id: paymentId,
      stripeCheckoutSessionId: checkoutSession.id,
    })
      .session(session)
      .exec();

    if (!payment) {
      throw new AppError(503, "Payment record is not ready for processing");
    }

    if (payment.status === "completed") {
      return { processed: false };
    }

    if (
      payment.status !== "pending" ||
      checkoutSession.amount_total !== payment.amountInCents ||
      checkoutSession.currency?.toLowerCase() !== payment.currency ||
      checkoutSession.metadata?.packageId !== payment.packageId ||
      checkoutSession.metadata?.supporterAuthUserId !==
        payment.supporterAuthUserId ||
      checkoutSession.client_reference_id !== payment.supporterAuthUserId
    ) {
      throw new AppError(409, "Verified Stripe payment does not match order");
    }

    const stripePaymentIntentId = getPaymentIntentId(
      checkoutSession.payment_intent,
    );
    const paymentUpdate = await CreditPaymentModel.updateOne(
      {
        _id: payment._id,
        status: "pending",
        stripeCheckoutSessionId: checkoutSession.id,
      },
      {
        $set: {
          status: "completed",
          completedAt: new Date(),
          processedStripeEventId: eventId,
          ...(stripePaymentIntentId
            ? { stripePaymentIntentId }
            : {}),
        },
      },
      { session },
    );

    if (paymentUpdate.modifiedCount !== 1) {
      throw new AppError(409, "Payment was already processed");
    }

    const maximumCurrentCredits =
      Number.MAX_SAFE_INTEGER - payment.creditsPurchased;
    const supporterUpdate = await UserProfileModel.updateOne(
      {
        _id: payment.supporterId,
        authUserId: payment.supporterAuthUserId,
        role: "supporter",
        credits: { $lte: maximumCurrentCredits },
      },
      { $inc: { credits: payment.creditsPurchased } },
      { session },
    );

    if (supporterUpdate.modifiedCount !== 1) {
      throw new AppError(409, "Purchased credits could not be allocated");
    }

    await NotificationModel.create(
      [
        {
          recipientId: payment.supporterId,
          recipientAuthUserId: payment.supporterAuthUserId,
          type: "payment_completed",
          title: "Credit purchase completed",
          message: `${payment.creditsPurchased.toLocaleString()} FundFlow credits were added to your account.`,
          relatedEntityType: "creditPayment",
          relatedEntityId: payment._id,
          actionPath: "/dashboard/supporter/credits",
          isRead: false,
        },
      ],
      { session },
    );

    return {
      processed: true,
      paymentId: payment._id.toString(),
    };
  });
};

const expireCheckoutPayment = async (
  checkoutSession: Stripe.Checkout.Session,
) => {
  await CreditPaymentModel.updateOne(
    {
      stripeCheckoutSessionId: checkoutSession.id,
      status: "pending",
    },
    {
      $set: {
        status: "failed",
        failureReason: "Stripe Checkout Session expired before payment",
      },
    },
  ).exec();

  return { processed: true };
};

export const processStripeWebhookEvent = async (event: Stripe.Event) => {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      return completeCheckoutPayment(event.id, event.data.object);
    case "checkout.session.expired":
      return expireCheckoutPayment(event.data.object);
    default:
      return { processed: false };
  }
};
