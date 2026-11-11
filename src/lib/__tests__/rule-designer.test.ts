import {
  buildSql,
  coerceFieldValue,
  decodeActions,
  duplicateRule,
  encodeActions,
  insertFunctionIntoSql,
  parseSimpleSql,
  redactSensitive,
  sinkFields,
  toLabelString,
} from '@/lib/ekuiper/rule-designer';
import type { MetadataProperty, Rule, Sink } from '@/lib/ekuiper/types';

describe('rule designer codecs', () => {
  test('round-trips typed and unknown action properties without loss', () => {
    const source = [{
      sql: {
        dburl: 'postgres://db',
        table: 'measurements',
        fields: ['device_id', 'value'],
        sendSingle: true,
        batchSize: 25,
        futureOption: { mode: 'strict' },
      },
      customOuterOption: 'kept',
    }] as unknown as Sink[];

    expect(encodeActions(decodeActions(source))).toEqual(source);
  });

  test('coerces downstream fork fields to official wire types', () => {
    expect(coerceFieldValue('number', '1883')).toBe(1883);
    expect(coerceFieldValue('boolean', 'true')).toBe(true);
    expect(coerceFieldValue('boolean', 'false')).toBe(false);
    expect(coerceFieldValue('string-list', 'id, value\nts')).toEqual(['id', 'value', 'ts']);
    expect(sinkFields('sql').find((field) => field.key === 'sendSingle')?.kind).toBe('boolean');
  });

  test('generates and parses the supported visual SQL shape', () => {
    const query = {
      fields: 'deviceId, avg(power) AS mean_power',
      source: 'meter_stream',
      where: 'power > 10',
      groupBy: 'deviceId, TUMBLINGWINDOW(ss, 10)',
      having: 'count(*) > 2',
      orderBy: 'mean_power DESC',
      limit: '25',
    };
    const sql = buildSql(query);
    expect(sql).toBe('SELECT deviceId, avg(power) AS mean_power FROM meter_stream WHERE power > 10 GROUP BY deviceId, TUMBLINGWINDOW(ss, 10) HAVING count(*) > 2 ORDER BY mean_power DESC LIMIT 25');
    expect(parseSimpleSql(sql)).toEqual(query);
  });

  test('masks nested secrets in previews', () => {
    expect(redactSensitive({ mqtt: { username: 'operator', password: 'secret', token: 'abc' } })).toEqual({
      mqtt: { username: 'operator', password: '••••••••', token: '••••••••' },
    });
  });

  test('duplicates only definition fields and always creates the clone stopped', () => {
    const source: Rule = {
      id: 'source_rule',
      name: 'Runtime display name',
      version: 9,
      triggered: true,
      sql: 'SELECT * FROM source_stream',
      actions: [{ log: {} }],
      options: { concurrency: 2 },
      tags: ['production'],
    };

    expect(duplicateRule(source, 'copy_rule')).toEqual({
      id: 'copy_rule',
      triggered: false,
      sql: 'SELECT * FROM source_stream',
      actions: [{ log: {} }],
      options: { concurrency: 2 },
      tags: ['production'],
    });
  });

  test('sinkFields localizes built-in MQTT labels and hints in both English and Chinese', () => {
    const enFields = sinkFields('mqtt', [], 'en');
    const zhFields = sinkFields('mqtt', [], 'zh');

    const enByKey = new Map(enFields.map((f) => [f.key, f]));
    const zhByKey = new Map(zhFields.map((f) => [f.key, f]));

    expect(enByKey.get('server')?.label).toBe('MQTT Broker Server');
    expect(zhByKey.get('server')?.label).toBe('MQTT 服务器地址');

    expect(enByKey.get('topic')?.label).toBe('Publish Topic');
    expect(zhByKey.get('topic')?.label).toBe('发布主题');

    expect(enByKey.get('username')?.label).toBe('Username');
    expect(zhByKey.get('username')?.label).toBe('用户名');

    const enSql = new Map(sinkFields('sql', [], 'en').map((f) => [f.key, f]));
    const zhSql = new Map(sinkFields('sql', [], 'zh').map((f) => [f.key, f]));
    expect(enSql.get('url')?.hint).toContain('Target SQL database connection URL');
    expect(zhSql.get('url')?.hint).toBe('目标数据库连接 URL');
  });

  test('sinkFields resolves bilingual node metadata with English and humanized fallbacks while preserving payloads', () => {
    const metadata: MetadataProperty[] = [
      {
        name: 'endpointUrl',
        type: 'string',
        control: 'text',
        optional: false,
        label: { en_US: 'Endpoint URL', zh_CN: '终端地址' },
        hint: { en_US: 'Target HTTP endpoint', zh_CN: '目标 HTTP 地址' },
      },
      {
        name: 'englishOnlyField',
        type: 'string',
        control: 'text',
        optional: true,
        label: { en: 'English Only Label' },
        hint: { en: 'English Only Hint' },
      },
      {
        name: 'unlabeledCustomField',
        type: 'int',
        control: 'text',
        optional: true,
      },
    ];

    const enFields = sinkFields('custom_sink', metadata, 'en');
    const zhFields = sinkFields('custom_sink', metadata, 'zh');

    expect(enFields.find((f) => f.key === 'endpointUrl')).toMatchObject({
      label: 'Endpoint URL',
      hint: 'Target HTTP endpoint',
    });
    expect(zhFields.find((f) => f.key === 'endpointUrl')).toMatchObject({
      label: '终端地址',
      hint: '目标 HTTP 地址',
    });

    // English-only metadata falls back cleanly to English in zh mode
    expect(zhFields.find((f) => f.key === 'englishOnlyField')).toMatchObject({
      label: 'English Only Label',
      hint: 'English Only Hint',
    });

    // Missing labels fall back to humanized property name
    expect(zhFields.find((f) => f.key === 'unlabeledCustomField')?.label).toBe('Unlabeled Custom Field');
    expect(toLabelString({ 'zh-CN': '横线中文', 'en-US': 'Hyphen English' }, 'zh')).toBe('横线中文');

    // Switching language only changes display labels/hints; field keys and encoded payloads are identical
    expect(enFields.map((f) => f.key)).toEqual(zhFields.map((f) => f.key));
    const draft = decodeActions([
      {
        mqtt: {
          server: 'tcp://broker.emqx.io:1883',
          topic: 'devices/telemetry',
          qos: 1,
        },
      } as unknown as Sink,
    ]);
    expect(encodeActions(draft)).toEqual([
      {
        mqtt: {
          server: 'tcp://broker.emqx.io:1883',
          topic: 'devices/telemetry',
          qos: 1,
        },
      },
    ]);
  });
});

