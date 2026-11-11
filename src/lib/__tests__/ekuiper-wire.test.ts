import {
  isSensitiveEKuiperPath,
  parseEKuiperJsonObject,
  redactEKuiperSecrets,
  sanitizeSensitiveEKuiperBody,
} from '@/lib/ekuiper/wire';

describe('eKuiper wire responses', () => {
  it('parses JSON even when eKuiper labels it as text/plain', () => {
    expect(parseEKuiperJsonObject('{"version":"2.4.1"}')).toEqual({ version: '2.4.1' });
  });

  it('rejects malformed and non-object system responses', () => {
    expect(() => parseEKuiperJsonObject('not-json')).toThrow();
    expect(() => parseEKuiperJsonObject('[]')).toThrow();
  });

  it.each([
    'connections',
    'connections/mqtt-main',
    'metadata/sources/yaml/mqtt',
    'metadata/sinks/yaml/rest',
    'metadata/connections/yaml/mqtt',
    'metadata/resource',
  ])('classifies %s as sensitive independently of media type', (path) => {
    expect(isSensitiveEKuiperPath(path)).toBe(true);
  });

  it('redacts nested and array-held credentials', () => {
    expect(
      redactEKuiperSecrets({
        id: 'mqtt-main',
        props: { username: 'operator', password: 'secret', nested: [{ privateKey: 'key' }] },
      }),
    ).toEqual({
      id: 'mqtt-main',
      props: { username: 'operator', password: '[redacted]', nested: [{ privateKey: '[redacted]' }] },
    });
  });

  it('redacts sensitive JSON payloads across methods while allowing plain-text mutation acks', () => {
    const getJson = sanitizeSensitiveEKuiperBody(
      'GET',
      '[{"id":"c1","typ":"mqtt","props":{"password":"secret"}}]',
    );
    expect(getJson.isJson).toBe(true);
    expect(JSON.parse(getJson.body)).toEqual([
      { id: 'c1', typ: 'mqtt', props: { password: '[redacted]' } },
    ]);

    expect(sanitizeSensitiveEKuiperBody('POST', 'success')).toEqual({
      body: 'success',
      isJson: false,
    });
    expect(sanitizeSensitiveEKuiperBody('DELETE', '  ')).toEqual({
      body: '  ',
      isJson: false,
    });

    expect(() => sanitizeSensitiveEKuiperBody('GET', 'success')).toThrow(/invalid JSON/i);
    expect(() => sanitizeSensitiveEKuiperBody('POST', 'password=secret')).toThrow(/invalid JSON/i);
  });
});
