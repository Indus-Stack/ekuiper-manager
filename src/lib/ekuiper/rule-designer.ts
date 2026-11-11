import type { MetadataProperty, Rule, Sink } from './types';
import { getBuiltinConnectorProperties } from './connector-catalog';

export type JsonObject = Record<string, unknown>;

export type SinkFieldKind = 'string' | 'secret' | 'number' | 'boolean' | 'string-list' | 'json';

export interface SinkFieldDefinition {
  key: string;
  label: string;
  kind: SinkFieldKind;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  hint?: string;
}

export interface ActionDraft {
  key: string;
  type: string;
  config: JsonObject;
  outer: JsonObject;
}

export interface QueryDraft {
  fields: string;
  source: string;
  where: string;
  groupBy: string;
  having: string;
  orderBy: string;
  limit: string;
}

const SECRET_KEY = /(password|passwd|secret|token|private.?key|client.?secret|certification)/i;

const COMMON_ACTION_KEYS = new Set([
  'sendSingle',
  'dataTemplate',
  'concurrency',
  'bufferLength',
  'retryInterval',
  'retryCount',
  'cacheLength',
  'cacheSaveInterval',
  'omitIfEmpty',
]);

const COMMON_FIELDS: SinkFieldDefinition[] = [
  { key: 'sendSingle', label: 'sinklabel.send_each_row_separately', kind: 'boolean', hint: 'sinkhint.emit_one_sink_message_per_result_row' },
  { key: 'omitIfEmpty', label: 'sinklabel.omit_empty_results', kind: 'boolean' },
  { key: 'dataTemplate', label: 'sinklabel.data_template', kind: 'string', placeholder: '{{json .}}' },
];

export const BUILTIN_SINKS: Array<{ type: string; label: string; description: string }> = [
  { type: 'log', label: 'sinklabel.log', description: 'sinkdesc.write_result_rows_to_the_ekuiper_log' },
  { type: 'nop', label: 'sinklabel.no_op', description: 'sinkdesc.discard_output_useful_for_testing_processing_cost' },
  { type: 'mqtt', label: 'sinklabel.mqtt', description: 'sinkdesc.publish_results_to_an_mqtt_topic_or_shared_connection' },
  { type: 'rest', label: 'sinklabel.http_rest', description: 'sinkdesc.send_results_to_an_http_rest_endpoint' },
  { type: 'memory', label: 'sinklabel.memory', description: 'sinkdesc.publish_results_to_an_in_memory_topic' },
  { type: 'file', label: 'sinklabel.file', description: 'sinkdesc.write_results_to_a_file_managed_by_ekuiper' },
  { type: 'sql', label: 'sinklabel.sql', description: 'sinkdesc.insert_results_into_a_sql_database_table' },
  { type: 'influx2', label: 'sinklabel.influxdb_v2', description: 'sinkdesc.write_time_series_data_points_to_influxdb_v2_bucket' },
  { type: 'influx', label: 'sinklabel.influxdb_v1', description: 'sinkdesc.write_metrics_to_influxdb_v1_database' },
  { type: 'kafka', label: 'sinklabel.kafka', description: 'sinkdesc.stream_messages_to_an_apache_kafka_topic' },
  { type: 'redis', label: 'sinklabel.redis_redispub', description: 'sinkdesc.publish_messages_to_redis_key_or_pub_sub_channel' },
  { type: 'image', label: 'sinklabel.image_store', description: 'sinkdesc.save_processed_video_frames_or_image_buffers_to_disk' },
  { type: 'websocket', label: 'sinklabel.websocket', description: 'sinkdesc.stream_output_messages_over_an_outbound_websocket' },
  { type: 'neuron', label: 'sinklabel.neuron_gateway', description: 'sinkdesc.forward_processed_data_to_neuron_northbound_nodes' },
  { type: 'edgex', label: 'sinklabel.edgex_foundry', description: 'sinkdesc.publish_results_to_an_installed_edgex_foundry_bus' },
];

