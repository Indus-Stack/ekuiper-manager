import * as React from 'react';

import { I18nProvider } from '@/lib/i18n/provider';

/**
 * Components under test call useT(), which throws outside <I18nProvider>.
 * These suites render with raw createRoot + act rather than a testing-library
 * `render`, so there is no global wrapper to hook into — each suite wraps its
 * element explicitly with this helper instead.
 */
export function withI18n(element: React.ReactElement): React.ReactElement {
  return <I18nProvider>{element}</I18nProvider>;
}
