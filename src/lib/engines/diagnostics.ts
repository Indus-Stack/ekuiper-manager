export type DlqStage = 'codec' | 'schema' | 'sql' | 'template' | 'sink' | 'unknown';

export interface DlqRecord {
  id: string;
  stage: DlqStage;
  message: string;
  payload?: unknown;
  timestamp?: string;
}

export interface DlqSummary {
  ruleName: string;
  stageCounts: Record<DlqStage, number>;
  recentRecords: DlqRecord[];
  replaySupported: boolean;
}

const VALID_STAGES = new Set<DlqStage>(['codec', 'schema', 'sql', 'template', 'sink']);

export function normalizeDlqResponse(ruleName: string, raw: unknown): DlqSummary {
  const stageCounts: Record<DlqStage, number> = {
    codec: 0,
    schema: 0,
    sql: 0,
    template: 0,
    sink: 0,
    unknown: 0,
  };
  const recentRecords: DlqRecord[] = [];

  const records = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).errors)
      ? ((raw as Record<string, unknown>).errors as unknown[])
      : raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).records)
        ? ((raw as Record<string, unknown>).records as unknown[])
        : [];

  records.slice(0, 100).forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const rec = item as Record<string, unknown>;
    const rawStage = String(rec.stage ?? 'unknown').toLowerCase() as DlqStage;
    const stage: DlqStage = VALID_STAGES.has(rawStage) ? rawStage : 'unknown';
    stageCounts[stage] += 1;
    recentRecords.push({
      id: String(rec.id ?? `${ruleName}-${index}`),
      stage,
      message: String(rec.error ?? rec.message ?? 'Unknown error'),
      payload: rec.payload ?? rec.data,
      timestamp: rec.timestamp ? String(rec.timestamp) : undefined,
    });
  });

  return {
    ruleName,
    stageCounts,
    recentRecords,
    replaySupported: false, // Verified: no replay endpoint in pinned reKuiper build
  };
}

export type IngestionTemplateId = 'otlp-metrics' | 'otlp-logs' | 'otlp-traces' | 'stream-json';

export interface IngestionTemplate {
  id: IngestionTemplateId;
  label: string;
  endpointPath: (resourceName?: string) => string;
  mutatesLivePipeline: boolean;
  sampleBody: Record<string, unknown>;
}

export const INGESTION_TEMPLATES: IngestionTemplate[] = [
  {
    id: 'otlp-metrics',
    label: 'OTLP Metrics (/otlp/v1/metrics)',
    endpointPath: () => '/otlp/v1/metrics',
    mutatesLivePipeline: true,
    sampleBody: {
      resourceMetrics: [
        {
          resource: { attributes: [{ key: 'service.name', value: { stringValue: 'edge-gateway' } }] },
          scopeMetrics: [{ metrics: [{ name: 'cpu_usage', gauge: { dataPoints: [{ asDouble: 42.5 }] } }] }],
        },
      ],
    },
  },
  {
    id: 'otlp-logs',
    label: 'OTLP Logs (/otlp/v1/logs)',
    endpointPath: () => '/otlp/v1/logs',
    mutatesLivePipeline: true,
    sampleBody: {
      resourceLogs: [
        {
          scopeLogs: [{ logRecords: [{ body: { stringValue: 'Sensor heartbeat OK' } }] }],
        },
      ],
    },
  },
  {
    id: 'otlp-traces',
    label: 'OTLP Traces (/otlp/v1/traces)',
    endpointPath: () => '/otlp/v1/traces',
    mutatesLivePipeline: true,
    sampleBody: {
      resourceSpans: [
        {
          scopeSpans: [{ spans: [{ name: 'ingest-span', traceId: '0102030405060708090a0b0c0d0e0f10', spanId: '0102030405060708' }] }],
        },
      ],
    },
  },
  {
    id: 'stream-json',
    label: 'Stream Data Injection (/streams/{name}/data)',
    endpointPath: (name = 'demo_stream') => `/streams/${encodeURIComponent(name)}/data`,
    mutatesLivePipeline: true,
    sampleBody: {
      deviceId: 'sensor-01',
      temperature: 72.4,
      ts: 1731438000000,
    },
  },
];