const KNOWN_FIELDS: Record<string, SinkFieldDefinition[]> = {
  log: [],
  nop: [{ key: 'log', label: 'sinklabel.log_discarded_rows', kind: 'boolean' }],
  mqtt: [
    { key: 'connectionSelector', label: 'sinklabel.shared_connection', kind: 'string', placeholder: 'connection id' },
    { key: 'server', label: 'sinklabel.broker_url', kind: 'string', placeholder: 'tcp://broker:1883' },
    { key: 'topic', label: 'sinklabel.topic', kind: 'string', required: true, placeholder: 'factory/alerts' },
    { key: 'clientId', label: 'sinklabel.client_id', kind: 'string' },
    { key: 'username', label: 'sinklabel.username', kind: 'string' },
    { key: 'password', label: 'sinklabel.password', kind: 'secret' },
    { key: 'qos', label: 'sinklabel.qos', kind: 'number', options: ['0', '1', '2'] },
    { key: 'retained', label: 'sinklabel.retain_message', kind: 'boolean' },
    { key: 'insecureSkipVerify', label: 'sinklabel.skip_tls_verification', kind: 'boolean' },
    { key: 'certificationPath', label: 'sinklabel.ca_certificate_path', kind: 'string' },
    { key: 'privateKeyPath', label: 'sinklabel.private_key_path', kind: 'secret' },
  ],
  rest: [
    { key: 'url', label: 'sinklabel.url', kind: 'string', required: true, placeholder: 'https://example.test/events' },
    { key: 'method', label: 'sinklabel.method', kind: 'string', options: ['POST', 'PUT', 'PATCH', 'GET', 'DELETE'] },
    { key: 'bodyType', label: 'sinklabel.body_type', kind: 'string', options: ['json', 'text', 'form'] },
    { key: 'headers', label: 'sinklabel.headers', kind: 'json', placeholder: '{"Authorization":"..."}' },
    { key: 'timeout', label: 'sinklabel.timeout_ms', kind: 'number' },
    { key: 'insecureSkipVerify', label: 'sinklabel.skip_tls_verification', kind: 'boolean' },
  ],
  memory: [
    { key: 'topic', label: 'sinklabel.topic', kind: 'string', required: true },
    { key: 'keyField', label: 'sinklabel.key_field', kind: 'string' },
  ],
  file: [
    { key: 'path', label: 'sinklabel.path', kind: 'string', required: true },
    { key: 'fileType', label: 'sinklabel.file_type', kind: 'string', options: ['json', 'csv', 'lines'] },
    { key: 'delimiter', label: 'sinklabel.delimiter', kind: 'string' },
    { key: 'hasHeader', label: 'sinklabel.write_header', kind: 'boolean' },
  ],
  sql: [
    { key: 'dburl', label: 'sinklabel.database_url', kind: 'secret', required: true, placeholder: 'connection string or DSN' },
    { key: 'table', label: 'sinklabel.table', kind: 'string', required: true },
    { key: 'fields', label: 'sinklabel.fields', kind: 'string-list', hint: 'sinkhint.one_field_per_line_or_comma_separated' },
    { key: 'sendSingle', label: 'sinklabel.insert_rows_separately', kind: 'boolean' },
  ],
  edgex: [
    { key: 'connectionSelector', label: 'sinklabel.shared_connection', kind: 'string' },
    { key: 'protocol', label: 'sinklabel.protocol', kind: 'string' },
    { key: 'host', label: 'sinklabel.host', kind: 'string' },
    { key: 'port', label: 'sinklabel.port', kind: 'number' },
    { key: 'topic', label: 'sinklabel.topic', kind: 'string' },
    { key: 'topicPrefix', label: 'sinklabel.topic_prefix', kind: 'string' },
    { key: 'contentType', label: 'sinklabel.content_type', kind: 'string' },
    { key: 'messageType', label: 'sinklabel.message_type', kind: 'string' },
    { key: 'metadata', label: 'sinklabel.metadata', kind: 'json' },
    { key: 'profileName', label: 'sinklabel.profile_name', kind: 'string' },
    { key: 'deviceName', label: 'sinklabel.device_name', kind: 'string' },
    { key: 'sourceName', label: 'sinklabel.source_name', kind: 'string' },
  ],
  influx2: [
    { key: 'addr', label: 'sinklabel.server_address', kind: 'string', required: true, placeholder: 'http://127.0.0.1:8086' },
    { key: 'bucket', label: 'sinklabel.bucket', kind: 'string', required: true, placeholder: 'my-bucket' },
    { key: 'org', label: 'sinklabel.organization', kind: 'string', required: true, placeholder: 'my-org' },
    { key: 'token', label: 'sinklabel.api_token', kind: 'secret', placeholder: 'Token string' },
    { key: 'measurement', label: 'sinklabel.measurement', kind: 'string', placeholder: 'sensor_metrics' },
    { key: 'precision', label: 'sinklabel.precision', kind: 'string', options: ['s', 'ms', 'us', 'ns'] },
    { key: 'useLineProtocol', label: 'sinklabel.use_line_protocol', kind: 'boolean' },
  ],
  influx: [
    { key: 'addr', label: 'sinklabel.server_address', kind: 'string', required: true, placeholder: 'http://127.0.0.1:8086' },
    { key: 'database', label: 'sinklabel.database', kind: 'string', required: true, placeholder: 'telemetry' },
    { key: 'measurement', label: 'sinklabel.measurement', kind: 'string', placeholder: 'sensor_metrics' },
    { key: 'username', label: 'sinklabel.username', kind: 'string' },
    { key: 'password', label: 'sinklabel.password', kind: 'secret' },
    { key: 'precision', label: 'sinklabel.precision', kind: 'string', options: ['s', 'ms', 'us', 'ns'] },
  ],
  image: [
    { key: 'path', label: 'sinklabel.storage_path', kind: 'string', required: true, placeholder: './tmp' },
    { key: 'imageFormat', label: 'sinklabel.format', kind: 'string', options: ['jpeg', 'png'] },
    { key: 'maxAge', label: 'sinklabel.max_retention_hours', kind: 'number', placeholder: '72' },
    { key: 'maxCount', label: 'sinklabel.max_image_count', kind: 'number', placeholder: '1000' },
  ],
  kafka: [
    { key: 'brokers', label: 'sinklabel.broker_addresses', kind: 'string', required: true, placeholder: '127.0.0.1:9092' },
    { key: 'topic', label: 'sinklabel.topic', kind: 'string', required: true, placeholder: 'alerts' },
    { key: 'saslAuthType', label: 'sinklabel.sasl_auth_type', kind: 'string', options: ['none', 'plain', 'scram-sha-256', 'scram-sha-512'] },
    { key: 'username', label: 'sinklabel.sasl_username', kind: 'string' },
    { key: 'password', label: 'sinklabel.sasl_password', kind: 'secret' },
  ],
  redis: [
    { key: 'addr', label: 'sinklabel.redis_address', kind: 'string', required: true, placeholder: '127.0.0.1:6379' },
    { key: 'topic', label: 'sinklabel.pub_sub_topic_key', kind: 'string', required: true, placeholder: 'events' },
    { key: 'db', label: 'sinklabel.database_index', kind: 'number', placeholder: '0' },
    { key: 'password', label: 'sinklabel.password', kind: 'secret' },
  ],
  websocket: [
    { key: 'url', label: 'sinklabel.websocket_url', kind: 'string', required: true, placeholder: 'ws://127.0.0.1:8080/ws' },
  ],
  neuron: [
    { key: 'url', label: 'sinklabel.neuron_url', kind: 'string', required: true, placeholder: 'tcp://127.0.0.1:7081' },
    { key: 'nodeName', label: 'sinklabel.target_node_name', kind: 'string', required: true },
    { key: 'groupName', label: 'sinklabel.target_group_name', kind: 'string', required: true },
  ],
};

