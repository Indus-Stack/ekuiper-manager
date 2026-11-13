ALTER TABLE managed_nodes
  ADD COLUMN IF NOT EXISTS engine_preference text NOT NULL DEFAULT 'auto'
    CHECK (engine_preference IN ('auto', 'ekuiper', 'rekuiper')),
  ADD COLUMN IF NOT EXISTS detected_family text
    CHECK (detected_family IN ('ekuiper', 'rekuiper')),
  ADD COLUMN IF NOT EXISTS profile_id text,
  ADD COLUMN IF NOT EXISTS profile_revision integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS operation_mode text NOT NULL DEFAULT 'unknown'
    CHECK (operation_mode IN ('imperative', 'declarative', 'unknown')),
  ADD COLUMN IF NOT EXISTS operation_mode_override text
    CHECK (operation_mode_override IN ('imperative', 'declarative')),
  ADD COLUMN IF NOT EXISTS deployment_role text NOT NULL DEFAULT 'unknown'
    CHECK (deployment_role IN ('standalone', 'fleet_hub', 'fleet_device', 'unknown')),
  ADD COLUMN IF NOT EXISTS connection_state text NOT NULL DEFAULT 'unknown'
    CHECK (connection_state IN ('unknown', 'reachable', 'offline')),
  ADD COLUMN IF NOT EXISTS authorization_state text NOT NULL DEFAULT 'unknown'
    CHECK (authorization_state IN ('unknown', 'authorized', 'auth_required', 'forbidden')),
  ADD COLUMN IF NOT EXISTS identity_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS profile_checked_at timestamptz;

