import mongoose, { type ClientSession } from "mongoose";

import {
  connectToDatabase,
  disconnectFromDatabase,
} from "../config/database.js";
import { CampaignModel } from "../models/campaign.model.js";
import { ContributionModel } from "../models/contribution.model.js";
import { CreditPaymentModel } from "../models/credit-payment.model.js";
import { NotificationModel } from "../models/notification.model.js";
import { ReportModel } from "../models/report.model.js";
import { UserProfileModel } from "../models/user-profile.model.js";
import { WithdrawalModel } from "../models/withdrawal.model.js";
import { withMongoTransaction } from "../utils/mongo-transaction.js";

const SEED_PREFIX = "fundflow-demo-v1";
const isConfirmed = process.argv.includes("--confirm");

const objectId = (sequence: number): mongoose.Types.ObjectId =>
  new mongoose.Types.ObjectId(sequence.toString(16).padStart(24, "0"));

const daysFromNow = (days: number): Date =>
  new Date(Date.now() + days * 86_400_000);

const daysAgo = (days: number): Date => daysFromNow(-days);

const requiredItem = <T>(
  items: readonly T[],
  index: number,
  label: string,
): T => {
  const item = items[index];

  if (item === undefined) {
    throw new Error(`Missing ${label} seed item at index ${index}`);
  }

  return item;
};

const unsplashImage = (photoId: string): string =>
  `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=1600&q=80`;

const campaignImages = [
  unsplashImage("photo-1509391366360-2e959784a276"),
  unsplashImage("photo-1610500796385-3ffc1ae2f046"),
  unsplashImage("photo-1515150144380-bca9f1650ed9"),
  unsplashImage("photo-1538300342682-cf57afb97285"),
  unsplashImage("photo-1578357078586-491adf1aa5ba"),
  unsplashImage("photo-1508514177221-188b1cf16e9d"),
  unsplashImage("photo-1529390079861-591de354faf5"),
  unsplashImage("photo-1527525443983-6e60c75fff46"),
] as const;

const profileImages = [
  unsplashImage("photo-1494790108377-be9c29b29330"),
  unsplashImage("photo-1500648767791-00dcc994a43e"),
  unsplashImage("photo-1534528741775-53994a69daeb"),
  unsplashImage("photo-1507003211169-0a1dd7228f2d"),
  unsplashImage("photo-1438761681033-6461ffad8d80"),
  unsplashImage("photo-1506794778202-cad84cf45f1d"),
] as const;

const creatorDefinitions = [
  {
    name: "Amara Okafor",
    raisedCredits: 1_835,
    reservedRaisedCredits: 400,
  },
  { name: "Daniel Kim", raisedCredits: 1_060, reservedRaisedCredits: 0 },
  { name: "Nadia Rahman", raisedCredits: 670, reservedRaisedCredits: 0 },
  { name: "Mateo Silva", raisedCredits: 950, reservedRaisedCredits: 0 },
] as const;

const supporterDefinitions = [
  { name: "Leila Hassan", credits: 620 },
  { name: "Marcus Green", credits: 340 },
  { name: "Sofia Chen", credits: 880 },
  { name: "Owen Brooks", credits: 215 },
  { name: "Maya Patel", credits: 475 },
  { name: "Elias Mensah", credits: 730 },
] as const;

const creators = creatorDefinitions.map((creator, index) => ({
  _id: objectId(101 + index),
  authUserId: `${SEED_PREFIX}-creator-${index + 1}`,
  displayName: creator.name,
  email: `seed.creator.${index + 1}@fundflow.example`,
  photoURL: profileImages[index],
  role: "creator" as const,
  credits: 20,
  raisedCredits: creator.raisedCredits,
  reservedRaisedCredits: creator.reservedRaisedCredits,
  isSuspended: false,
  isDeleted: false,
  createdAt: daysAgo(150 - index * 15),
  updatedAt: daysAgo(index + 1),
}));

const supporters = supporterDefinitions.map((supporter, index) => ({
  _id: objectId(201 + index),
  authUserId: `${SEED_PREFIX}-supporter-${index + 1}`,
  displayName: supporter.name,
  email: `seed.supporter.${index + 1}@fundflow.example`,
  photoURL: profileImages[(index + 2) % profileImages.length],
  role: "supporter" as const,
  credits: supporter.credits,
  raisedCredits: 0,
  reservedRaisedCredits: 0,
  isSuspended: false,
  isDeleted: false,
  createdAt: daysAgo(120 - index * 10),
  updatedAt: daysAgo(index),
}));

