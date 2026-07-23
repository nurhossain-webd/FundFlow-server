import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  campaignIdParamsSchema,
  campaignListQuerySchema,
  createCampaignSchema,
  updateCampaignSchema,
} from "../../src/schemas/campaign.schema.js";

const validCampaign = {
  title: "Solar-powered community learning room",
  story:
    "Local educators need dependable lighting and practical science tools. This campaign equips three classrooms with safe solar learning kits and teacher training.",
  category: "Education",
  fundingGoal: 12_000,
  minimumContribution: 10,
  deadline: new Date(Date.now() + 86_400_000).toISOString(),
  rewardInfo: "Supporters receive progress updates from each classroom.",
  imageURL: "https://i.ibb.co/example/solar-classroom.jpg",
};

describe("campaign validation", () => {
  it("accepts a valid creator campaign and coerces its deadline", () => {
    const result = createCampaignSchema.parse(validCampaign);

    assert.ok(result.deadline instanceof Date);
    assert.equal(result.fundingGoal, 12_000);
  });

  it("rejects client-controlled campaign status and raised amount", () => {
    const result = createCampaignSchema.safeParse({
      ...validCampaign,
      status: "approved",
      amountRaised: 500_000,
    });

    assert.equal(result.success, false);
  });

  it("allows creators to update only title, story, and reward information", () => {
    assert.equal(
      updateCampaignSchema.safeParse({
        title: "Updated community learning room",
      }).success,
      true,
    );
    assert.equal(
      updateCampaignSchema.safeParse({ fundingGoal: 1 }).success,
      false,
    );
  });

  it("rejects malformed campaign identifiers", () => {
    assert.equal(
      campaignIdParamsSchema.safeParse({ campaignId: "not-an-object-id" })
        .success,
      false,
    );
  });

  it("coerces and bounds pagination query values", () => {
    const query = campaignListQuerySchema.parse({
      page: "2",
      limit: "24",
      sortBy: "amountRaised",
      sortOrder: "desc",
    });

    assert.equal(query.page, 2);
    assert.equal(query.limit, 24);
    assert.equal(query.sortBy, "amountRaised");
  });
});
