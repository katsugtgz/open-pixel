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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'quest_runs_resources_shape'
      AND conrelid = 'quest_runs'::regclass
  ) THEN
    ALTER TABLE quest_runs
      ADD CONSTRAINT quest_runs_resources_shape
      CHECK (
        jsonb_typeof(resources) = 'object'
        AND resources ? 'popberry'
        AND resources ? 'whittlewood_log'
        AND resources ? 'ochrux_matrix'
        AND jsonb_typeof(resources->'popberry') = 'number'
        AND jsonb_typeof(resources->'whittlewood_log') = 'number'
        AND jsonb_typeof(resources->'ochrux_matrix') = 'number'
        AND (resources->>'popberry')::int >= 0
        AND (resources->>'whittlewood_log')::int >= 0
        AND (resources->>'ochrux_matrix')::int >= 0
      );
  END IF;
END $$;

COMMENT ON COLUMN quest_runs.resources IS 'Off-chain village-loop resources (W1.2). Legacy `shards` column kept for back-compat.';