const admin = {
  _id: objectId(301),
  authUserId: `${SEED_PREFIX}-admin-1`,
  displayName: "FundFlow Demo Operations",
  email: "seed.admin@fundflow.example",
  role: "admin" as const,
  credits: 0,
  raisedCredits: 0,
  reservedRaisedCredits: 0,
  isSuspended: false,
  isDeleted: false,
  createdAt: daysAgo(180),
  updatedAt: daysAgo(1),
};

const campaignDefinitions = [
  {
    title: "Solar Study Rooms for Riverside Schools",
    story:
      "Three riverside schools lose valuable teaching hours during power cuts. This campaign installs safe solar lighting, charging stations, and hands-on energy learning kits in shared study rooms managed by local educators.",
    category: "Education",
    fundingGoal: 2_000,
    minimumContribution: 20,
    deadlineDays: 42,
    rewardInfo:
      "Supporters receive classroom progress updates and a digital impact report created by participating students.",
    creatorIndex: 0,
    amountRaised: 1_280,
    status: "approved",
    createdDaysAgo: 48,
  },
  {
    title: "Mobile Health Checks for Remote Villages",
    story:
      "A volunteer medical team is converting a compact vehicle into a mobile screening unit for blood pressure, diabetes, and maternal health checks across communities with limited clinic access.",
    category: "Healthcare",
    fundingGoal: 1_600,
    minimumContribution: 25,
    deadlineDays: 31,
    rewardInfo:
      "Monthly field reports share anonymized visit totals, routes completed, and equipment purchased.",
    creatorIndex: 1,
    amountRaised: 920,
    status: "approved",
    createdDaysAgo: 39,
  },
  {
    title: "Neighborhood Makers Lab for Young Inventors",
    story:
      "An unused storefront will become an affordable makers lab where teenagers can learn electronics, repair skills, 3D design, and safe tool use with experienced volunteer mentors.",
    category: "Technology",
    fundingGoal: 1_400,
    minimumContribution: 15,
    deadlineDays: 55,
    rewardInfo:
      "Supporters receive invitations to streamed demo days and a quarterly project showcase.",
    creatorIndex: 2,
    amountRaised: 760,
    status: "approved",
    createdDaysAgo: 34,
  },
  {
    title: "Clean Water Filters for Hill Communities",
    story:
      "Community leaders identified forty households relying on unsafe seasonal water sources. Funding supplies locally serviceable filters, water testing, and practical maintenance training.",
    category: "Community",
    fundingGoal: 1_200,
    minimumContribution: 10,
    deadlineDays: 24,
    rewardInfo:
      "Backers receive verified installation photos and water-quality summaries from each distribution round.",
    creatorIndex: 3,
    amountRaised: 560,
    status: "approved",
    createdDaysAgo: 28,
  },
  {
    title: "Tools for a Women-Led Coastal Workshop",
    story:
      "A cooperative of coastal artisans needs shared cutting tools, safety equipment, and weatherproof storage to turn reclaimed materials into durable household products and stable local income.",
    category: "Small Business",
    fundingGoal: 900,
    minimumContribution: 10,
    deadlineDays: 38,
    rewardInfo:
      "Selected support levels receive a handmade keepsake and every supporter receives workshop updates.",
    creatorIndex: 0,
    amountRaised: 430,
    status: "approved",
    createdDaysAgo: 24,
  },
  {
    title: "Community Garden and Weekend Food Market",
    story:
      "Residents are transforming two vacant plots into raised garden beds and a weekend produce market, combining affordable fresh food with practical growing workshops for families.",
    category: "Environment",
    fundingGoal: 800,
    minimumContribution: 10,
    deadlineDays: 46,
    rewardInfo:
      "Supporters receive seasonal planting guides and invitations to community harvest days.",
    creatorIndex: 1,
    amountRaised: 340,
    status: "approved",
    createdDaysAgo: 20,
  },
  {
    title: "Accessible Music Studio for Local Artists",
    story:
      "This project will soundproof an accessible rehearsal room, purchase shared recording equipment, and reserve weekly studio hours for emerging musicians who cannot afford commercial rates.",
    category: "Creative Arts",
    fundingGoal: 750,
    minimumContribution: 15,
    deadlineDays: 29,
    rewardInfo:
      "Supporters receive a digital compilation from the first group of participating artists.",
    creatorIndex: 2,
    amountRaised: 310,
    status: "approved",
    createdDaysAgo: 18,
  },
  {
    title: "Reading Corners for Community Libraries",
    story:
      "Five small libraries are creating welcoming reading corners with durable shelves, locally published books, comfortable seating, and weekly volunteer-led storytelling sessions.",
    category: "Education",
    fundingGoal: 600,
    minimumContribution: 10,
    deadlineDays: 61,
    rewardInfo:
      "Supporters receive a reading-list booklet and updates from each participating library.",
    creatorIndex: 3,
    amountRaised: 180,
    status: "approved",
    createdDaysAgo: 14,
  },
  {
    title: "Repair Bicycles for Student Commuters",
    story:
      "Volunteer mechanics will refurbish donated bicycles and provide helmets, lights, locks, and maintenance lessons to students with long and unreliable daily commutes.",
    category: "Community",
    fundingGoal: 500,
    minimumContribution: 10,
    deadlineDays: 35,
    rewardInfo:
      "Supporters receive repair-day photos and a transparent final distribution report.",
    creatorIndex: 0,
    amountRaised: 125,
    status: "approved",
    createdDaysAgo: 11,
  },
  {
    title: "Emergency Learning Kits After Monsoon Flooding",
    story:
      "Teachers are preparing portable learning kits so displaced children can continue basic reading and mathematics lessons while damaged classrooms are repaired.",
    category: "Emergency Relief",
    fundingGoal: 1_800,
    minimumContribution: 20,
    deadlineDays: 70,
    rewardInfo:
      "Supporters will receive procurement receipts and weekly distribution updates.",
    creatorIndex: 3,
    amountRaised: 0,
    status: "pending",
    createdDaysAgo: 3,
  },
  {
    title: "Cold Storage for Small Farm Cooperatives",
    story:
      "A solar-assisted cold room would help twelve small farms reduce post-harvest losses, coordinate deliveries, and keep fresh produce available for nearby markets.",
    category: "Agriculture",
    fundingGoal: 2_400,
    minimumContribution: 25,
    deadlineDays: 80,
    rewardInfo:
      "Supporters receive milestone reports covering construction, energy use, and food saved.",
    creatorIndex: 1,
    amountRaised: 0,
    status: "pending",
    createdDaysAgo: 2,
  },
  {
    title: "Pop-Up Cinema for Independent Documentaries",
    story:
      "The proposal would fund a traveling projection setup for independent documentary screenings and facilitated community discussions across several neighborhoods.",
    category: "Creative Arts",
    fundingGoal: 1_100,
    minimumContribution: 15,
    deadlineDays: 50,
    rewardInfo:
      "Supporters would receive screening schedules and filmmaker discussion recordings.",
    creatorIndex: 2,
    amountRaised: 0,
    status: "rejected",
    createdDaysAgo: 16,
  },
  {
    title: "Community E-Waste Collection and Repair Week",
    story:
      "A neighborhood repair group proposed a collection week for broken electronics, data-safe recycling, and workshops focused on extending the life of common devices.",
    category: "Environment",
    fundingGoal: 700,
    minimumContribution: 10,
    deadlineDays: 18,
    rewardInfo:
      "Supporters receive repair guides and an audited summary of devices reused or recycled.",
    creatorIndex: 3,
    amountRaised: 210,
    status: "suspended",
    createdDaysAgo: 26,
  },
] as const;

