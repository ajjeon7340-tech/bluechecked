/**
 * Component tests — App (routing & session init)
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import '../../tests/setup/mocks/i18n';

// Use factory form to avoid hoisting issues
vi.mock('../../services/realBackend', () => import('../../tests/setup/mocks/realBackend'));

// Import mock after vi.mock is registered
import * as realBackendMock from '../../tests/setup/mocks/realBackend';
import App from '../../App';

describe('App — No session (unauthenticated)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(realBackendMock.checkAndSyncSession).mockResolvedValue(null);
    vi.mocked(realBackendMock.subscribeToAuthChanges).mockReturnValue({ unsubscribe: vi.fn() });
  });

  it('renders without crashing when no session exists', async () => {
    render(<App />);
    await waitFor(() => {
      expect(document.body).toBeTruthy();
      expect(document.body.innerHTML.length).toBeGreaterThan(10);
    }, { timeout: 3000 });
  });
});

describe('App — Creator session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(realBackendMock.checkAndSyncSession).mockResolvedValue(realBackendMock.MOCK_CREATOR_USER);
    vi.mocked(realBackendMock.getCreatorProfile).mockResolvedValue(realBackendMock.MOCK_CREATOR);
    vi.mocked(realBackendMock.subscribeToAuthChanges).mockReturnValue({ unsubscribe: vi.fn() });
  });

  it('renders creator dashboard when creator is logged in', async () => {
    render(<App />);
    await waitFor(() => {
      expect(document.body.innerHTML).toContain(realBackendMock.MOCK_CREATOR.displayName);
    }, { timeout: 5000 });
  });
});

describe('App — Fan session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(realBackendMock.checkAndSyncSession).mockResolvedValue(realBackendMock.MOCK_FAN_USER);
    vi.mocked(realBackendMock.getDiemPublicProfileId).mockResolvedValue(null);
    vi.mocked(realBackendMock.subscribeToAuthChanges).mockReturnValue({ unsubscribe: vi.fn() });
    vi.mocked(realBackendMock.getMessages).mockResolvedValue([]);
    vi.mocked(realBackendMock.getFeaturedCreators).mockResolvedValue([]);
  });

  it('renders fan dashboard when fan is logged in', async () => {
    render(<App />);
    await waitFor(() => {
      expect(document.body.innerHTML).toContain(realBackendMock.MOCK_FAN_USER.name);
    }, { timeout: 5000 });
  });
});

describe('App — Error boundary', () => {
  it('renders error state when session throws a generic error', async () => {
    vi.clearAllMocks();
    vi.mocked(realBackendMock.checkAndSyncSession).mockRejectedValue(new Error('Network error'));
    vi.mocked(realBackendMock.subscribeToAuthChanges).mockReturnValue({ unsubscribe: vi.fn() });

    render(<App />);
    await waitFor(() => {
      const hasError =
        document.body.innerHTML.toLowerCase().includes('error') ||
        document.body.innerHTML.toLowerCase().includes('connection') ||
        document.body.innerHTML.toLowerCase().includes('retry');
      expect(hasError).toBe(true);
    }, { timeout: 3000 });
  });
});
