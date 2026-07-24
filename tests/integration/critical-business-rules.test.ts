import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import type Stripe from "stripe";

import type { RequestUser } from "../../src/types/auth-user.js";
import { AppError } from "../../src/utils/app-error.js";

let replicaSet: MongoMemoryReplSet;

let UserProfileModel: (typeof import("../../src/models/user-profile.model.js"))["UserProfileModel"];
let CampaignModel: (typeof import("../../src/models/campaign.model.js"))["CampaignModel"];
let ContributionModel: (typeof import("../../src/models/contribution.model.js"))["ContributionModel"];
let CreditPaymentModel: (typeof import("../../src/models/credit-payment.model.js"))["CreditPaymentModel"];
let WithdrawalModel: (typeof import("../../src/models/withdrawal.model.js"))["WithdrawalModel"];
let NotificationModel: (typeof import("../../src/models/notification.model.js"))["NotificationModel"];
let ReportModel: (typeof import("../../src/models/report.model.js"))["ReportModel"];

let createUserProfileOnce: (typeof import("../../src/services/user-profile.service.js"))["createUserProfileOnce"];
let createContribution: (typeof import("../../src/services/contribution.service.js"))["createContribution"];
let approveContribution: (typeof import("../../src/services/contribution.service.js"))["approveContribution"];
let rejectContribution: (typeof import("../../src/services/contribution.service.js"))["rejectContribution"];
let approveCampaign: (typeof import("../../src/services/campaign.service.js"))["approveCampaign"];
let deleteCampaignWithRefunds: (typeof import("../../src/services/campaign.service.js"))["deleteCampaignWithRefunds"];
let createWithdrawalRequest: (typeof import("../../src/services/withdrawal.service.js"))["createWithdrawalRequest"];
let approveWithdrawalRequest: (typeof import("../../src/services/withdrawal.service.js"))["approveWithdrawalRequest"];
let processStripeWebhookEvent: (typeof import("../../src/services/credit-payment.service.js"))["processStripeWebhookEvent"];
let createNotification: (typeof import("../../src/services/notification.service.js"))["createNotification"];
let getUserNotifications: (typeof import("../../src/services/notification.service.js"))["getUserNotifications"];
let markUserNotificationRead: (typeof import("../../src/services/notification.service.js"))["markUserNotificationRead"];

const expectAppError = (
  statusCode: number,
  messagePattern?: RegExp,
): ((error: unknown) => boolean) => {
  return (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.statusCode, statusCode);
    if (messagePattern) {
      assert.match(error.message, messagePattern);
    }
    return true;
  };
};

const toRequestUser = (
  profile: {
    _id: mongoose.Types.ObjectId;
    authUserId: string;
    displayName: string;
    email: string;
    role: RequestUser["role"];
    credits: number;
    raisedCredits: number;
    isSuspended: boolean;
  },
): RequestUser => ({
  profileId: profile._id.toString(),
  authUserId: profile.authUserId,
  displayName: profile.displayName,
  email: profile.email,
  role: profile.role,
  credits: profile.credits,
  raisedCredits: profile.raisedCredits,
  isSuspended: profile.isSuspended,
});

const createProfile = async (
  role: RequestUser["role"],
  sequence: number,
  balances: { credits?: number; raisedCredits?: number } = {},
) => {
  return UserProfileModel.create({
    authUserId: `auth-${role}-${sequence}`,
    displayName: `${role} ${sequence}`,
    email: `${role}-${sequence}@example.com`,
    role,
    credits: balances.credits ?? 0,
    raisedCredits: balances.raisedCredits ?? 0,
    reservedRaisedCredits: 0,
    isSuspended: false,
    isDeleted: false,
  });
};

const createCampaignFixture = async (
  creator: Awaited<ReturnType<typeof createProfile>>,
  status: "pending" | "approved" = "approved",
) => {
  return CampaignModel.create({
    title: "Community solar learning hub",
    story:
      "This community-led campaign will equip a shared learning room with dependable solar lighting, practical science tools, and teacher-led workshops.",
    category: "Education",
    fundingGoal: 5_000,
    minimumContribution: 10,
    deadline: new Date(Date.now() + 7 * 86_400_000),
    rewardInfo: "Supporters receive verified project progress reports.",
    imageURL: "https://i.ibb.co/fundflow/solar-learning-hub.jpg",
    creatorId: creator._id,
    creatorName: creator.displayName,
    creatorEmail: creator.email,
    amountRaised: 0,
    status,
  });
};

