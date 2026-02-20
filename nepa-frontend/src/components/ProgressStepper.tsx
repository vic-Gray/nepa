import React from 'react';
import { TransactionStep } from '../types';
export const ProgressStepper = ({ currentStep }: { currentStep: TransactionStep }) => {
  const steps = ['Connect', 'Sign', 'Submit', 'Finalize'];
  if (currentStep === 0 || currentStep === 5) return null;
  return (
    <div className="flex justify-between relative px-2 w-full">
      {steps.map((s, i) => (
        <div key={s} className="z-10 flex flex-col items-center">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${currentStep > i ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
            {currentStep > i + 1 ? '✓' : i + 1}
          </div>
        </div>
      ))}
      <div className="absolute top-3 left-0 w-full h-0.5 bg-slate-100 -z-0">
        <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${Math.max(0, (currentStep - 1) / 3) * 100}%` }} />
      </div>
    </div>
  );
};
