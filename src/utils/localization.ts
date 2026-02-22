import { format } from 'date-fns';
import { enUS, fr, arSA } from 'date-fns/locale';

const localeMap = {
  en: enUS,
  fr: fr,
  ar: arSA,
};

export const formatDate = (date: Date, language: string, formatStr: string = 'PPP') => {
  const locale = localeMap[language as keyof typeof localeMap] || enUS;
  return format(date, formatStr, { locale });
};

export const formatCurrency = (amount: number, language: string, currency: string = 'USD') => {
  try {
    return new Intl.NumberFormat(language, {
      style: 'currency',
      currency: currency,
    }).format(amount);
  } catch (error) {
    // Fallback for unsupported currencies
    return `${currency} ${amount.toFixed(2)}`;
  }
};

export const formatNumber = (number: number, language: string) => {
  return new Intl.NumberFormat(language).format(number);
};

export const isRTL = (language: string) => {
  return language === 'ar';
};