before(async () => {
  process.env.NODE_ENV = "test";
  process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/fundflow-test";
  process.env.CLIENT_URL = "http://localhost:3000";
  process.env.BETTER_AUTH_URL = "http://localhost:3000";

  replicaSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(replicaSet.getUri("fundflow-test"));

  ({ UserProfileModel } =
    await import("../../src/models/user-profile.model.js"));
  ({ CampaignModel } = await import("../../src/models/campaign.model.js"));
  ({ ContributionModel } =
    await import("../../src/models/contribution.model.js"));
  ({ CreditPaymentModel } =
    await import("../../src/models/credit-payment.model.js"));
  ({ WithdrawalModel } = await import("../../src/models/withdrawal.model.js"));
  ({ NotificationModel } =
    await import("../../src/models/notification.model.js"));
  ({ ReportModel } = await import("../../src/models/report.model.js"));

  ({ createUserProfileOnce } =
    await import("../../src/services/user-profile.service.js"));
  ({ createContribution, approveContribution, rejectContribution } =
    await import("../../src/services/contribution.service.js"));
  ({ approveCampaign, deleteCampaignWithRefunds } =
    await import("../../src/services/campaign.service.js"));
  ({ createWithdrawalRequest, approveWithdrawalRequest } =
    await import("../../src/services/withdrawal.service.js"));
  ({ processStripeWebhookEvent } =
    await import("../../src/services/credit-payment.service.js"));
  ({ createNotification, getUserNotifications, markUserNotificationRead } =
    await import("../../src/services/notification.service.js"));

  await Promise.all([
    UserProfileModel.init(),
    CampaignModel.init(),
    ContributionModel.init(),
    CreditPaymentModel.init(),
    WithdrawalModel.init(),
    NotificationModel.init(),
    ReportModel.init(),
  ]);
});

beforeEach(async () => {
  await Promise.all(
    [
      UserProfileModel,
      CampaignModel,
      ContributionModel,
      CreditPaymentModel,
      WithdrawalModel,
      NotificationModel,
      ReportModel,
    ].map((model) => model.deleteMany({})),
  );
});

