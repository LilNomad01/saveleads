// Utility functions for phone number validation and type detection

export type PhoneType = 'mobile' | 'landline' | 'voip' | 'unknown';

/**
 * Conservative local heuristic.
 *
 * IMPORTANT: number length alone cannot identify US mobile vs landline.
 * For US/international leads, use the persisted Twilio Lookup result instead.
 * This helper only classifies Brazilian numbers when +55 is present.
 */
export function detectPhoneType(phoneNumber: string | null | undefined): PhoneType {
  if (!phoneNumber) return 'unknown';

  const digits = phoneNumber.replace(/\D/g, '');

  // Only infer Brazilian line type when the country code is explicit.
  if (!digits.startsWith('55') || (digits.length !== 12 && digits.length !== 13)) {
    return 'unknown';
  }

  const localNumber = digits.slice(4);

  if (localNumber.length === 9 && localNumber.startsWith('9')) {
    return 'mobile';
  }

  if (localNumber.length === 8 && /^[2-5]/.test(localNumber)) {
    return 'landline';
  }

  return 'unknown';
}

export function phoneTypeFromLookup(
  lineType: string | null | undefined,
  lookupStatus: string | null | undefined,
  valid: boolean | null | undefined,
): PhoneType {
  if (lookupStatus !== 'verified' || valid === false) return 'unknown';

  if (lineType === 'mobile') return 'mobile';
  if (lineType === 'landline') return 'landline';
  if (lineType === 'fixedVoip' || lineType === 'nonFixedVoip') return 'voip';

  return 'unknown';
}

export function isVerifiedMobile(
  lineType: string | null | undefined,
  lookupStatus: string | null | undefined,
  valid: boolean | null | undefined,
): boolean {
  return lookupStatus === 'verified' && valid === true && lineType === 'mobile';
}

/**
 * Get phone type label in Portuguese
 */
export function getPhoneTypeLabel(type: PhoneType): string {
  switch (type) {
    case 'mobile':
      return 'Móvel';
    case 'landline':
      return 'Fixo';
    case 'voip':
      return 'VoIP';
    default:
      return 'Não verificado';
  }
}

/**
 * Format phone number for WhatsApp link
 */
export function formatWhatsAppLink(phoneNumber: string | null | undefined): string | null {
  if (!phoneNumber) return null;

  const digits = phoneNumber.replace(/\D/g, '');
  if (digits.length < 10) return null;

  return `https://wa.me/${digits}`;
}

/**
 * Local WhatsApp compatibility fallback.
 * For US/international leads, prefer isVerifiedMobile() with Twilio Lookup data.
 */
export function isWhatsAppCompatible(phoneNumber: string | null | undefined): boolean {
  return detectPhoneType(phoneNumber) === 'mobile';
}
