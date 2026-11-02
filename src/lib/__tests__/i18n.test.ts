import enUS from '@/locales/en-US';
import zhCN from '@/locales/zh-CN';

import { LOCALES, LOCALE_LABELS, isLocale } from '../i18n/config';
import { createTranslator, interpolate, resolveMessage, type MessageKey } from '../i18n/translate';

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