after(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

describe("critical transactional business rules", () => {
  it("allocates registration credits exactly once", async () => {
    const identity = {
      id: "better-auth-supporter",
      name: "Amina Rahman",
      email: "amina@example.com",
    };

    const first = await createUserProfileOnce(identity, "supporter");
    const repeated = await createUserProfileOnce(identity, "creator");

    assert.equal(first.created, true);
    assert.equal(repeated.created, false);
    assert.equal(repeated.profile.role, "supporter");
    assert.equal(repeated.profile.credits, 50);
    assert.equal(
      await UserProfileModel.countDocuments({ authUserId: identity.id }),
      1,
    );
  });

  it("deducts supporter credits once when a contribution is submitted", async () => {
    const supporterProfile = await createProfile("supporter", 1, {
      credits: 100,
    });
    const creatorProfile = await createProfile("creator", 1);
    const campaign = await createCampaignFixture(creatorProfile);
    const supporter = toRequestUser(supporterProfile);
    const input = { campaignId: campaign.id, amount: 30 };
    const idempotencyKey = "contribution:deduction:0001";

    const first = await createContribution(supporter, input, idempotencyKey);
    const repeated = await createContribution(supporter, input, idempotencyKey);
    const refreshedSupporter = await UserProfileModel.findById(
      supporterProfile._id,
    ).lean();

    assert.equal(first.created, true);
    assert.equal(repeated.created, false);
    assert.equal(refreshedSupporter?.credits, 70);
    assert.equal(await ContributionModel.countDocuments(), 1);
  });

  it("approves a contribution and credits the campaign and creator exactly once", async () => {
    const supporterProfile = await createProfile("supporter", 2, {
      credits: 100,
    });
    const creatorProfile = await createProfile("creator", 2);
    const campaign = await createCampaignFixture(creatorProfile);
    const contributionResult = await createContribution(
      toRequestUser(supporterProfile),
      { campaignId: campaign.id, amount: 40 },
      "contribution:approval:0001",
    );

    await approveContribution(
      contributionResult.contribution._id.toString(),
      toRequestUser(creatorProfile),
    );
    await assert.rejects(
      approveContribution(
        contributionResult.contribution._id.toString(),
        toRequestUser(creatorProfile),
      ),
      expectAppError(409, /pending contributions/),
    );

    const [updatedCampaign, updatedCreator] = await Promise.all([
      CampaignModel.findById(campaign._id).lean(),
      UserProfileModel.findById(creatorProfile._id).lean(),
    ]);
    assert.equal(updatedCampaign?.amountRaised, 40);
    assert.equal(updatedCreator?.raisedCredits, 40);
  });

  it("rejects a contribution and refunds the supporter exactly once", async () => {
    const supporterProfile = await createProfile("supporter", 3, {
      credits: 100,
    });
    const creatorProfile = await createProfile("creator", 3);
    const campaign = await createCampaignFixture(creatorProfile);
    const contributionResult = await createContribution(
      toRequestUser(supporterProfile),
      { campaignId: campaign.id, amount: 25 },
      "contribution:rejection:0001",
    );

    await rejectContribution(
      contributionResult.contribution._id.toString(),
      toRequestUser(creatorProfile),
      "The contribution message requires clarification.",
    );
    await assert.rejects(
      rejectContribution(
        contributionResult.contribution._id.toString(),
        toRequestUser(creatorProfile),
        "Trying to reject the same contribution again.",
      ),
      expectAppError(409, /pending contributions/),
    );

    const supporter = await UserProfileModel.findById(
      supporterProfile._id,
    ).lean();
    assert.equal(supporter?.credits, 100);
  });

  it("refunds pending and approved contributions when a campaign is deleted", async () => {
    const supporterProfile = await createProfile("supporter", 4, {
      credits: 50,
    });
    const creatorProfile = await createProfile("creator", 4);
    const supporter = toRequestUser(supporterProfile);
    const creator = toRequestUser(creatorProfile);
    const campaign = await createCampaignFixture(creatorProfile);
    const approved = await createContribution(
      supporter,
      { campaignId: campaign.id, amount: 30 },
      "contribution:delete:approved",
    );
    await approveContribution(approved.contribution._id.toString(), creator);
    await createContribution(
      supporter,
      { campaignId: campaign.id, amount: 20 },
      "contribution:delete:pending",
    );

    const result = await deleteCampaignWithRefunds({
      campaignId: campaign.id,
      actor: creator,
    });
    const [supporterAfter, creatorAfter, contributions] = await Promise.all([
      UserProfileModel.findById(supporterProfile._id).lean(),
      UserProfileModel.findById(creatorProfile._id).lean(),
      ContributionModel.find({ campaignId: campaign._id }).lean(),
    ]);

    assert.equal(result.refundedCredits, 50);
    assert.equal(supporterAfter?.credits, 50);
    assert.equal(creatorAfter?.raisedCredits, 0);
    assert.deepEqual(
      contributions.map((contribution) => contribution.status).sort(),
      ["refunded", "refunded"],
    );
    assert.equal(await CampaignModel.exists({ _id: campaign._id }), null);
  });

  it("enforces the withdrawal minimum without reserving credits", async () => {
    const creatorProfile = await createProfile("creator", 5, {
      raisedCredits: 500,
    });

    await assert.rejects(
      createWithdrawalRequest(
        toRequestUser(creatorProfile),
        {
          credits: 199,
          paymentSystem: "bkash",
          accountNumber: "01700000000",
        },
        "withdrawal:minimum:0001",
      ),
    );

    const creator = await UserProfileModel.findById(creatorProfile._id).lean();
    assert.equal(creator?.raisedCredits, 500);
    assert.equal(creator?.reservedRaisedCredits, 0);
    assert.equal(await WithdrawalModel.countDocuments(), 0);
  });

  it("approves a withdrawal and deducts reserved raised credits exactly once", async () => {
    const creatorProfile = await createProfile("creator", 6, {
      raisedCredits: 500,
    });
    const adminProfile = await createProfile("admin", 1);
    const request = await createWithdrawalRequest(
      toRequestUser(creatorProfile),
      {
        credits: 200,
        paymentSystem: "nagad",
        accountNumber: "01800000000",
      },
      "withdrawal:approval:0001",
    );

    await approveWithdrawalRequest(
      request.withdrawal.id,
      toRequestUser(adminProfile),
    );
    await assert.rejects(
      approveWithdrawalRequest(
        request.withdrawal.id,
        toRequestUser(adminProfile),
      ),
      expectAppError(409, /no longer pending/),
    );

    const creator = await UserProfileModel.findById(creatorProfile._id).lean();
    assert.equal(creator?.raisedCredits, 300);
    assert.equal(creator?.reservedRaisedCredits, 0);
  });

  it("processes a verified Stripe payment event idempotently", async () => {
    const supporterProfile = await createProfile("supporter", 7, {
      credits: 50,
    });
    const payment = await CreditPaymentModel.create({
      packageId: "credits_100",
      supporterId: supporterProfile._id,
      supporterAuthUserId: supporterProfile.authUserId,
      supporterEmail: supporterProfile.email,
      creditsPurchased: 100,
      amountInCents: 1_000,
      currency: "usd",
      paymentMethod: "Card",
      status: "pending",
      idempotencyKey: "checkout:payment-test-0001",
      stripeCheckoutSessionId: "cs_test_fundflow_0001",
    });
    const checkoutSession = {
      id: "cs_test_fundflow_0001",
      object: "checkout.session",
      payment_status: "paid",
      amount_total: 1_000,
      currency: "usd",
      client_reference_id: supporterProfile.authUserId,
      payment_intent: "pi_test_fundflow_0001",
      metadata: {
        paymentId: payment.id,
        packageId: "credits_100",
        supporterAuthUserId: supporterProfile.authUserId,
      },
    } as Stripe.Checkout.Session;
    const firstEvent = {
      id: "evt_test_fundflow_0001",
      type: "checkout.session.completed",
      data: { object: checkoutSession },
    } as Stripe.Event;
    const repeatedEvent = {
      ...firstEvent,
      id: "evt_test_fundflow_0002",
    } as Stripe.Event;

    assert.deepEqual(await processStripeWebhookEvent(firstEvent), {
      processed: true,
      paymentId: payment.id,
    });
    assert.deepEqual(await processStripeWebhookEvent(repeatedEvent), {
      processed: false,
    });

    const supporter = await UserProfileModel.findById(
      supporterProfile._id,
    ).lean();
    assert.equal(supporter?.credits, 150);
    assert.equal(
      await NotificationModel.countDocuments({
        recipientId: supporterProfile._id,
        type: "payment_completed",
      }),
      1,
    );
  });

  it("prevents users from reading or modifying another user's notification", async () => {
    const ownerProfile = await createProfile("supporter", 8);
    const otherProfile = await createProfile("supporter", 9);
    const notification = await createNotification({
      recipientId: ownerProfile._id,
      recipientAuthUserId: ownerProfile.authUserId,
      toEmail: ownerProfile.email,
      type: "system",
      title: "Account update",
      message: "Your FundFlow profile is ready.",
      actionRoute: "/dashboard/supporter",
    });

    const otherUser = toRequestUser(otherProfile);
    const otherNotifications = await getUserNotifications(otherUser, {
      page: 1,
      limit: 20,
    });
    assert.equal(otherNotifications.pagination.total, 0);
    await assert.rejects(
      markUserNotificationRead(otherUser, notification.id),
      expectAppError(404, /not found/),
    );

    const unreadNotification = await NotificationModel.findById(
      notification._id,
    ).lean();
    assert.equal(unreadNotification?.isRead, false);
  });

  it("allows only an Admin to approve a pending campaign", async () => {
    const creatorProfile = await createProfile("creator", 10);
    const adminProfile = await createProfile("admin", 2);
    const campaign = await createCampaignFixture(creatorProfile, "pending");

    await assert.rejects(
      approveCampaign(campaign.id, toRequestUser(creatorProfile)),
      expectAppError(403),
    );
    assert.equal(
      (await CampaignModel.findById(campaign._id).lean())?.status,
      "pending",
    );

    const approved = await approveCampaign(
      campaign.id,
      toRequestUser(adminProfile),
    );
    assert.equal(approved.status, "approved");
  });
});
