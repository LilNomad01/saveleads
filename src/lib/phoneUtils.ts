// Utility functions for phone number validation and type detection

export type PhoneType = 'mobile' | 'landline' | 'unknown';

/**
 * Detects if a Brazilian phone number is mobile or landline
 * Brazilian mobile numbers: 
 * - Start with 9 after DDD (area code)
 * - Have 9 digits (excluding DDD)
 * - Full format: +55 (DDD) 9XXXX-XXXX
 * 
 * Brazilian landline numbers:
 * - Start with 2, 3, 4, or 5 after DDD
 * - Have 8 digits (excluding DDD)
 * - Full format: +55 (DDD) XXXX-XXXX
 */
export function detectPhoneType(phoneNumber: string | null | undefined): PhoneType {
  if (!phoneNumber) return 'unknown';
  
  // Remove all non-digit characters
  const digits = phoneNumber.replace(/\D/g, '');
  
  // Brazilian phone format: 55 + DDD (2 digits) + number (8-9 digits)
  // Total: 12-13 digits
  if (digits.length < 10) return 'unknown';
  
  let localNumber: string;
  
  // Remove country code if present (55 for Brazil)
  if (digits.startsWith('55') && digits.length >= 12) {
    // Skip country code (55) and DDD (2 digits)
    localNumber = digits.slice(4);
  } else if (digits.length >= 10) {
    // Skip DDD (2 digits)
    localNumber = digits.slice(2);
  } else {
    localNumber = digits;
  }
  
  // Mobile numbers in Brazil start with 9 and have 9 digits
  if (localNumber.length === 9 && localNumber.startsWith('9')) {
    return 'mobile';
  }
  
  // Landline numbers start with 2, 3, 4, or 5 and have 8 digits
  if (localNumber.length === 8 && /^[2-5]/.test(localNumber)) {
    return 'landline';
  }
  
  // For other countries or ambiguous cases
  // Mobile typically has more digits
  if (localNumber.length >= 9) {
    return 'mobile';
  }
  
  return 'landline';
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
    default:
      return 'Desconhecido';
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
 * Check if phone is WhatsApp compatible (mobile)
 */
export function isWhatsAppCompatible(phoneNumber: string | null | undefined): boolean {
  return detectPhoneType(phoneNumber) === 'mobile';
}
