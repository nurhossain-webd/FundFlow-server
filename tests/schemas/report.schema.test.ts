import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  campaignReportParamsSchema,
  createCampaignReportSchema,
} from "../../src/schemas/report.schema.js";

describe("campaign report validation", () => {
  it("accepts a valid reason with meaningful details", () => {
    assert.equal(
      createCampaignReportSchema.safeParse({
        reason: "misleading_information",
        details:
          "The funding description conflicts with the campaign updates.",
      }).success,
      true,
    );
  });

  it("rejects client-controlled reporter identity and status", () => {
    assert.equal(
      createCampaignReportSchema.safeParse({
        reason: "fraud",
        details: "The campaign appears to be impersonating another project.",
        reporterEmail: "attacker@example.com",
        status: "resolved",
      }).success,
      false,
    );
  });

  it("rejects invalid reasons, short details, and malformed campaign IDs", () => {
    assert.equal(
      createCampaignReportSchema.safeParse({
        reason: "dislike",
        details: "Not valid",
      }).success,
      false,
    );
    assert.equal(
      campaignReportParamsSchema.safeParse({ campaignId: "invalid" }).success,
      false,
    );
  });
});
