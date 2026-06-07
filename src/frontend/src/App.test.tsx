import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the connection form with Connect button', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /^connect$/i })).toBeInTheDocument();
  });

  it('shows the etcd v3 Browser branding', () => {
    render(<App />);
    expect(screen.getByText('etcd v3 Browser')).toBeInTheDocument();
  });

  it('renders host and port inputs', () => {
    render(<App />);
    expect(screen.getByLabelText(/host/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/port/i)).toBeInTheDocument();
  });

  it('shows Not connected status initially', () => {
    render(<App />);
    expect(screen.getByText('Not connected')).toBeInTheDocument();
  });

  it('renders the theme/settings dropdown toggle', () => {
    render(<App />);
    const toggleButtons = screen.getAllByRole('button');
    expect(toggleButtons.length).toBeGreaterThanOrEqual(2);
  });
});