const campaigns = campaignDefinitions.map((campaign, index) => {
  const creator = requiredItem(
    creators,
    campaign.creatorIndex,
    "campaign creator",
  );

  return {
    _id: objectId(401 + index),
    title: campaign.title,
    story: campaign.story,
    category: campaign.category,
    fundingGoal: campaign.fundingGoal,
    minimumContribution: campaign.minimumContribution,
    deadline: daysFromNow(campaign.deadlineDays),
    rewardInfo: campaign.rewardInfo,
    imageURL: requiredItem(
      campaignImages,
      index % campaignImages.length,
      "campaign image",
    ),
    creatorId: creator._id,
    creatorName: creator.displayName,
    creatorEmail: creator.email,
    amountRaised: campaign.amountRaised,
    status: campaign.status,
    createdAt: daysAgo(campaign.createdDaysAgo),
    updatedAt: daysAgo(index % 5),
  };
});

const approvedAmounts = [
  [500, 430, 350],
  [400, 320, 200],
  [300, 260, 200],
  [240, 180, 140],
  [200, 130, 100],
  [160, 100, 80],
  [150, 100, 60],
  [80, 60, 40],
  [75, 50],
] as const;

let contributionSequence = 501;
const approvedContributions = approvedAmounts.flatMap(
  (amounts, campaignIndex) =>
    amounts.map((amount, amountIndex) => {
      const sequence = contributionSequence++;
      const campaign = requiredItem(campaigns, campaignIndex, "campaign");
      const campaignDefinition = requiredItem(
        campaignDefinitions,
        campaignIndex,
        "campaign definition",
      );
      const creator = requiredItem(
        creators,
        campaignDefinition.creatorIndex,
        "contribution creator",
      );
      const supporter = requiredItem(
        supporters,
        (campaignIndex * 2 + amountIndex) % supporters.length,
        "contribution supporter",
      );
      const createdAt = daysAgo(Math.max(1, 30 - campaignIndex * 3));

      return {
        _id: objectId(sequence),
        campaignId: campaign._id,
        campaignTitle: campaign.title,
        supporterId: supporter._id,
        supporterAuthUserId: supporter.authUserId,
        supporterName: supporter.displayName,
        supporterEmail: supporter.email,
        creatorId: creator._id,
        creatorName: creator.displayName,
        creatorEmail: creator.email,
        amount,
        message:
          amountIndex === 0
            ? "This project has a clear plan and meaningful community value."
            : "Glad to help this campaign move closer to its goal.",
        status: "approved" as const,
        idempotencyKey: `${SEED_PREFIX}-contribution-${sequence}`,
        reviewedAt: createdAt,
        reviewedByAuthUserId: creator.authUserId,
        createdAt,
        updatedAt: createdAt,
      };
    }),
);

