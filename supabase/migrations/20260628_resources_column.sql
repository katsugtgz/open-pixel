-- W1.2: QuestRun.resources shape (off-chain village-loop resources).
-- Additive only. The legacy `shards` column is kept for back-compat so existing
-- Supabase rows and any in-flight bridge-period writes keep working. W3.1 will
-- emit the resources payload from the game; until then the web claim flow
-- populates both `resources` and `shards`.
--
-- Constraints mirror the canonical supabase/schema.sql shape for `points`
-- (NOT NULL + CHECK >= 0) and the QuestRunResources contract for `resources`
-- (3 required keys: popberry / whittlewood_log / ochrux_matrix, non-negative).

ALTER TABLE quest_runs
  ADD COLUMN IF NOT EXISTS resources jsonb NOT NULL DEFAULT '{"popberry":0,"whittlewood_log":0,"ochrux_matrix":0}'::jsonb,
  ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 0 CHECK (points >= 0);

ALTER TABLE quest_runs
  ADD CONSTRAINT IF NOT EXISTS quest_runs_resources_shape
  CHECK (
    resources ? 'popberry'
    AND resources ? 'whittlewood_log'
    AND resources ? 'ochrux_matrix'
    AND (resources->>'popberry')::int >= 0
    AND (resources->>'whittlewood_log')::int >= 0
    AND (resources->>'ochrux_matrix')::int >= 0
  );

COMMENT ON COLUMN quest_runs.resources IS 'Off-chain village-loop resources (W1.2). Legacy `shards` column kept for back-compat.';
