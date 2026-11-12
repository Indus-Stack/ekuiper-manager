import type { EngineFamily } from './types';

export interface PipelineRecipe {
  id: string;
  title: string;
  description: string;
  engines: EngineFamily[];
  requiredCapabilities: string[];
  sourceType: string;
  sinkType: string;
  sqlTemplate: string;
}

export const PIPELINE_RECIPES: PipelineRecipe[] = [
  {
    id: 'mqtt-filter-log',
    title: 'MQTT Telemetry Filter to Log',
    description: 'Ingest MQTT JSON payloads, filter threshold violations, and write to rule log.',
    engines: ['ekuiper', 'rekuiper'],
    requiredCapabilities: ['rules.sql'],
    sourceType: 'mqtt',
    sinkType: 'log',
    sqlTemplate: 'SELECT * FROM mqtt_stream WHERE temperature > 80',
  },
  {
    id: 'simulator-window-agg',
    title: 'Simulator Tumbling Window Aggregation',
    description: 'Generate synthetic industrial telemetry and compute 10-second averages.',
    engines: ['rekuiper'],
    requiredCapabilities: ['rules.sql'],
    sourceType: 'simulator',
    sinkType: 'log',
    sqlTemplate: 'SELECT deviceId, avg(value) AS avg_val FROM sim_stream GROUP BY deviceId, TUMBLINGWINDOW(ss, 10)',
  },
  {
    id: 'http-push-rest-sink',
    title: 'HTTP Push to REST Webhook',
    description: 'Receive JSON events over HTTP push and forward alerts to a REST endpoint.',
    engines: ['ekuiper', 'rekuiper'],
    requiredCapabilities: ['rules.sql'],
    sourceType: 'httppush',
    sinkType: 'rest',
    sqlTemplate: 'SELECT * FROM push_stream',
  },
];

export function filterRecipesForTarget(input: {
  engineFamily: EngineFamily | null;
  capabilities?: Record<string, boolean>;
}): PipelineRecipe[] {
  if (!input.engineFamily) return [];
  return PIPELINE_RECIPES.filter((recipe) => {
    if (!recipe.engines.includes(input.engineFamily!)) return false;
    return recipe.requiredCapabilities.every((cap) => input.capabilities?.[cap] !== false);
  });
}

export interface StagedResourceStep {
  kind: 'connection' | 'schema' | 'stream' | 'rule';
  name: string;
  execute: () => Promise<void>;
  rollback?: () => Promise<void>;
}

export interface StagedDeployResult {
  success: boolean;
  created: Array<{ kind: string; name: string }>;
  failed?: { kind: string; name: string; error: string };
}

/**
 * Execute guided pipeline creation step-by-step and report exact per-resource
 * outcomes on partial failure (no hidden single-transaction claim).
 */
export async function executeStagedPipelineDeploy(
  steps: StagedResourceStep[],
): Promise<StagedDeployResult> {
  const created: Array<{ kind: string; name: string }> = [];
  for (const step of steps) {
    try {
      await step.execute();
      created.push({ kind: step.kind, name: step.name });
    } catch (error) {
      return {
        success: false,
        created,
        failed: {
          kind: step.kind,
          name: step.name,
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }
  return { success: true, created };
}