const pendingDefinitions = [
  { campaignIndex: 0, supporterIndex: 4, amount: 45 },
  { campaignIndex: 2, supporterIndex: 5, amount: 35 },
  { campaignIndex: 5, supporterIndex: 1, amount: 25 },
] as const;

const pendingContributions = pendingDefinitions.map((definition, index) => {
  const sequence = contributionSequence++;
  const campaign = requiredItem(
    campaigns,
    definition.campaignIndex,
    "pending contribution campaign",
  );
  const campaignDefinition = requiredItem(
    campaignDefinitions,
    definition.campaignIndex,
    "pending campaign definition",
  );
  const creator = requiredItem(
    creators,
    campaignDefinition.creatorIndex,
    "pending contribution creator",
  );
  const supporter = requiredItem(
    supporters,
    definition.supporterIndex,
    "pending contribution supporter",
  );
  const createdAt = daysAgo(index);

  return {
    _id: objectId(sequence),
    campaignId: campaign._id,
    campaignTitle: campaign.title,
    supporterId: supporter._id,
    supporterAuthUserId: supporter.authUserId,
    supporterName: supporter.displayName,
    supporterEmail: supporter.email,
    creatorId: creator._id,
    creatorName: creator.displayName,
    creatorEmail: creator.email,
    amount: definition.amount,
    message: "I appreciate the practical milestones in this campaign.",
    status: "pending" as const,
    idempotencyKey: `${SEED_PREFIX}-contribution-${sequence}`,
    createdAt,
    updatedAt: createdAt,
  };
});

const contributions = [...approvedContributions, ...pendingContributions];

const paymentPackages = [
  ["credits_300", 300, 2_500],
  ["credits_100", 100, 1_000],
  ["credits_800", 800, 6_000],
  ["credits_300", 300, 2_500],
  ["credits_1500", 1_500, 11_000],
  ["credits_100", 100, 1_000],
  ["credits_300", 300, 2_500],
  ["credits_800", 800, 6_000],
  ["credits_100", 100, 1_000],
  ["credits_300", 300, 2_500],
] as const;

