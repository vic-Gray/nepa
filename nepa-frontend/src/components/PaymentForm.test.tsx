import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PaymentForm } from './PaymentForm';

// Mock the validation utilities
jest.mock('../utils/validation', () => ({
  validateMeterNumber: jest.fn(),
  validateAmount: jest.fn(),
  formatMeterId: jest.fn((value) => value),
  sanitizeAmount: jest.fn((value) => value),
  VALIDATION_RULES: {
    MIN_AMOUNT: 100,
    MAX_AMOUNT: 1000000
  }
}));

describe('PaymentForm', () => {
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  test('renders form with all elements', () => {
    render(<PaymentForm onSubmit={mockOnSubmit} isLoading={false} />);
    
    expect(screen.getByLabelText(/Meter Number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Amount \(NGN\)/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pay Now/i })).toBeInTheDocument();
  });

  test('shows validation errors for empty fields on submit', async () => {
    const { validateMeterNumber, validateAmount } = require('../utils/validation');
    validateMeterNumber.mockReturnValue('Meter number is required');
    validateAmount.mockReturnValue('Amount is required');

    render(<PaymentForm onSubmit={mockOnSubmit} isLoading={false} />);
    
    const submitButton = screen.getByRole('button', { name: /Pay Now/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Meter number is required')).toBeInTheDocument();
      expect(screen.getByText('Amount is required')).toBeInTheDocument();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  test('shows validation error for invalid meter ID format', async () => {
    const { validateMeterNumber } = require('../utils/validation');
    validateMeterNumber.mockReturnValue('Meter number must follow the format: METER-123');

    render(<PaymentForm onSubmit={mockOnSubmit} isLoading={false} />);
    
    const meterInput = screen.getByLabelText(/Meter Number/i);
    fireEvent.change(meterInput, { target: { value: 'INVALID' } });
    fireEvent.blur(meterInput);

    await waitFor(() => {
      expect(screen.getByText('Meter number must follow the format: METER-123')).toBeInTheDocument();
    });
  });

  test('shows validation error for amount below minimum', async () => {
    const { validateAmount } = require('../utils/validation');
    validateAmount.mockReturnValue('Minimum amount is ₦100');

    render(<PaymentForm onSubmit={mockOnSubmit} isLoading={false} />);
    
    const amountInput = screen.getByLabelText(/Amount \(NGN\)/i);
    fireEvent.change(amountInput, { target: { value: '50' } });
    fireEvent.blur(amountInput);

    await waitFor(() => {
      expect(screen.getByText('Minimum amount is ₦100')).toBeInTheDocument();
    });
  });

  test('submits form with valid data', async () => {
    const { validateMeterNumber, validateAmount } = require('../utils/validation');
    validateMeterNumber.mockReturnValue(null);
    validateAmount.mockReturnValue(null);

    render(<PaymentForm onSubmit={mockOnSubmit} isLoading={false} />);
    
    const meterInput = screen.getByLabelText(/Meter Number/i);
    const amountInput = screen.getByLabelText(/Amount \(NGN\)/i);
    const submitButton = screen.getByRole('button', { name: /Pay Now/i });

    fireEvent.change(meterInput, { target: { value: 'METER-123' } });
    fireEvent.change(amountInput, { target: { value: '1000' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        destination: 'METER-123',
        amount: '1000'
      });
    });
  });

  test('disables submit button when loading', () => {
    render(<PaymentForm onSubmit={mockOnSubmit} isLoading={true} />);
    
    const submitButton = screen.getByRole('button', { name: /Processing/i });
    expect(submitButton).toBeDisabled();
  });

  test('quick amount buttons set amount correctly', () => {
    render(<PaymentForm onSubmit={mockOnSubmit} isLoading={false} />);
    
    const quickAmountButton = screen.getByText('₦1000');
    fireEvent.click(quickAmountButton);

    const amountInput = screen.getByLabelText(/Amount \(NGN\)/i);
    expect(amountInput).toHaveValue('1000');
  });
});
