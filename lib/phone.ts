/**
 * Phone number normalization utilities
 * Normalizes Indian phone numbers to digits only (no +91, spaces, leading zeros)
 */

export function normalizePhone(phone: string): string {
  // Remove all non-digits
  let normalized = phone.replace(/\D/g, '');

  // Remove leading +91 or 91
  if (normalized.startsWith('91') && normalized.length > 10) {
    normalized = normalized.slice(2);
  }
  if (normalized.startsWith('+91')) {
    normalized = normalized.slice(3);
  }

  // Remove leading zeros
  normalized = normalized.replace(/^0+/, '');

  // Should be 10 digits for Indian mobile
  return normalized;
}

export function isValidIndianPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  // Indian mobile numbers: 10 digits, starting with 6-9
  return /^[6-9]\d{9}$/.test(normalized);
}

export function maskPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  if (normalized.length < 4) return '****';
  return '****' + normalized.slice(-4);
}

// Dummy numbers that should be rejected for redeem/rewards but silently skipped for earn
export const DUMMY_PHONES = new Set([
  '0000000000',
  '9999999999',
  '1234567890',
  '1111111111',
  '2222222222',
  '3333333333',
  '4444444444',
  '5555555555',
  '6666666666',
  '7777777777',
  '8888888888',
  '9999999999',
]);

export function isDummyPhone(phone: string): boolean {
  return DUMMY_PHONES.has(normalizePhone(phone));
}