const payments = paymentPackages.map((creditPackage, index) => {
  const supporter = requiredItem(
    supporters,
    index % supporters.length,
    "payment supporter",
  );
  const completedAt = daysAgo(index * 2 + 1);

  return {
    _id: objectId(601 + index),
    packageId: creditPackage[0],
    supporterId: supporter._id,
    supporterAuthUserId: supporter.authUserId,
    supporterEmail: supporter.email,
    creditsPurchased: creditPackage[1],
    amountInCents: creditPackage[2],
    currency: "usd",
    paymentMethod: "Card",
    status: "completed" as const,
    idempotencyKey: `${SEED_PREFIX}-payment-${index + 1}`,
    stripeCheckoutSessionId: `cs_seed_${index + 1}`,
    stripePaymentIntentId: `pi_seed_${index + 1}`,
    processedStripeEventId: `evt_seed_${index + 1}`,
    completedAt,
    createdAt: completedAt,
    updatedAt: completedAt,
  };
});

const withdrawalDefinitions = [
  {
    creatorIndex: 0,
    credits: 400,
    paymentSystem: "bkash" as const,
    accountNumber: "01700000001",
    status: "pending" as const,
    createdDaysAgo: 2,
  },
  {
    creatorIndex: 1,
    credits: 200,
    paymentSystem: "stripe" as const,
    accountNumber: "acct_demo_2048",
    status: "approved" as const,
    createdDaysAgo: 12,
  },
  {
    creatorIndex: 2,
    credits: 400,
    paymentSystem: "nagad" as const,
    accountNumber: "01800000003",
    status: "completed" as const,
    createdDaysAgo: 24,
  },
] as const;

const withdrawals = withdrawalDefinitions.map((withdrawal, index) => {
  const creator = requiredItem(
    creators,
    withdrawal.creatorIndex,
    "withdrawal creator",
  );
  const createdAt = daysAgo(withdrawal.createdDaysAgo);

  return {
    _id: objectId(701 + index),
    creatorId: creator._id,
    creatorAuthUserId: creator.authUserId,
    creatorName: creator.displayName,
    creatorEmail: creator.email,
    requestedCredits: withdrawal.credits,
    amountInCents: withdrawal.credits * 5,
    creditsPerDollar: 20,
    paymentSystem: withdrawal.paymentSystem,
    accountNumber: withdrawal.accountNumber,
    accountNumberLast4: withdrawal.accountNumber.slice(-4),
    status: withdrawal.status,
    idempotencyKey: `${SEED_PREFIX}-withdrawal-${index + 1}`,
    ...(withdrawal.status !== "pending"
      ? {
          reviewedByAuthUserId: admin.authUserId,
          reviewedAt: daysAgo(withdrawal.createdDaysAgo - 1),
        }
      : {}),
    ...(withdrawal.status === "completed"
      ? {
          payoutReference: `${SEED_PREFIX}-payout-${index + 1}`,
          completedAt: daysAgo(withdrawal.createdDaysAgo - 2),
        }
      : {}),
    createdAt,
    updatedAt: daysAgo(Math.max(0, withdrawal.createdDaysAgo - 1)),
  };
});

const reportDefinitions = [
  {
    reporterIndex: 0,
    campaignIndex: 8,
    reason: "misleading_information" as const,
    details:
      "The listed bicycle distribution partner should be verified before additional funds are accepted.",
    status: "pending" as const,
    createdAt: daysAgo(1),
  },
  {
    reporterIndex: 3,
    campaignIndex: 3,
    reason: "other" as const,
    details:
      "The supporter requested clarification about the published water testing schedule.",
    status: "resolved" as const,
    createdAt: daysAgo(6),
  },
] as const;

