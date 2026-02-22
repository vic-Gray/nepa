// Validation utilities for the NEPA payment form

export const VALIDATION_RULES = {
  METER_ID_PATTERN: /^METER-\d{3,}$/,
  MIN_AMOUNT: 100, // Minimum amount in NGN
  MAX_AMOUNT: 1000000, // Maximum amount in NGN
  MAX_METER_ID_LENGTH: 20
} as const;

export const VALIDATION_MESSAGES = {
  METER_ID_REQUIRED: 'Meter number is required',
  METER_ID_FORMAT: 'Meter number must follow the format: METER-123 (minimum 3 digits)',
  AMOUNT_REQUIRED: 'Amount is required',
  AMOUNT_INVALID: 'Please enter a valid amount',
  AMOUNT_ZERO: 'Amount must be greater than 0',
  AMOUNT_MIN: (min: number) => `Minimum amount is ₦${min.toLocaleString()}`,
  AMOUNT_MAX: (max: number) => `Maximum amount is ₦${max.toLocaleString()}`
} as const;

export const validateMeterNumber = (meter: string): string | null => {
  if (!meter.trim()) {
    return VALIDATION_MESSAGES.METER_ID_REQUIRED;
  }
  if (!VALIDATION_RULES.METER_ID_PATTERN.test(meter.trim())) {
    return VALIDATION_MESSAGES.METER_ID_FORMAT;
  }
  return null;
};

export const validateAmount = (amount: string): string | null => {
  if (!amount.trim()) {
    return VALIDATION_MESSAGES.AMOUNT_REQUIRED;
  }
  
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount)) {
    return VALIDATION_MESSAGES.AMOUNT_INVALID;
  }
  
  if (numAmount <= 0) {
    return VALIDATION_MESSAGES.AMOUNT_ZERO;
  }
  
  if (numAmount < VALIDATION_RULES.MIN_AMOUNT) {
    return VALIDATION_MESSAGES.AMOUNT_MIN(VALIDATION_RULES.MIN_AMOUNT);
  }
  
  if (numAmount > VALIDATION_RULES.MAX_AMOUNT) {
    return VALIDATION_MESSAGES.AMOUNT_MAX(VALIDATION_RULES.MAX_AMOUNT);
  }
  
  // Limit to 2 decimal places for NGN
  const decimals = amount.split('.')[1];
  if (decimals && decimals.length > 2) {
    return 'Maximum 2 decimal places allowed';
  }
  
  return null;
};

export const formatMeterId = (value: string): string => {
  let formattedValue = value.toUpperCase().trim();
  if (formattedValue && !formattedValue.startsWith('METER-')) {
    formattedValue = `METER-${formattedValue}`;
  }
  return formattedValue;
};

export const sanitizeAmount = (value: string): string => {
  // Only allow valid decimal numbers
  let validValue = value.replace(/[^0-9.]/g, '');
  
  // Prevent multiple decimal points
  const parts = validValue.split('.');
  if (parts.length > 2) {
    return parts[0] + '.' + parts.slice(1).join('');
  }
  
  // Limit to 2 decimal places
  if (parts[1] && parts[1].length > 2) {
    validValue = parts[0] + '.' + parts[1].substring(0, 2);
  }
  
  return validValue;
};
