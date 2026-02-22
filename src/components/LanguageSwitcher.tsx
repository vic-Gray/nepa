import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher: React.FC = () => {
  const { i18n, t } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="language-switcher">
      <label htmlFor="language-select" style={{ marginRight: '8px' }}>
        {t('language.select')}:
      </label>
      <select
        id="language-select"
        onChange={(e) => changeLanguage(e.target.value)}
        value={i18n.language}
        style={{
          padding: '4px 8px',
          borderRadius: '4px',
          border: '1px solid #ccc',
        }}
      >
        <option value="en">English</option>
        <option value="fr">Français</option>
        <option value="ar">العربية</option>
      </select>
    </div>
  );
};

export default LanguageSwitcher;