const reports = reportDefinitions.map((report, index) => {
  const reporter = requiredItem(supporters, report.reporterIndex, "reporter");
  const campaign = requiredItem(
    campaigns,
    report.campaignIndex,
    "reported campaign",
  );
  const campaignDefinition = requiredItem(
    campaignDefinitions,
    report.campaignIndex,
    "reported campaign definition",
  );
  const creator = requiredItem(
    creators,
    campaignDefinition.creatorIndex,
    "reported campaign creator",
  );

  return {
    _id: objectId(801 + index),
    reporterId: reporter._id,
    reporterAuthUserId: reporter.authUserId,
    reporterName: reporter.displayName,
    reporterEmail: reporter.email,
    targetType: "campaign" as const,
    targetId: campaign._id,
    campaignTitle: campaign.title,
    creatorId: creator._id,
    creatorAuthUserId: creator.authUserId,
    creatorName: creator.displayName,
    creatorEmail: creator.email,
    ...(report.status === "pending"
      ? {
          activeDeduplicationKey: `${reporter._id}:campaign:${campaign._id}`,
        }
      : {}),
    reason: report.reason,
    details: report.details,
    status: report.status,
    ...(report.status === "resolved"
      ? {
          reviewedByAuthUserId: admin.authUserId,
          resolutionNote:
            "The creator supplied the requested schedule and the concern was resolved.",
          resolvedAt: daysAgo(3),
        }
      : {}),
    createdAt: report.createdAt,
    updatedAt: report.status === "resolved" ? daysAgo(3) : report.createdAt,
  };
});

const notificationDefinitions = [
  {
    recipient: requiredItem(creators, 0, "notification recipient"),
    type: "contribution_received" as const,
    title: "New contribution awaiting review",
    message:
      "A supporter contributed 45 credits to Solar Study Rooms for Riverside Schools.",
    entityType: "contribution" as const,
    entityId: requiredItem(
      pendingContributions,
      0,
      "pending contribution notification",
    )._id,
    actionPath: "/dashboard/creator/contributions",
    isRead: false,
  },
  {
    recipient: requiredItem(creators, 2, "notification recipient"),
    type: "contribution_received" as const,
    title: "New contribution awaiting review",
    message:
      "A supporter contributed 35 credits to Neighborhood Makers Lab for Young Inventors.",
    entityType: "contribution" as const,
    entityId: requiredItem(
      pendingContributions,
      1,
      "pending contribution notification",
    )._id,
    actionPath: "/dashboard/creator/contributions",
    isRead: false,
  },
  {
    recipient: requiredItem(creators, 3, "notification recipient"),
    type: "campaign_submitted" as const,
    title: "Campaign submitted",
    message:
      "Emergency Learning Kits After Monsoon Flooding is waiting for Admin review.",
    entityType: "campaign" as const,
    entityId: requiredItem(campaigns, 9, "pending campaign notification")._id,
    actionPath: "/dashboard/creator/campaigns",
    isRead: false,
  },
  {
    recipient: requiredItem(supporters, 0, "notification recipient"),
    type: "contribution_approved" as const,
    title: "Contribution approved",
    message:
      "Your contribution to Solar Study Rooms for Riverside Schools was approved.",
    entityType: "contribution" as const,
    entityId: requiredItem(
      approvedContributions,
      0,
      "approved contribution notification",
    )._id,
    actionPath: "/dashboard/supporter/contributions",
    isRead: false,
  },
  {
    recipient: requiredItem(supporters, 2, "notification recipient"),
    type: "payment_completed" as const,
    title: "Credit purchase completed",
    message: "800 FundFlow credits were added to your account.",
    entityType: "creditPayment" as const,
    entityId: requiredItem(payments, 2, "payment notification")._id,
    actionPath: "/dashboard/supporter/credits",
    isRead: true,
  },
  {
    recipient: requiredItem(creators, 1, "notification recipient"),
    type: "withdrawal_approved" as const,
    title: "Withdrawal approved",
    message: "Your withdrawal of 200 raised credits was approved.",
    entityType: "withdrawal" as const,
    entityId: requiredItem(withdrawals, 1, "withdrawal notification")._id,
    actionPath: "/dashboard/creator/withdrawals",
    isRead: true,
  },
  {
    recipient: admin,
    type: "campaign_reported" as const,
    title: "Campaign report submitted",
    message:
      "Repair Bicycles for Student Commuters was reported for misleading information.",
    entityType: "report" as const,
    entityId: requiredItem(reports, 0, "report notification")._id,
    actionPath: "/dashboard/admin/reports",
    isRead: false,
  },
  {
    recipient: admin,
    type: "campaign_submitted" as const,
    title: "Campaign awaiting review",
    message:
      "Cold Storage for Small Farm Cooperatives is ready for campaign review.",
    entityType: "campaign" as const,
    entityId: requiredItem(campaigns, 10, "campaign notification")._id,
    actionPath: "/dashboard/admin/campaigns",
    isRead: false,
  },
] as const;

