import { CampaignModel } from "../models/campaign.model.js";
import { ContributionModel } from "../models/contribution.model.js";
import { UserProfileModel } from "../models/user-profile.model.js";

interface TopCampaign {
  id: string;
  title: string;
  category: string;
  imageURL: string;
  amountRaised: number;
  fundingGoal: number;
  deadline: Date;
}

interface PlatformStatistics {
  totalRaisedCredits: number;
  approvedCampaigns: number;
  activeCreators: number;
  contributingSupporters: number;
}

export const getTopFundedCampaigns = async (): Promise<TopCampaign[]> => {
  const campaigns = await CampaignModel.find({ status: "approved" })
    .select("title category imageURL amountRaised fundingGoal deadline")
    .sort({ amountRaised: -1, createdAt: -1 })
    .limit(6)
    .lean()
    .exec();

  return campaigns.map((campaign) => ({
    id: campaign._id.toString(),
    title: campaign.title,
    category: campaign.category,
    imageURL: campaign.imageURL,
    amountRaised: campaign.amountRaised,
    fundingGoal: campaign.fundingGoal,
    deadline: campaign.deadline,
  }));
};

export const getPlatformStatistics =
  async (): Promise<PlatformStatistics> => {
    const [campaignTotals, activeCreators, contributingSupporters] =
      await Promise.all([
        CampaignModel.aggregate<{
          approvedCampaigns: number;
          totalRaisedCredits: number;
        }>([
          { $match: { status: "approved" } },
          {
            $group: {
              _id: null,
              approvedCampaigns: { $sum: 1 },
              totalRaisedCredits: { $sum: "$amountRaised" },
            },
          },
        ]).exec(),
        UserProfileModel.countDocuments({
          role: "creator",
          isSuspended: false,
        }).exec(),
        ContributionModel.distinct("supporterId", {
          status: "approved",
        }).exec(),
      ]);

    return {
      totalRaisedCredits: campaignTotals[0]?.totalRaisedCredits ?? 0,
      approvedCampaigns: campaignTotals[0]?.approvedCampaigns ?? 0,
      activeCreators,
      contributingSupporters: contributingSupporters.length,
    };
  };
