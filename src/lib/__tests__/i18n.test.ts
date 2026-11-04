import enUS from '@/locales/en-US';
import zhCN from '@/locales/zh-CN';

import { LOCALES, LOCALE_LABELS, isLocale } from '../i18n/config';
import {
  byKind,
  createTranslator,
  formatRuleStatus,
  interpolate,
  resolveMessage,
  type MessageKey,
} from '../i18n/translate';

describe('i18n catalogs', () => {
  it('keeps zh-CN structurally identical to en-US', () => {
    expect(Object.keys(zhCN).sort()).toEqual(Object.keys(enUS).sort());
    for (const namespace of Object.keys(enUS) as Array<keyof typeof enUS>) {
      expect(Object.keys(zhCN[namespace]).sort()).toEqual(Object.keys(enUS[namespace]).sort());
    }
  });

  it('has no empty translations', () => {
    for (const [namespace, group] of Object.entries(zhCN)) {
      for (const [key, value] of Object.entries(group)) {
        expect(`${namespace}.${key}`).toBeTruthy();
        expect(value.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe('resolveMessage', () => {
  it('resolves a dotted key', () => {
    expect(resolveMessage(enUS, 'common.save')).toBe('Save');
    expect(resolveMessage(zhCN, 'common.save')).toBe('保存');
  });

  it('interpolates the stream delete description', () => {
    const t = createTranslator(zhCN, enUS);
    expect(t('stream.deleteStreamDescription', { name: 'demo' })).toContain('demo');
  });

  it('resolves keys across namespaces', () => {
    expect(resolveMessage(enUS, 'nav.streams')).toBe('Streams');
    expect(resolveMessage(zhCN, 'nav.streams')).toBe('流');
    expect(resolveMessage(zhCN, 'nav.nodes')).toBe('节点');
  });

  it('returns undefined for unknown keys', () => {
    expect(resolveMessage(enUS, 'common.nope')).toBeUndefined();
    expect(resolveMessage(enUS, 'common')).toBeUndefined();
  });
});

describe('interpolate', () => {
  it('substitutes placeholders', () => {
    expect(interpolate('删除 {name}?', { name: '规则A' })).toBe('删除 规则A?');
  });

  it('leaves unknown placeholders verbatim so breakage is visible', () => {
    expect(interpolate('删除 {name}?')).toBe('删除 {name}?');
    expect(interpolate('{a} {b}', { a: 1 })).toBe('1 {b}');
  });
});

describe('createTranslator', () => {
  it('translates in the requested locale', () => {
    const t = createTranslator(zhCN, enUS);
    expect(t('common.save')).toBe('保存');
  });

  it('falls back to the default locale when a key is missing', () => {
    const partial = { ...zhCN, common: { ...zhCN.common } } as Record<string, unknown>;
    delete (partial.common as Record<string, string>).cancel;
    const t = createTranslator(partial as unknown as typeof zhCN, enUS);
    expect(t('common.cancel')).toBe('Cancel');
  });

  it('returns the raw key when neither locale has it', () => {
    const t = createTranslator(zhCN, enUS);
    expect(t('common.unknownKey' as MessageKey)).toBe('common.unknownKey');
  });
});

describe('byKind', () => {
  it('selects the stream key for streams', () => {
    expect(byKind('stream', 'stream.streamsTitle', 'stream.tablesTitle')).toBe('stream.streamsTitle');
  });

  it('selects the table key for tables', () => {
    expect(byKind('table', 'stream.streamsTitle', 'stream.tablesTitle')).toBe('stream.tablesTitle');
  });

  it('resolves to distinct translations per kind', () => {
    const t = createTranslator(zhCN, enUS);
    expect(t(byKind('stream', 'stream.createStream', 'stream.createTable'))).toBe('创建流');
    expect(t(byKind('table', 'stream.createStream', 'stream.createTable'))).toBe('创建表');
  });
});

describe('locale config', () => {
  it('uses BCP-47 hyphenated identifiers', () => {
    expect(LOCALES).toEqual(['en-US', 'zh-CN']);
  });

  it('labels each locale in its own language', () => {
    expect(LOCALE_LABELS['zh-CN']).toBe('简体中文');
    expect(LOCALE_LABELS['en-US']).toBe('English');
  });

  it('validates locale values', () => {
    expect(isLocale('zh-CN')).toBe(true);
    expect(isLocale('zh_CN')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe('formatRuleStatus', () => {
  const tEn = createTranslator(enUS, enUS);
  const tZh = createTranslator(zhCN, enUS);

  it.each([
    ['running', 'Running', '运行中'],
    ['running: all good', 'Running: all good', '运行中：all good'],
    ['stopped', 'Stopped', '已停止'],
    ['stopped: canceled manually', 'Stopped: canceled manually', '已停止：canceled manually'],
    ['stopped: sink failed to connect', 'Stopped: sink failed to connect', '已停止：sink failed to connect'],
    ['starting', 'Starting', '正在启动'],
    ['stopping', 'Stopping', '正在停止'],
    ['error', 'Error', '错误'],
    ['error: connection refused', 'Error: connection refused', '错误：connection refused'],
    ['  RUNNING : healthy ', 'Running: healthy', '运行中：healthy'],
    ['Stopped   timeout waiting for broker', 'Stopped timeout waiting for broker', '已停止 timeout waiting for broker'],
    ['an unfamiliar engine state', 'an unfamiliar engine state', 'an unfamiliar engine state'],
    ['', 'Unknown', '未知'],
    ['   ', 'Unknown', '未知'],
    [undefined, 'Unknown', '未知'],
    [null, 'Unknown', '未知'],
  ] as const)('formats %p in en-US as %p and zh-CN as %p', (input, expectedEn, expectedZh) => {
    expect(formatRuleStatus(input, tEn)).toBe(expectedEn);
    expect(formatRuleStatus(input, tZh)).toBe(expectedZh);
  });
});

