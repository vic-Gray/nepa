import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PaymentFormData } from '../types';

interface Props {
  onSubmit: (data: PaymentFormData) => void;
  isLoading: boolean;
}

export const PaymentForm: React.FC<Props> = ({ onSubmit, isLoading }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState<PaymentFormData>({ destination: '', amount: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="payment-form">
      <input 
        placeholder={t('payment.destination_placeholder')}
        value={form.destination}
        onChange={e => setForm({...form, destination: e.target.value})}
        required
      />
      <input 
        type="number" 
        placeholder={t('payment.amount_placeholder')}
        value={form.amount}
        onChange={e => setForm({...form, amount: e.target.value})}
        required
      />
      <button type="submit" disabled={isLoading}>
        {isLoading ? t('payment.processing') : t('payment.pay_button')}
      </button>
    </form>
  );
};