describe('insertFunctionIntoSql', () => {
  const fn = 'array_avg(arr)';

  it('adds the function to the SELECT list when no caret is set (review regression)', () => {
    expect(insertFunctionIntoSql('SELECT temperature FROM demo', fn, null)).toBe(
      'SELECT temperature, array_avg(arr) FROM demo',
    );
  });

  it('keeps the rest of the query intact and parses back as a simple query', () => {
    const next = insertFunctionIntoSql('SELECT temperature FROM demo WHERE temperature > 10', fn, null);
    expect(next).toBe('SELECT temperature, array_avg(arr) FROM demo WHERE temperature > 10');
    expect(parseSimpleSql(next)).not.toBeNull();
  });

  it('replaces a lone * and fills an empty SELECT list', () => {
    expect(insertFunctionIntoSql('SELECT * FROM demo', fn, null)).toBe('SELECT array_avg(arr) FROM demo');
    expect(insertFunctionIntoSql('SELECT FROM demo', fn, null)).toBe('SELECT array_avg(arr) FROM demo');
  });

  it('is not fooled by FROM inside quotes, parentheses, or longer words', () => {
    expect(insertFunctionIntoSql("SELECT 'a FROM b' AS x FROM demo", fn, null)).toBe(
      "SELECT 'a FROM b' AS x, array_avg(arr) FROM demo",
    );
    expect(insertFunctionIntoSql("SELECT 'sensor\\'s from line' AS label FROM demo", fn, null)).toBe(
      "SELECT 'sensor\\'s from line' AS label, array_avg(arr) FROM demo",
    );
    expect(insertFunctionIntoSql("SELECT 'sensor''s from line' AS label FROM demo", fn, null)).toBe(
      "SELECT 'sensor''s from line' AS label, array_avg(arr) FROM demo",
    );
    expect(insertFunctionIntoSql('SELECT "sensor\\"s from line" AS label FROM demo', fn, null)).toBe(
      'SELECT "sensor\\"s from line" AS label, array_avg(arr) FROM demo',
    );
    expect(insertFunctionIntoSql('SELECT cast(x FROM y) FROM demo', fn, null)).toBe(
      'SELECT cast(x FROM y), array_avg(arr) FROM demo',
    );
    expect(insertFunctionIntoSql('SELECT fromage FROM demo', fn, null)).toBe(
      'SELECT fromage, array_avg(arr) FROM demo',
    );
  });

  it('appends to the list of a query that has no FROM yet', () => {
    expect(insertFunctionIntoSql('SELECT temperature  ', fn, null)).toBe('SELECT temperature, array_avg(arr)');
  });

  it('starts a new statement for empty SQL and leaves non-SELECT text unchanged', () => {
    expect(insertFunctionIntoSql('  ', fn, null)).toBe('SELECT array_avg(arr) FROM ');
    expect(insertFunctionIntoSql('not sql', fn, null)).toBe('not sql');
  });

  it('honours an explicit caret or selection', () => {
    expect(insertFunctionIntoSql('SELECT  FROM demo', fn, { start: 7, end: 7 })).toBe(
      'SELECT array_avg(arr) FROM demo',
    );
    expect(insertFunctionIntoSql('SELECT x FROM demo', fn, { start: 7, end: 8 })).toBe(
      'SELECT array_avg(arr) FROM demo',
    );
    expect(insertFunctionIntoSql('SELECT x', fn, { start: 99, end: 120 })).toBe('SELECT xarray_avg(arr)');
  });
});
