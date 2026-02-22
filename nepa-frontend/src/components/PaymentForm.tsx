import React, { useState, useEffect } from 'react';
import { PaymentFormData } from '../types';
import { 
  validateMeterNumber, 
  validateAmount, 
  formatMeterId, 
  sanitizeAmount,
  VALIDATION_RULES
} from '../utils/validation';

interface FormErrors {
  destination?: string;
  amount?: string;
}

interface Props {
  onSubmit: (data: PaymentFormData) => void;
  isLoading: boolean;
}

export const PaymentForm: React.FC<Props> = ({ onSubmit, isLoading }) => {
  const [form, setForm] = useState<PaymentFormData>({ destination: '', amount: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<{ destination: boolean; amount: boolean }>({
    destination: false,
    amount: false
  });

  // Validation functions using utilities
  const validateMeterId = (meterId: string): string | undefined => {
    return validateMeterNumber(meterId) || undefined;
  };

  const validateAmountField = (amount: string): string | undefined => {
    return validateAmount(amount) || undefined;
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {
      destination: validateMeterId(form.destination),
      amount: validateAmountField(form.amount)
    };
    
    setErrors(newErrors);
    return !newErrors.destination && !newErrors.amount;
  };

  // Real-time validation on field change
  useEffect(() => {
    if (touched.destination) {
      setErrors(prev => ({
        ...prev,
        destination: validateMeterId(form.destination)
      }));
    }
  }, [form.destination, touched.destination]);

  useEffect(() => {
    if (touched.amount) {
      setErrors(prev => ({
        ...prev,
        amount: validateAmountField(form.amount)
      }));
    }
  }, [form.amount, touched.amount]);

  const handleMeterIdChange = (value: string) => {
    const formattedValue = formatMeterId(value);
    setForm({ ...form, destination: formattedValue });
  };

  const handleAmountChange = (value: string) => {
    const sanitizedValue = sanitizeAmount(value);
    setForm({ ...form, amount: sanitizedValue });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mark all fields as touched
    setTouched({ destination: true, amount: true });
    
    if (validateForm()) {
      onSubmit({
        destination: form.destination.trim(),
        amount: form.amount
      });
    }
  };

  const handleBlur = (field: 'destination' | 'amount') => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const isFormValid = !errors.destination && !errors.amount && form.destination && form.amount;

  return (
    <div className="w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl mx-auto px-3 sm:px-4 lg:px-6">
      <form 
        onSubmit={handleSubmit}
        className="space-y-4 sm:space-y-6 bg-white shadow-lg rounded-xl p-4 sm:p-6 md:p-8 lg:p-10"
      >
        {/* Header */}
        <div className="text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            Make Payment
          </h2>
          <p className="text-sm sm:text-base text-gray-600">
            Enter your meter details and payment amount
          </p>
        </div>

        {/* Form Fields */}
        <div className="space-y-5">
          {/* Meter Number Field */}
          <div>
            <label 
              htmlFor="meter-number"
              className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2"
            >
              Meter Number <span className="text-red-500">*</span>
            </label>
            <input 
              id="meter-number"
              type="text"
              placeholder="METER-123"
              value={form.destination}
              onChange={e => handleMeterIdChange(e.target.value)}
              onBlur={() => handleBlur('destination')}
              className={`w-full px-3 sm:px-4 py-3 sm:py-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-base sm:text-lg placeholder-gray-400 min-h-[48px] sm:min-h-[52px] ${
                errors.destination && touched.destination 
                  ? 'border-red-500 focus:ring-red-500' 
                  : 'border-gray-300'
              }`}
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck="false"
              maxLength={20}
            />
            {errors.destination && touched.destination && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.destination}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">Format: METER-123 (minimum 3 digits)</p>
          </div>

          {/* Amount Field */}
          <div>
            <label 
              htmlFor="amount"
              className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2"
            >
              Amount (NGN) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-gray-500 text-lg sm:text-xl">
                ₦
              </span>
              <input 
                id="amount"
                type="text"
                placeholder="0.00"
                value={form.amount}
                onChange={e => handleAmountChange(e.target.value)}
                onBlur={() => handleBlur('amount')}
                className={`w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-3 sm:py-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-base sm:text-lg placeholder-gray-400 min-h-[48px] sm:min-h-[52px] ${
                  errors.amount && touched.amount 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-gray-300'
                }`}
                autoComplete="off"
              />
            </div>
            {errors.amount && touched.amount && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.amount}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">Min: ₦{VALIDATION_RULES.MIN_AMOUNT.toLocaleString()} | Max: ₦{VALIDATION_RULES.MAX_AMOUNT.toLocaleString()}</p>
          </div>

          {/* Quick Amount Buttons */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">Quick Amounts</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              {['1000', '2000', '5000', '10000', '15000', '20000'].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setForm({...form, amount})}
                  disabled={isLoading}
                  className="px-3 py-2 sm:px-4 sm:py-3 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:cursor-not-allowed text-gray-700 rounded-lg text-sm sm:text-base font-medium transition-colors duration-200 min-h-[44px] sm:min-h-[48px] touch-manipulation"
                >
                  ₦{amount}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button 
          type="submit" 
          disabled={isLoading || !isFormValid}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 sm:py-4 px-4 sm:px-6 rounded-lg transition-all duration-200 text-base sm:text-lg min-h-[48px] sm:min-h-[52px] touch-manipulation transform active:scale-95"
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <svg 
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24"
              >
                <circle 
                  className="opacity-25" 
                  cx="12" 
                  cy="12" 
                  r="10" 
                  stroke="currentColor" 
                  strokeWidth="4"
                />
                <path 
                  className="opacity-75" 
                  fill="currentColor" 
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Processing...
            </span>
          ) : (
            'Pay Now'
          )}
        </button>

        {/* Security Notice */}
        <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start space-x-2">
            <svg 
              className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 mt-0.5 flex-shrink-0" 
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path 
                fillRule="evenodd" 
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" 
                clipRule="evenodd" 
              />
            </svg>
            <div className="text-xs sm:text-sm text-blue-800">
              <p className="font-medium mb-1">Secure Payment</p>
              <p>Your payment information is encrypted and secure. We never store your card details.</p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
