const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;

export const isSafeInternalPath = (value: string): boolean =>
  value.startsWith("/") &&
  !value.startsWith("//") &&
  !value.includes("\\") &&
  !CONTROL_CHARACTER_PATTERN.test(value);
