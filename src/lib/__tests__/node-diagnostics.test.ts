import enUS from '@/locales/en-US';
import zhCN from '@/locales/zh-CN';

import { createTranslator } from '../i18n/translate';
import { formatNodeDiagnostic } from '../nodes/diagnostics';

const en = createTranslator(enUS, enUS);
const zh = createTranslator(zhCN, enUS);

describe('formatNodeDiagnostic', () => {
  it('returns null when there is no diagnostic', () => {
    expect(formatNodeDiagnostic(null, zh)).toBeNull();
    expect(formatNodeDiagnostic(undefined, zh)).toBeNull();
    expect(formatNodeDiagnostic('', zh)).toBeNull();
    expect(formatNodeDiagnostic('   ', zh)).toBeNull();
  });

  it('localizes the unsupported-version message and keeps the version', () => {
    const stored = 'Unsupported eKuiper version 2.4.0-alpha.1-254-g640e3ff2';
    expect(formatNodeDiagnostic(stored, zh)).toBe('不支持的 eKuiper 版本 2.4.0-alpha.1-254-g640e3ff2');
    expect(formatNodeDiagnostic(stored, en)).toBe(stored);
  });

  it('localizes the HTTP failure and keeps the status code', () => {
    const stored = 'eKuiper returned HTTP 502';
    expect(formatNodeDiagnostic(stored, zh)).toBe('eKuiper 返回 HTTP 502');
    expect(formatNodeDiagnostic(stored, en)).toBe(stored);
  });

  it('localizes the fixed sentences', () => {
    expect(formatNodeDiagnostic('Version was not reported', zh)).toBe('该节点未上报版本信息。');
    expect(formatNodeDiagnostic('Connection failed', zh)).toBe('无法连接到该节点。');
    expect(formatNodeDiagnostic('Cannot connect to eKuiper server', zh)).toBe('无法连接到 eKuiper 服务器。');
    expect(formatNodeDiagnostic('Connection timeout - eKuiper server not responding', zh)).toBe(
      '连接超时：eKuiper 服务器无响应。',
    );
  });

  it('passes unrecognized messages through verbatim', () => {
    // eKuiper may relay its own error text; hiding it would lose the only clue.
    const relayed = 'dial tcp 192.168.88.240:9081: connect: connection refused';
    expect(formatNodeDiagnostic(relayed, zh)).toBe(relayed);
  });

  it('trims surrounding whitespace before matching', () => {
    expect(formatNodeDiagnostic('  Connection failed \n', zh)).toBe('无法连接到该节点。');
  });

  it('never returns a raw English sentence from the known set', () => {
    const known = [
      'Unsupported eKuiper version 2.4.0',
      'Version was not reported',
      'Connection failed',
      'Cannot connect to eKuiper server',
      'Connection timeout - eKuiper server not responding',
      'eKuiper returned HTTP 500',
    ];
    for (const message of known) {
      expect(formatNodeDiagnostic(message, zh)).not.toBe(message);
    }
  });
});
