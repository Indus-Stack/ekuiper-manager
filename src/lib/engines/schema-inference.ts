import type { EngineFamily } from './types';

export interface InferredField {
  name: string;
  type: 'bigint' | 'float' | 'boolean' | 'string' | 'array' | 'struct';
  nullable?: boolean;
}

function inferValueType(value: unknown): InferredField['type'] {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return Number.isInteger(value) ? 'bigint' : 'float';
  if (Array.isArray(value)) return 'array';
  if (value !== null && typeof value === 'object') return 'struct';
  return 'string';
}

/**
 * Infer typed stream/table fields from a sample JSON object or array of objects.
 */
export function inferSchemaFromSampleJson(sample: unknown): InferredField[] {
  const target = Array.isArray(sample) ? sample.find((item) => item && typeof item === 'object') : sample;
  if (!target || typeof target !== 'object' || Array.isArray(target)) {
    return [];
  }
  return Object.entries(target as Record<string, unknown>).map(([name, value]) => ({
    name,
    type: inferValueType(value),
    nullable: value === null,
  }));
}

export function buildStreamDdlPreview(input: {
  engineFamily: EngineFamily;
  kind: 'stream' | 'table';
  name: string;
  fields: InferredField[];
  sourceType: string;
  datasource: string;
  format?: string;
  shared?: boolean;
  options?: Record<string, string | number | boolean>;
}): string {
  const safeName = input.name.trim() || 'sample_stream';
  const keyword = input.kind === 'table' ? 'TABLE' : 'STREAM';
  const fieldDefs = input.fields.length
    ? input.fields.map((f) => `  ${f.name} ${f.type}`).join(',\n')
    : '';
  const withParts: string[] = [
    `TYPE="${input.sourceType}"`,
    `DATASOURCE="${input.datasource}"`,
    `FORMAT="${input.format ?? 'json'}"`,
  ];
  if (input.shared) withParts.push('SHARED="true"');
  if (input.options) {
    for (const [k, v] of Object.entries(input.options)) {
      if (v === undefined || v === null || v === '') continue;
      withParts.push(typeof v === 'string' ? `${k}="${v}"` : `${k}=${String(v)}`);
    }
  }
  const body = fieldDefs ? `(\n${fieldDefs}\n)` : '()';
  const comment = input.engineFamily === 'rekuiper' ? '-- reKuiper DDL preview\n' : '-- eKuiper DDL preview\n';
  return `${comment}CREATE ${keyword} ${safeName} ${body} WITH (${withParts.join(', ')});`;
}

