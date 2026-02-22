import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { useTranslation } from 'react-i18next';
import App from '../App';
import LanguageSwitcher from '../components/LanguageSwitcher';
import '../i18n';

// Mock the useStellar hook
jest.mock('../hooks/useStellar', () => ({
  useStellar: () => ({
    address: null,
    status: 'idle',
    error: null,
    connectWallet: jest.fn(),
    sendPayment: jest.fn(),
  }),
}));

describe('Internationalization', () => {
  test('renders in English by default', () => {
    render(<App />);
    expect(screen.getByText('NEPA Stellar Payments')).toBeInTheDocument();
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
    expect(screen.getByText('Send Payment')).toBeInTheDocument();
  });

  test('language switcher changes language', () => {
    const TestComponent = () => {
      const { t } = useTranslation();
      return (
        <div>
          <LanguageSwitcher />
          <span>{t('app.header')}</span>
        </div>
      );
    };

    render(<TestComponent />);
    
    const select = screen.getByLabelText('Select Language:');
    fireEvent.change(select, { target: { value: 'fr' } });
    
    expect(screen.getByText('Paiements Stellar NEPA')).toBeInTheDocument();
  });

  test('Arabic language renders correctly', () => {
    const TestComponent = () => {
      const { t, i18n } = useTranslation();
      React.useEffect(() => {
        i18n.changeLanguage('ar');
      }, [i18n]);
      return <span>{t('app.header')}</span>;
    };

    render(<TestComponent />);
    expect(screen.getByText('مدفوعات ستيلار نيبا')).toBeInTheDocument();
    expect(document.documentElement.dir).toBe('rtl');
  });
});
