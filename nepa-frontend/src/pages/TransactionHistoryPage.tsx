import React from 'react';
import { TransactionHistoryComponent } from '../components/TransactionHistory';

/**
 * Transaction History Page
 * 
 * This page demonstrates the comprehensive transaction history feature
 * with filtering, search, receipt generation, and export capabilities.
 */
export const TransactionHistoryPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Payment History</h1>
              <p className="text-gray-600 mt-1">
                View and manage all your utility payments
              </p>
            </div>
            
            {/* Navigation */}
            <nav className="flex space-x-4">
              <a
                href="/dashboard"
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Dashboard
              </a>
              <a
                href="/payment"
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Make Payment
              </a>
              <a
                href="/history"
                className="bg-blue-600 text-white px-3 py-2 rounded-md text-sm font-medium"
              >
                History
              </a>
            </nav>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Feature Highlights */}
        <div className="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-4">
            🎉 New Transaction History Features
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-start space-x-3">
              <span className="text-2xl">🔍</span>
              <div>
                <h3 className="font-medium text-blue-900">Advanced Search</h3>
                <p className="text-sm text-blue-700">Search by ID, amount, or meter</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <span className="text-2xl">📅</span>
              <div>
                <h3 className="font-medium text-blue-900">Date Filtering</h3>
                <p className="text-sm text-blue-700">Filter by date ranges</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <span className="text-2xl">📄</span>
              <div>
                <h3 className="font-medium text-blue-900">PDF Receipts</h3>
                <p className="text-sm text-blue-700">Download detailed receipts</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <span className="text-2xl">📊</span>
              <div>
                <h3 className="font-medium text-blue-900">Export to CSV</h3>
                <p className="text-sm text-blue-700">Export your payment data</p>
              </div>
            </div>
          </div>
        </div>

        {/* Transaction History Component */}
        <TransactionHistoryComponent />
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="md:flex md:justify-between">
            <div className="mb-4 md:mb-0">
              <h3 className="text-lg font-medium text-gray-900">NEPA Payment System</h3>
              <p className="text-gray-600">Secure utility payment management</p>
            </div>
            
            <div className="flex space-x-6">
              <a href="#" className="text-gray-600 hover:text-gray-900">
                Privacy Policy
              </a>
              <a href="#" className="text-gray-600 hover:text-gray-900">
                Terms of Service
              </a>
              <a href="#" className="text-gray-600 hover:text-gray-900">
                Support
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
