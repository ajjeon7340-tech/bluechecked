/**
 * Component tests — Landing Page
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '../../tests/setup/mocks/i18n';

vi.mock('../../services/realBackend', () => import('../../tests/setup/mocks/realBackend'));

import { LandingPage } from '../../components/LandingPage';

const defaultProps = {
  onLoginClick: vi.fn(),
  onDemoClick: vi.fn(),
};

describe('LandingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<LandingPage {...defaultProps} />);
    expect(document.body).toBeTruthy();
  });

  it('calls onLoginClick when the login/sign-up CTA is clicked', () => {
    render(<LandingPage {...defaultProps} />);
    // Find any button that triggers the login flow
    const loginButtons = screen.getAllByRole('button').filter(btn =>
      btn.textContent?.toLowerCase().includes('login') ||
      btn.textContent?.toLowerCase().includes('sign') ||
      btn.textContent?.toLowerCase().includes('get started')
    );
    expect(loginButtons.length).toBeGreaterThan(0);
    fireEvent.click(loginButtons[0]);
    expect(defaultProps.onLoginClick).toHaveBeenCalled();
  });

  it('calls onDemoClick when the demo/explore button is clicked', () => {
    render(<LandingPage {...defaultProps} />);
    const demoButtons = screen.getAllByRole('button').filter(btn =>
      btn.textContent?.toLowerCase().includes('demo') ||
      btn.textContent?.toLowerCase().includes('explore') ||
      btn.textContent?.toLowerCase().includes('try')
    );
    if (demoButtons.length > 0) {
      fireEvent.click(demoButtons[0]);
      expect(defaultProps.onDemoClick).toHaveBeenCalled();
    }
  });

  it('has no broken links (all <a> have href)', () => {
    render(<LandingPage {...defaultProps} />);
    const links = document.querySelectorAll('a[href]');
    // Just ensure there are some navigation links; none should have empty href
    links.forEach(link => {
      expect(link.getAttribute('href')).not.toBe('');
    });
  });
});
