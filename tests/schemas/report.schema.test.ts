import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  adminReportListQuerySchema,
  campaignReportParamsSchema,
  createCampaignReportSchema,
  reportIdParamsSchema,
  resolveReportSchema,
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

  it("validates Admin report filtering, resolution, and report IDs", () => {
    assert.deepEqual(
      adminReportListQuerySchema.parse({
        page: "2",
        limit: "50",
        status: "pending",
      }),
      { page: 2, limit: 50, status: "pending" },
    );
    assert.equal(
      resolveReportSchema.safeParse({
        resolutionNote: "Reviewed and no policy violation was confirmed.",
      }).success,
      true,
    );
    assert.equal(resolveReportSchema.safeParse({}).success, true);
    assert.equal(
      reportIdParamsSchema.safeParse({
        reportId: "507f1f77bcf86cd799439011",
      }).success,
      true,
    );
    assert.equal(
      adminReportListQuerySchema.safeParse({ status: "deleted" }).success,
      false,
    );
  });
});
