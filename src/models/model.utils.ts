export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const HTTP_URL_PATTERN = /^https?:\/\/[^\s]+$/i;

export const isNonNegativeSafeInteger = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 0;

export const isPositiveSafeInteger = (value: number): boolean =>
  Number.isSafeInteger(value) && value > 0;
