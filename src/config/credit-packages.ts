export const CREDIT_PACKAGES = {
  credits_100: {
    id: "credits_100",
    credits: 100,
    amountInCents: 1_000,
    currency: "usd",
  },
  credits_300: {
    id: "credits_300",
    credits: 300,
    amountInCents: 2_500,
    currency: "usd",
  },
  credits_800: {
    id: "credits_800",
    credits: 800,
    amountInCents: 6_000,
    currency: "usd",
  },
  credits_1500: {
    id: "credits_1500",
    credits: 1_500,
    amountInCents: 11_000,
    currency: "usd",
  },
} as const;

export type CreditPackageId = keyof typeof CREDIT_PACKAGES;

export const getPublicCreditPackages = () =>
  Object.values(CREDIT_PACKAGES).map((creditPackage) => ({
    id: creditPackage.id,
    credits: creditPackage.credits,
    amountInCents: creditPackage.amountInCents,
    currency: creditPackage.currency,
  }));
