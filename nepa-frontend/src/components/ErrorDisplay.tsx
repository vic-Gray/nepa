import React from 'react';
import { NetworkStatus } from '../services/networkStatusService';
import { ErrorHandler } from '../utils/errorHandler';

interface ErrorDisplayProps {
  error: string | null;
  networkStatus: NetworkStatus;
  onRetry?: () => void;
  onDismiss?: () => void;
  retryCount?: number;
  className?: string;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  networkStatus,
  onRetry,
  onDismiss,
  retryCount = 0,
  className = ''
}) => {
  if (!error) return null;

  const getErrorIcon = () => {
    switch (networkStatus) {
      case NetworkStatus.OFFLINE:
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M12 2.25a9.75 9.75 0 109.75 9.75A9.75 9.75 0 0012 2.25zm0 0a9.75 9.75 0 00-9.75 9.75" />
          </svg>
        );
      case NetworkStatus.SLOW:
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case NetworkStatus.UNSTABLE:
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      default:
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getErrorColor = () => {
    switch (networkStatus) {
      case NetworkStatus.OFFLINE:
        return 'bg-red-50 border-red-200 text-red-800';
      case NetworkStatus.SLOW:
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case NetworkStatus.UNSTABLE:
        return 'bg-orange-50 border-orange-200 text-orange-800';
      default:
        return 'bg-red-50 border-red-200 text-red-800';
    }
  };

  const getRetryText = () => {
    if (retryCount === 0) return 'Try Again';
    if (retryCount === 1) return 'Retry (1/3)';
    if (retryCount === 2) return 'Retry (2/3)';
    return 'Final Retry (3/3)';
  };

  const canRetry = onRetry && retryCount < 3;

  return (
    <div className={`rounded-lg border p-4 ${getErrorColor()} ${className}`}>
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          {getErrorIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium">
            {networkStatus === NetworkStatus.OFFLINE && 'Connection Lost'}
            {networkStatus === NetworkStatus.SLOW && 'Slow Connection'}
            {networkStatus === NetworkStatus.UNSTABLE && 'Unstable Connection'}
            {networkStatus === NetworkStatus.ONLINE && 'Error Occurred'}
          </h3>
          <p className="mt-1 text-sm">{error}</p>
          
          {networkStatus === NetworkStatus.OFFLINE && (
            <p className="mt-2 text-xs">
              Please check your internet connection and try again.
            </p>
          )}
          
          {networkStatus === NetworkStatus.SLOW && (
            <p className="mt-2 text-xs">
              Your connection is slow. Operations may take longer than usual.
            </p>
          )}
          
          {networkStatus === NetworkStatus.UNSTABLE && (
            <p className="mt-2 text-xs">
              Your connection is unstable. Please wait for it to stabilize or try again.
            </p>
          )}
        </div>
        
        <div className="flex flex-col space-y-2">
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1 rounded-md hover:bg-black hover:bg-opacity-10 transition-colors"
              aria-label="Dismiss error"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      <div className="mt-4 flex space-x-3">
        {canRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 text-sm font-medium rounded-md bg-white bg-opacity-20 hover:bg-opacity-30 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-red-50 focus:ring-red-500"
          >
            {getRetryText()}
          </button>
        )}
        
        {networkStatus === NetworkStatus.OFFLINE && (
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm font-medium rounded-md bg-white bg-opacity-20 hover:bg-opacity-30 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-red-50 focus:ring-red-500"
          >
            Refresh Page
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorDisplay;
