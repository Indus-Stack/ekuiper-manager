/**
 * Formats the diagnostics that the Manager stores in `managed_nodes.last_error`.
 *
 * Those strings are written by the server, so they arrive in English no matter
 * which locale the UI runs in. Rather than migrate the column, the raw message
 * is matched against the small set of sentence shapes the probe can produce and
 * rendered through the catalog; anything unrecognized is shown verbatim so a
 * new failure mode is still visible rather than silently swallowed.
 */
import type { Translate } from '@/lib/i18n';

const HTTP_STATUS = /^eKuiper returned HTTP (\d{3})$/;
const UNSUPPORTED_VERSION = /^Unsupported eKuiper version (.+)$/;
const VERSION_NOT_REPORTED = 'Version was not reported';
const CONNECTION_FAILED = 'Connection failed';
const CONNECT = /^Cannot connect to eKuiper server$/;
const TIMEOUT = /^Connection timeout - eKuiper server not responding$/;

/** Zero-width sentinel used by the caller when the node has no diagnostic. */
export const NO_DIAGNOSTIC = '';

export function formatNodeDiagnostic(message: string | null | undefined, t: Translate): string | null {
  if (!message) return null;
  const text = message.trim();
  if (!text) return null;

  const http = HTTP_STATUS.exec(text);
  if (http) return t('admin.diagHttpStatus', { status: http[1] });

  const unsupported = UNSUPPORTED_VERSION.exec(text);
  if (unsupported) return t('admin.diagUnsupportedVersion', { version: unsupported[1] });

  if (text === VERSION_NOT_REPORTED) return t('admin.diagVersionNotReported');
  if (text === CONNECTION_FAILED) return t('admin.diagConnectionFailed');
  if (CONNECT.test(text)) return t('admin.diagCannotConnect');
  if (TIMEOUT.test(text)) return t('admin.diagTimeout');

  // Unrecognized: the server may have relayed a message from eKuiper itself.
  return text;
}