function humanize(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (letter) => letter.toUpperCase());
}

function metadataKind(property: MetadataProperty): SinkFieldKind {
  if (SECRET_KEY.test(property.name)) return 'secret';
  const value = `${property.type} ${property.control}`.toLowerCase();
  if (/bool|switch|checkbox/.test(value)) return 'boolean';
  if (/array|list/.test(value)) return 'string-list';
  if (/int|float|number|duration/.test(value)) return 'number';
  if (/json|object|map|keyvalue/.test(value)) return 'json';
  return 'string';
}

export function toLabelString(val: unknown, lang: 'en' | 'zh' = 'en'): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    const obj = val as Record<string, string>;
    if (lang === 'zh') {
      return obj.zh ?? obj.zh_CN ?? obj['zh-CN'] ?? obj.en ?? obj.en_US ?? obj['en-US'] ?? Object.values(obj)[0] ?? '';
    }
    return obj.en ?? obj.en_US ?? obj['en-US'] ?? Object.values(obj)[0] ?? '';
  }
  return String(val);
}

export function sinkFields(
  type: string,
  metadata: MetadataProperty[] = [],
  lang: 'en' | 'zh' = 'en',
): SinkFieldDefinition[] {
  const merged = new Map<string, SinkFieldDefinition>();
  for (const field of [...(KNOWN_FIELDS[type] ?? []), ...COMMON_FIELDS]) merged.set(field.key, field);
  const effectiveMetadata = metadata.length > 0 ? metadata : getBuiltinConnectorProperties('sinks', type);
  for (const property of effectiveMetadata) {
    const existing = merged.get(property.name);
    merged.set(property.name, {
      key: property.name,
      label: toLabelString(property.label, lang) || existing?.label || humanize(property.name),
      kind: existing?.kind ?? metadataKind(property),
      required: existing?.required ?? !property.optional,
      options: property.values?.map(String) ?? existing?.options,
      hint: toLabelString(property.hint, lang) || existing?.hint,
      placeholder: existing?.placeholder,
    });
  }
  return [...merged.values()];
}

