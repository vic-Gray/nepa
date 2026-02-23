import React from 'react';

const FAQPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-8">
            <h1 className="text-3xl font-bold text-gray-900">Frequently Asked Questions</h1>
            <p className="text-gray-600 mt-2">
              Find answers to common questions about the NEPA payment system
            </p>
          </div>
        </div>
      </div>

      {/* FAQ Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          
          {/* FAQ Item 1 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              How does the NEPA payment system work?
            </h3>
            <p className="text-gray-700 leading-relaxed">
              The NEPA payment system is a decentralized platform that allows you to pay your utility bills securely using blockchain technology. 
              Simply connect your wallet, enter your meter number and payment amount, and confirm the transaction. 
              Your payment is processed instantly and recorded on the blockchain for transparency.
            </p>
          </div>

          {/* FAQ Item 2 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              What are the fees for using this service?
            </h3>
            <p className="text-gray-700 leading-relaxed">
              We charge a minimal transaction fee of 0.5% on all payments to cover network costs and maintain the platform. 
              There are no hidden charges or subscription fees. The exact fee amount is displayed before you confirm any transaction.
            </p>
          </div>

          {/* FAQ Item 3 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              What payment methods are supported?
            </h3>
            <p className="text-gray-700 leading-relaxed">
              We support various cryptocurrency wallets including Stellar, Freighter, and WalletConnect. 
              You can also make payments using traditional bank transfers through our partner payment processors. 
              All payment methods are secured with industry-standard encryption.
            </p>
          </div>

          {/* FAQ Item 4 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              How can I view my payment history?
            </h3>
            <p className="text-gray-700 leading-relaxed">
              Your complete payment history is available in the dashboard. You can view all past transactions, 
              download PDF receipts, search by date or amount, and export your data to CSV for record-keeping. 
              Transaction data is stored securely and is always accessible.
            </p>
          </div>

        </div>

        {/* Navigation Links */}
        <div className="mt-12 text-center">
          <div className="space-y-4">
            <p className="text-gray-600">
              Still have questions? Contact our support team for assistance.
            </p>
            <div className="flex justify-center space-x-4">
              <a
                href="/dashboard"
                className="bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Go to Dashboard
              </a>
              <a
                href="/payment"
                className="bg-green-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
              >
                Make a Payment
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FAQPage;
