import React, { useState } from 'react';
import { PaymentForm } from '../components/PaymentForm';
import { PaymentFormData } from '../types';

/**
 * Validation Demo Component
 * 
 * This component demonstrates the enhanced PaymentForm with comprehensive validation.
 * It shows real-time validation, error messages, and proper input formatting.
 */
export const ValidationDemo: React.FC = () => {
  const [submissionHistory, setSubmissionHistory] = useState<PaymentFormData[]>([]);

  const handlePaymentSubmit = (data: PaymentFormData) => {
    console.log('Valid payment data submitted:', data);
    setSubmissionHistory(prev => [...prev, data]);
    
    // Show success message
    alert(`Payment submitted successfully!\nMeter: ${data.destination}\nAmount: ₦${data.amount}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            NEPA Payment Form Validation Demo
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            This demo showcases the enhanced payment form with comprehensive validation including:
            real-time error feedback, input formatting, and proper validation rules.
          </p>
        </div>

        {/* Validation Features */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Validation Features</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-medium text-gray-700">Meter ID Validation:</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Required field</li>
                <li>• Format: METER-123 (minimum 3 digits)</li>
                <li>• Auto-formatting with METER- prefix</li>
                <li>• Real-time validation feedback</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-gray-700">Amount Validation:</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Required field</li>
                <li>• Minimum: ₦100</li>
                <li>• Maximum: ₦1,000,000</li>
                <li>• Decimal input sanitization</li>
                <li>• Maximum 2 decimal places</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Payment Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Test the Payment Form</h2>
          <PaymentForm onSubmit={handlePaymentSubmit} isLoading={false} />
        </div>

        {/* Test Cases */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Test Cases to Try:</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-700 mb-2">Invalid Inputs (Should Show Errors):</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Empty meter ID</li>
                <li>• Meter ID: "123" (missing METER- prefix)</li>
                <li>• Meter ID: "METER-12" (less than 3 digits)</li>
                <li>• Empty amount</li>
                <li>• Amount: "0" or negative numbers</li>
                <li>• Amount: "50" (below minimum)</li>
                <li>• Amount: "2000000" (above maximum)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-700 mb-2">Valid Inputs (Should Submit):</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Meter ID: "METER-123"</li>
                <li>• Meter ID: "METER-999999"</li>
                <li>• Amount: "1000"</li>
                <li>• Amount: "1500.50"</li>
                <li>• Amount: "1000000"</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Submission History */}
        {submissionHistory.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Submission History</h2>
            <div className="space-y-2">
              {submissionHistory.map((submission, index) => (
                <div key={index} className="border-l-4 border-green-500 pl-4 py-2">
                  <div className="text-sm">
                    <span className="font-medium">Meter:</span> {submission.destination} | 
                    <span className="font-medium ml-2">Amount:</span> ₦{submission.amount}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