export function coerceFieldValue(kind: SinkFieldKind, value: string | boolean): unknown {
  if (kind === 'boolean') return Boolean(value === true || value === 'true');
  const text = String(value);
  if (kind === 'number') {
    if (!text.trim()) return undefined;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : text;
  }
  if (kind === 'string-list') {
    return text.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
  }
  if (kind === 'json') {
    if (!text.trim()) return undefined;
    return JSON.parse(text) as unknown;
  }
  return text;
}

export function displayFieldValue(kind: SinkFieldKind, value: unknown): string {
  if (value == null) return '';
  if (kind === 'string-list' && Array.isArray(value)) return value.map(String).join('\n');
  if (kind === 'json' && typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

export function decodeActions(actions: Sink[]): ActionDraft[] {
  return actions.map((action, index) => {
    const record = action as unknown as JsonObject;
    const type = Object.keys(record).find((key) => !COMMON_ACTION_KEYS.has(key) && typeof record[key] === 'object')
      ?? Object.keys(record)[0]
      ?? 'log';
    const value = record[type];
    const config = value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as JsonObject) } : {};
    const outer = Object.fromEntries(Object.entries(record).filter(([key]) => key !== type));
    return { key: `action-${index}-${type}`, type, config, outer };
  });
}

export function encodeActions(actions: ActionDraft[]): Sink[] {
  return actions.map(({ type, config, outer }) => ({ ...outer, [type]: config }) as Sink);
}

export function buildSql(query: QueryDraft): string {
  const fields = query.fields.trim() || '*';
  const source = query.source.trim();
  if (!source) return '';
  return [
    `SELECT ${fields} FROM ${source}`,
    query.where.trim() && `WHERE ${query.where.trim()}`,
    query.groupBy.trim() && `GROUP BY ${query.groupBy.trim()}`,
    query.having.trim() && `HAVING ${query.having.trim()}`,
    query.orderBy.trim() && `ORDER BY ${query.orderBy.trim()}`,
    query.limit.trim() && `LIMIT ${query.limit.trim()}`,
  ].filter(Boolean).join(' ');
}

export interface SqlSelection {
  start: number;
  end: number;
}

