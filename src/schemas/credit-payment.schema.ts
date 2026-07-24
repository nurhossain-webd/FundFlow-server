import { z } from "zod";

import { CREDIT_PACKAGES } from "../config/credit-packages.js";

const creditPackageIds = Object.keys(CREDIT_PACKAGES) as [
  keyof typeof CREDIT_PACKAGES,
  ...(keyof typeof CREDIT_PACKAGES)[],
];

export const createCheckoutSessionSchema = z
  .object({
    packageId: z.enum(creditPackageIds),
  })
  .strict();
