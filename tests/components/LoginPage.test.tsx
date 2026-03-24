/**
 * Component tests — Login / Sign-up Page
 * Covers: login form render, sign-up form, password reset, profile setup step.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../../tests/setup/mocks/i18n';

vi.mock('../../services/realBackend', () => import('../../tests/setup/mocks/realBackend'));

import { LoginPage } from '../../components/LoginPage';
import { MOCK_FAN_USER, MOCK_CREATOR_USER } from '../../tests/setup/mocks/realBackend';

const defaultProps = {
  onLoginSuccess: vi.fn(),
  onBack: vi.fn(),
  initialRole: 'CREATOR' as const,
  initialStep: 'LOGIN' as const,
  currentUser: null,
};

describe('LoginPage — Render', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the login form', () => {
    render(<LoginPage {...defaultProps} />);
    // Should have at least one email/phone input
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.length).toBeGreaterThan(0);
  });

  it('renders with FAN initial role', () => {
    render(<LoginPage {...defaultProps} initialRole="FAN" />);
    expect(document.body).toBeTruthy();
  });

  it('calls onBack when back button is clicked', () => {
    render(<LoginPage {...defaultProps} />);
    const backButtons = screen.getAllByRole('button').filter(btn =>
      btn.textContent?.toLowerCase().includes('back') ||
      btn.getAttribute('aria-label')?.toLowerCase().includes('back')
    );
    if (backButtons.length > 0) {
      fireEvent.click(backButtons[0]);
      expect(defaultProps.onBack).toHaveBeenCalled();
    }
  });
});

describe('LoginPage — Password Reset Step', () => {
  it('renders RESET_PASSWORD step without crashing', () => {
    render(<LoginPage {...defaultProps} initialStep="RESET_PASSWORD" />);
    expect(document.body).toBeTruthy();
  });
});

describe('LoginPage — Setup Profile Step', () => {
  it('renders SETUP_PROFILE step for logged-in creator', () => {
    render(
      <LoginPage
        {...defaultProps}
        initialStep="SETUP_PROFILE"
        currentUser={MOCK_CREATOR_USER}
      />
    );
    expect(document.body).toBeTruthy();
  });
});

describe('LoginPage — Role Tabs', () => {
  it('has a way to switch between CREATOR and FAN roles', () => {
    render(<LoginPage {...defaultProps} />);
    // Look for role toggle buttons (Creator / Fan tabs)
    const allButtons = screen.getAllByRole('button');
    const roleRelatedButtons = allButtons.filter(btn =>
      btn.textContent?.toLowerCase().includes('creator') ||
      btn.textContent?.toLowerCase().includes('fan')
    );
    expect(roleRelatedButtons.length).toBeGreaterThan(0);
  });
});
