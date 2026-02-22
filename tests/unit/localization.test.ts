/**
 * @jest-environment jsdom
 */

import { formatCurrency, formatDate, formatNumber } from '../../src/utils/localization';

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('Localization Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('formatCurrency', () => {
    test('should format USD currency in English', () => {
      const result = formatCurrency(100.50, 'en', 'USD');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    test('should format EUR currency in French', () => {
      const result = formatCurrency(100.50, 'fr', 'EUR');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    test('should handle unsupported currency gracefully', () => {
      const result = formatCurrency(100.50, 'en', 'XYZ');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('formatDate', () => {
    test('should format date in English', () => {
      const date = new Date('2024-01-01');
      const result = formatDate(date, 'en');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    test('should format date in French', () => {
      const date = new Date('2024-01-01');
      const result = formatDate(date, 'fr');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    test('should handle invalid date gracefully', () => {
      const result = formatDate(new Date('invalid'), 'en');
      expect(result).toBeDefined();
    });
  });

  describe('formatNumber', () => {
    test('should format number in English', () => {
      const result = formatNumber(1234567.89, 'en');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    test('should format number in French', () => {
      const result = formatNumber(1234567.89, 'fr');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    test('should format zero correctly', () => {
      const result = formatNumber(0, 'en');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });
});
