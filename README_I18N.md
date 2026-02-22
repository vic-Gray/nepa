# Internationalization (i18n) Implementation

This document describes the internationalization features implemented in the NEPA application.

## Features Implemented

### ✅ Multi-language Support
- **English (en)** - Default language
- **French (fr)** - Full translation support
- **Arabic (ar)** - Full translation support with RTL layout

### ✅ Automatic Locale Detection
- Detects user's browser language preference
- Falls back to English if unsupported language detected
- Stores user preference in localStorage

### ✅ RTL Language Support
- Automatic document direction switching for Arabic
- Proper text alignment for RTL languages
- CSS direction management

### ✅ Localized Formatting
- **Currency formatting** using Intl.NumberFormat
- **Date/Time formatting** using date-fns with locale support
- **Number formatting** according to locale conventions

### ✅ Translation System
- Uses react-i18next framework
- Component-based translation keys
- Interpolation support for dynamic values
- Pluralization support (when needed)

## File Structure

```
src/
├── i18n/
│   └── index.ts              # i18n configuration
├── locales/
│   ├── en.json              # English translations
│   ├── fr.json              # French translations
│   └── ar.json              # Arabic translations
├── components/
│   └── LanguageSwitcher.tsx # Language selection component
├── utils/
│   └── localization.ts      # Formatting utilities
└── tests/
    └── i18n.test.tsx        # i18n tests
```

## Usage

### Adding New Translations

1. Add translation keys to all locale files:
```json
// src/locales/en.json
{
  "new_feature": {
    "title": "New Feature",
    "description": "This is a new feature"
  }
}
```

2. Use in components:
```tsx
import { useTranslation } from 'react-i18next';

const Component = () => {
  const { t } = useTranslation();
  return <h1>{t('new_feature.title')}</h1>;
};
```

### Adding New Languages

1. Create new locale file: `src/locales/[lang].json`
2. Add language to i18n configuration: `src/i18n/index.ts`
3. Add language option to LanguageSwitcher component
4. Add locale mapping in localization utilities

### Using Localized Formatting

```tsx
import { formatDate, formatCurrency, formatNumber } from '../utils/localization';

// Format dates
const formattedDate = formatDate(new Date(), 'fr', 'PPP');

// Format currency
const formattedCurrency = formatCurrency(100.50, 'fr', 'EUR');

// Format numbers
const formattedNumber = formatNumber(1234567.89, 'fr');
```

## Configuration

### i18n Configuration (src/i18n/index.ts)
- Fallback language: English
- Detection order: localStorage → navigator → htmlTag
- Caching: localStorage
- Debug mode: Development only

### Language Detection
The system automatically detects the user's preferred language in this order:
1. Previously saved preference (localStorage)
2. Browser language settings
3. HTML lang attribute
4. Falls back to English

## Testing

Run the i18n tests:
```bash
npm test -- i18n.test.tsx
```

Tests cover:
- Default language rendering
- Language switching functionality
- RTL language support
- Translation key resolution

## Browser Support

The implementation supports all modern browsers that provide:
- Intl.NumberFormat API
- localStorage API
- ES6+ JavaScript features

## Performance Considerations

- Translation files are loaded asynchronously
- Language preference is cached in localStorage
- Minimal bundle size impact through tree-shaking
- Efficient re-rendering with React hooks

## Future Enhancements

Potential improvements for future versions:
- **Pluralization rules** for different languages
- **Lazy loading** of translation files
- **Namespace support** for large applications
- **Dynamic language loading** from CDN
- **Translation management system** integration
- **More languages** (Spanish, German, Chinese, etc.)
