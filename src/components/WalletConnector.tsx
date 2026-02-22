import React from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  address: string | null;
  onConnect: () => void;
}

export const WalletConnector: React.FC<Props> = ({ address, onConnect }) => {
  const { t } = useTranslation();
  
  return (
    <div className="wallet-section">
      {address ? (
        <p>{t('wallet.connected', { address: `${address.substring(0, 4)}...${address.substring(52)}` })}</p>
      ) : (
        <button onClick={onConnect} className="btn-connect">{t('wallet.connect')}</button>
      )}
    </div>
  );
};
