import React, { useState, useEffect } from 'react';
import {
  FraudRiskLevel,
  FraudDetectionStatus,
  FraudType,
  FraudCase,
  FraudAlert
} from '../fraud/types';

interface FraudDetectionDashboardProps {
  onCaseSelect?: (fraudCase: FraudCase) => void;
  onAlertSelect?: (alert: FraudAlert) => void;
}

export const FraudDetectionDashboard: React.FC<FraudDetectionDashboardProps> = ({
  onCaseSelect,
  onAlertSelect
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'cases' | 'alerts' | 'analytics'>('overview');
  const [fraudCases, setFraudCases] = useState<FraudCase[]>([]);
  const [fraudAlerts, setFraudAlerts] = useState<FraudAlert[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    riskLevel: '',
    dateRange: '24h'
  });

  useEffect(() => {
    loadDashboardData();
  }, [activeTab, filters]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'overview':
          await loadOverviewStats();
          break;
        case 'cases':
          await loadFraudCases();
          break;
        case 'alerts':
          await loadFraudAlerts();
          break;
        case 'analytics':
          await loadAnalytics();
          break;
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOverviewStats = async () => {
    // Mock API call - would be actual API
    const response = await fetch('/api/fraud/stats');
    const data = await response.json();
    setStats(data.data);
  };

  const loadFraudCases = async () => {
    // Mock API call
    const response = await fetch(`/api/fraud/cases?${new URLSearchParams(filters)}`);
    const data = await response.json();
    setFraudCases(data.data.cases);
  };

  const loadFraudAlerts = async () => {
    // Mock API call
    const response = await fetch('/api/fraud/alerts');
    const data = await response.json();
    setFraudAlerts(data.data.alerts);
  };

  const loadAnalytics = async () => {
    // Mock API call
    const response = await fetch('/api/fraud/analytics');
    const data = await response.json();
    setStats(data.data);
  };

  const getRiskLevelColor = (level: FraudRiskLevel): string => {
    switch (level) {
      case FraudRiskLevel.CRITICAL: return 'text-red-600 bg-red-100';
      case FraudRiskLevel.HIGH: return 'text-orange-600 bg-orange-100';
      case FraudRiskLevel.MEDIUM: return 'text-yellow-600 bg-yellow-100';
      case FraudRiskLevel.LOW: return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusColor = (status: FraudDetectionStatus): string => {
    switch (status) {
      case FraudDetectionStatus.CONFIRMED_FRAUD: return 'text-red-600 bg-red-100';
      case FraudDetectionStatus.REVIEW_REQUIRED: return 'text-orange-600 bg-orange-100';
      case FraudDetectionStatus.APPROVED: return 'text-green-600 bg-green-100';
      case FraudDetectionStatus.REJECTED: return 'text-gray-600 bg-gray-100';
      default: return 'text-blue-600 bg-blue-100';
    }
  };

  const formatFraudType = (type: FraudType): string => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleCaseClick = (fraudCase: FraudCase) => {
    if (onCaseSelect) {
      onCaseSelect(fraudCase);
    }
  };

  const handleAlertClick = (alert: FraudAlert) => {
    if (onAlertSelect) {
      onAlertSelect(alert);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Fraud Detection Dashboard</h1>
        <p className="text-gray-600">Monitor and manage fraudulent transaction detection</p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'cases', label: 'Fraud Cases' },
              { id: 'alerts', label: 'Alerts' },
              { id: 'analytics', label: 'Analytics' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Filters */}
      {activeTab === 'cases' && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="">All Status</option>
                <option value="review_required">Review Required</option>
                <option value="confirmed_fraud">Confirmed Fraud</option>
                <option value="false_positive">False Positive</option>
                <option value="approved">Approved</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Risk Level</label>
              <select
                value={filters.riskLevel}
                onChange={(e) => handleFilterChange('riskLevel', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="">All Levels</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Time Range</label>
              <select
                value={filters.dateRange}
                onChange={(e) => handleFilterChange('dateRange', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="1h">Last Hour</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Overview Tab */}
      {activeTab === 'overview' && stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V9a2 2 0 012-2h2a2 2 0 012 2v10" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Transactions</dt>
                  <dd className="text-lg font-medium text-gray-900">{stats.totalTransactions?.toLocaleString()}</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-red-500 rounded-md p-3">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 2.502-3.118V6.618c0-1.452-1.042-2.503-2.502-2.503H6.48c-1.46 0-2.502 1.051-2.502 2.503v7.264c0 1.452 1.042 2.503 2.502 2.503z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Fraudulent Transactions</dt>
                  <dd className="text-lg font-medium text-gray-900">{stats.fraudTransactions?.toLocaleString()}</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-yellow-500 rounded-md p-3">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Manual Reviews</dt>
                  <dd className="text-lg font-medium text-gray-900">{stats.manualReviews?.toLocaleString()}</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Fraud Rate</dt>
                  <dd className="text-lg font-medium text-gray-900">{stats.fraudRate?.toFixed(2)}%</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fraud Cases Tab */}
      {activeTab === 'cases' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Case ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk Score</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk Level</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {fraudCases.map((fraudCase) => (
                  <tr key={fraudCase.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {fraudCase.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {fraudCase.riskScore?.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRiskLevelColor(fraudCase.riskLevel)}`}>
                        {fraudCase.riskLevel?.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(fraudCase.status)}`}>
                        {fraudCase.status?.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(fraudCase.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleCaseClick(fraudCase)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          {fraudAlerts.map((alert) => (
            <div key={alert.id} className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">{alert.alertType?.replace(/_/g, ' ').toUpperCase()}</h3>
                  <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                  <div className="mt-2 flex items-center space-x-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRiskLevelColor(alert.severity)}`}>
                      {alert.severity?.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(alert.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  {!alert.isAcknowledged && (
                    <button
                      onClick={() => handleAlertClick(alert)}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                    >
                      Acknowledge
                    </button>
                  )}
                  <button
                    onClick={() => handleAlertClick(alert)}
                    className="px-3 py-1 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700"
                  >
                    Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && stats && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Risk Distribution</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(stats.riskDistribution || {}).map(([level, count]) => (
                <div key={level} className="text-center">
                  <div className={`text-2xl font-bold ${getRiskLevelColor(level as FraudRiskLevel)}`}>
                    {count}
                  </div>
                  <div className="text-sm text-gray-600">{level?.toUpperCase()}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Fraud Types</h3>
            <div className="space-y-2">
              {Object.entries(stats.fraudTypeDistribution || {}).map(([type, count]) => (
                <div key={type} className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">{formatFraudType(type as FraudType)}</span>
                  <span className="text-sm font-medium text-gray-900">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FraudDetectionDashboard;
