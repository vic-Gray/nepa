import React, { useState, useEffect } from 'react';
import { validateMeterNumber, validateAmount } from '../utils/validation';
import { FieldInfo } from './FieldInfo';

export const PaymentForm = ({ onSubmit, isLoading }: any) => {
  const [formData, setFormData] = useState({ meterNumber: '', amount: '' });
  const [errors, setErrors] = useState({ meter: null as string | null, amount: null as string | null });

  useEffect(() => {
    setErrors({ meter: validateMeterNumber(formData.meterNumber), amount: validateAmount(formData.amount) });
  }, [formData]);

  const isValid = formData.meterNumber && formData.amount && !errors.meter && !errors.amount;

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }} className="space-y-4">
      <div>
        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Meter ID</label>
        <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={formData.meterNumber} onChange={e => setFormData({...formData, meterNumber: e.target.value.toUpperCase()})} placeholder="12345678901" />
        <FieldInfo error={errors.meter} hint="11-13 chars" />
      </div>
      <div>
        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Amount (XLM)</label>
        <input type="number" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="0.00" />
        <FieldInfo error={errors.amount} hint="Max 10,000 XLM" />
      </div>
      <button type="submit" disabled={!isValid || isLoading} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold disabled:bg-slate-200">
        {isLoading ? 'Processing...' : 'Pay Now'}
      </button>
    </form>
  );
};
