ALTER TABLE flows
  ADD COLUMN IF NOT EXISTS engine_dialect text NOT NULL DEFAULT 'ekuiper'
    CHECK (engine_dialect IN ('ekuiper', 'rekuiper')),
  ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 1;

ALTER TABLE flow_revisions
  ADD COLUMN IF NOT EXISTS engine_dialect text NOT NULL DEFAULT 'ekuiper'
    CHECK (engine_dialect IN ('ekuiper', 'rekuiper')),
  ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 1;

ALTER TABLE flow_deployments
  ADD COLUMN IF NOT EXISTS engine_dialect text NOT NULL DEFAULT 'ekuiper'
    CHECK (engine_dialect IN ('ekuiper', 'rekuiper')),
  ADD COLUMN IF NOT EXISTS profile_id text,
  ADD COLUMN IF NOT EXISTS compiler_version text;

