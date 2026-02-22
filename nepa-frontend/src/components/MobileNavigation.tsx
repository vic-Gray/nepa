import React, { useState } from 'react';

interface MobileNavigationProps {
  currentView: 'payment' | 'yield';
  onViewChange: (view: 'payment' | 'yield') => void;
}

const MobileNavigation: React.FC<MobileNavigationProps> = ({ currentView, onViewChange }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleViewChange = (view: 'payment' | 'yield') => {
    onViewChange(view);
    setIsMenuOpen(false);
  };

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden bg-white shadow-sm sticky top-0 z-40">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-xl font-bold text-blue-600">NEPA 💡</h1>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors touch-manipulation"
            aria-label="Toggle menu"
          >
            <div className="w-6 h-6 flex flex-col justify-center space-y-1">
              <div className={`w-full h-0.5 bg-gray-600 transition-transform ${isMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`}></div>
              <div className={`w-full h-0.5 bg-gray-600 transition-opacity ${isMenuOpen ? 'opacity-0' : ''}`}></div>
              <div className={`w-full h-0.5 bg-gray-600 transition-transform ${isMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`}></div>
            </div>
          </button>
        </div>

        {/* Mobile Menu Overlay */}
        {isMenuOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-30" onClick={() => setIsMenuOpen(false)}>
            <div className="bg-white w-64 h-full shadow-lg" onClick={(e) => e.stopPropagation()}>
              <div className="p-4">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Navigation</h2>
                <nav className="space-y-2">
                  <button
                    onClick={() => handleViewChange('payment')}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors touch-manipulation ${
                      currentView === 'payment'
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-xl">💡</span>
                      <span>Bill Payment</span>
                    </div>
                  </button>
                  <button
                    onClick={() => handleViewChange('yield')}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors touch-manipulation ${
                      currentView === 'yield'
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-xl">📈</span>
                      <span>Yield Generation</span>
                    </div>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Desktop Navigation */}
      <div className="hidden lg:block">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-6 sm:mb-8">
          <button
            onClick={() => onViewChange('payment')}
            className={`px-4 py-3 sm:px-6 sm:py-4 rounded-lg font-medium transition-colors touch-manipulation ${
              currentView === 'payment' 
                ? 'bg-blue-600 text-white shadow-lg' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Bill Payment
          </button>
          <button
            onClick={() => onViewChange('yield')}
            className={`px-4 py-3 sm:px-6 sm:py-4 rounded-lg font-medium transition-colors touch-manipulation ${
              currentView === 'yield' 
                ? 'bg-blue-600 text-white shadow-lg' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Yield Generation
          </button>
        </div>
      </div>
    </>
  );
};

export default MobileNavigation;