/** Index of the first top-level `FROM` keyword at or after `from`, or -1. Skips quotes and parentheses. */
function findTopLevelFrom(sql: string, from: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let index = from; index < sql.length; index += 1) {
    const char = sql[index] as string;
    if (quote !== null) {
      if (char === '\\' && index + 1 < sql.length) {
        index += 1;
        continue;
      }
      if (char === quote) {
        if (index + 1 < sql.length && sql[index + 1] === quote) {
          index += 1;
          continue;
        }
        quote = null;
      }
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
    } else if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth = Math.max(0, depth - 1);
    } else if (depth === 0 && /^from\b/i.test(sql.slice(index, index + 5)) && !/\w/.test(sql[index - 1] ?? ' ')) {
      return index;
    }
  }
  return -1;
}

/**
 * Insert a function signature into SQL text for the Rule Designer helper.
 *
 * - With an editor selection (caret or range): the signature replaces the
 *   selection, so the user decides where it goes.
 * - Without one: it is added to the SELECT list (replacing a lone `*`), never
 *   appended after the query, which would corrupt valid SQL.
 * - Empty SQL starts a new `SELECT ... FROM ` statement. SQL with no leading
 *   SELECT is returned unchanged because no safe insertion point exists.
 */
export function insertFunctionIntoSql(
  sql: string,
  signature: string,
  selection: SqlSelection | null,
): string {
  if (selection) {
    const start = Math.min(selection.start, sql.length);
    const end = Math.min(Math.max(selection.end, start), sql.length);
    return `${sql.slice(0, start)}${signature}${sql.slice(end)}`;
  }
  if (!sql.trim()) return `SELECT ${signature} FROM `;
  const select = /^\s*SELECT\b/i.exec(sql);
  if (!select) return sql;

  const listStart = select[0].length;
  const fromIndex = findTopLevelFrom(sql, listStart);
  const listEnd = fromIndex === -1 ? sql.trimEnd().length : fromIndex;
  const list = sql.slice(listStart, listEnd);
  const current = list.trim();
  const nextList = current === '' || current === '*' ? signature : `${current}, ${signature}`;
  const leading = /^\s*/.exec(list)?.[0] || ' ';
  const trailing = fromIndex === -1 ? '' : (/\s*$/.exec(list)?.[0] || ' ');
  return `${sql.slice(0, listStart)}${leading}${nextList}${trailing}${fromIndex === -1 ? '' : sql.slice(fromIndex)}`;
}

export function parseSimpleSql(sql: string): QueryDraft | null {
  const normalized = sql.trim().replace(/;$/, '');
  const match = normalized.match(/^SELECT\s+([\s\S]+?)\s+FROM\s+([A-Za-z0-9_-]+)(?:\s+WHERE\s+([\s\S]*?))?(?:\s+GROUP\s+BY\s+([\s\S]*?))?(?:\s+HAVING\s+([\s\S]*?))?(?:\s+ORDER\s+BY\s+([\s\S]*?))?(?:\s+LIMIT\s+([^\s]+))?$/i);
  if (!match) return null;
  return {
    fields: match[1]?.trim() || '*',
    source: match[2]?.trim() || '',
    where: match[3]?.trim() || '',
    groupBy: match[4]?.trim() || '',
    having: match[5]?.trim() || '',
    orderBy: match[6]?.trim() || '',
    limit: match[7]?.trim() || '',
  };
}

export function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as JsonObject).map(([key, entry]) => [
    key,
    SECRET_KEY.test(key) && entry !== '' && entry != null ? '••••••••' : redactSensitive(entry),
  ]));
}

export function duplicateRule(source: Rule, id: string): Rule {
  const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
  const rule: Rule = {
    id,
    triggered: false,
    actions: copy(source.actions ?? []),
  };
  if (source.sql != null) rule.sql = source.sql;
  if (source.graph != null) rule.graph = copy(source.graph);
  if (source.options != null) rule.options = copy(source.options);
  if (source.tags != null) rule.tags = [...source.tags];
  if (source.temp != null) rule.temp = source.temp;
  return rule;
}