const notifications = notificationDefinitions.map((notification, index) => {
  const createdAt = daysAgo(index % 5);

  return {
    _id: objectId(901 + index),
    recipientId: notification.recipient._id,
    recipientAuthUserId: notification.recipient.authUserId,
    toEmail: notification.recipient.email,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    relatedEntityType: notification.entityType,
    relatedEntityId: notification.entityId,
    actionPath: notification.actionPath,
    isRead: notification.isRead,
    ...(notification.isRead ? { readAt: createdAt } : {}),
    createdAt,
    updatedAt: createdAt,
  };
});

const replaceDocuments = async (
  collection: mongoose.mongo.Collection,
  documents: ReadonlyArray<{ _id: mongoose.Types.ObjectId }>,
  session: ClientSession,
): Promise<void> => {
  await collection.bulkWrite(
    documents.map((document) => ({
      replaceOne: {
        filter: { _id: document._id },
        replacement: document,
        upsert: true,
      },
    })),
    { session },
  );
};

const validateSeedDocuments = async (): Promise<void> => {
  await Promise.all([
    ...[...creators, ...supporters, admin].map((document) =>
      new UserProfileModel(document).validate(),
    ),
    ...campaigns.map((document) => new CampaignModel(document).validate()),
    ...contributions.map((document) =>
      new ContributionModel(document).validate(),
    ),
    ...payments.map((document) => new CreditPaymentModel(document).validate()),
    ...withdrawals.map((document) => new WithdrawalModel(document).validate()),
    ...reports.map((document) => new ReportModel(document).validate()),
    ...notifications.map((document) =>
      new NotificationModel(document).validate(),
    ),
  ]);
};

const seedDemoData = async (): Promise<void> => {
  if (!isConfirmed) {
    throw new Error(
      "Demo seed requires confirmation. Run: npm run seed:demo -- --confirm",
    );
  }

  await connectToDatabase();
  await validateSeedDocuments();

  await withMongoTransaction(async (session) => {
    await replaceDocuments(
      UserProfileModel.collection,
      [...creators, ...supporters, admin],
      session,
    );
    await replaceDocuments(CampaignModel.collection, campaigns, session);
    await replaceDocuments(
      ContributionModel.collection,
      contributions,
      session,
    );
    await replaceDocuments(CreditPaymentModel.collection, payments, session);
    await replaceDocuments(WithdrawalModel.collection, withdrawals, session);
    await replaceDocuments(ReportModel.collection, reports, session);
    await replaceDocuments(
      NotificationModel.collection,
      notifications,
      session,
    );
  });

  const [
    profileCount,
    activeCampaignCount,
    contributionCount,
    paymentCount,
    pendingWithdrawalCount,
    reportCount,
  ] = await Promise.all([
    UserProfileModel.countDocuments({
      authUserId: { $regex: `^${SEED_PREFIX}` },
    }),
    CampaignModel.countDocuments({
      _id: { $in: campaigns.map((campaign) => campaign._id) },
      status: "approved",
      deadline: { $gt: new Date() },
    }),
    ContributionModel.countDocuments({
      _id: { $in: contributions.map((contribution) => contribution._id) },
    }),
    CreditPaymentModel.countDocuments({
      _id: { $in: payments.map((payment) => payment._id) },
    }),
    WithdrawalModel.countDocuments({
      _id: { $in: withdrawals.map((withdrawal) => withdrawal._id) },
      status: "pending",
    }),
    ReportModel.countDocuments({
      _id: { $in: reports.map((report) => report._id) },
    }),
  ]);

  console.info("FundFlow demo data seeded", {
    profiles: profileCount,
    activeCampaigns: activeCampaignCount,
    contributions: contributionCount,
    completedPayments: paymentCount,
    pendingWithdrawals: pendingWithdrawalCount,
    reports: reportCount,
  });
};

try {
  await seedDemoData();
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Demo data seed failed",
  );
  process.exitCode = 1;
} finally {
  await disconnectFromDatabase();
}
