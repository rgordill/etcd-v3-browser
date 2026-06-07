import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CopyButton } from './CopyButton';

Object.assign(navigator, {
  clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
});

describe('CopyButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with "Copy" label', () => {
    render(<CopyButton text="hello" />);
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
  });

  it('is disabled when text is empty', () => {
    render(<CopyButton text="" />);
    expect(screen.getByRole('button', { name: /copy/i })).toBeDisabled();
  });

  it('copies text to clipboard on click', async () => {
    render(<CopyButton text="test content" />);
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test content');
    });
  });

  it('shows "Copied" label after successful copy', async () => {
    render(<CopyButton text="hello" />);
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument();
    });
  });
});
