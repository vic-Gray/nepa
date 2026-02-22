import React from 'react';
import { useTranslation } from 'react-i18next';
import { useStellar } from './hooks/useStellar';
import { WalletConnector } from './components/WalletConnector';
import { PaymentForm } from './components/PaymentForm';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import './i18n';
import './App.css';

const App: React.FC = () => {
  const { t } = useTranslation();
  const { address, status, error, connectWallet, sendPayment } = useStellar();

  return (
    <div className="app-container">
      <header>
        <h1>{t('app.header')}</h1>
        <LanguageSwitcher />
        <WalletConnector address={address} onConnect={connectWallet} />
      </header>

      <main>
        {status === 'success' && <div className="alert success">{t('payment.success')}</div>}
        {error && <div className="alert error">{error}</div>}

        <section className="card">
          <h2>{t('payment.title')}</h2>
          <PaymentForm 
            onSubmit={sendPayment} 
            isLoading={status === 'loading'} 
          />
        </section>
      </main>
    </div>
  );
};

export default App;
