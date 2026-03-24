/**
 * Mock for react-i18next — returns the key as-is so tests can assert on i18n keys
 * without needing a full i18n setup.
 */
import { vi } from 'vitest';
import React from 'react';

const useMock = ((k: string) => [k, {}, false]) as any;
useMock.t = (k: string) => k;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { changeLanguage: vi.fn(), language: 'en' } }),
  Trans: ({ children }: any) => children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  I18nextProvider: ({ children }: any) => children,
}));

vi.mock('i18next', () => ({
  default: {
    use: vi.fn().mockReturnThis(),
    init: vi.fn().mockReturnThis(),
    t: (k: string) => k,
    language: 'en',
    changeLanguage: vi.fn(),
  },
  use: vi.fn().mockReturnThis(),
  init: vi.fn(),
}));
