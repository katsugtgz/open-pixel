-- W1.2: QuestRun.resources shape (off-chain village-loop resources).
-- Additive only. The legacy `shards` column is kept for back-compat so existing
-- Supabase rows and any in-flight bridge-period writes keep working. W3.1 will
-- emit the resources payload from the game; until then the web claim flow
-- populates both `resources` and `shards`.

ALTER TABLE quest_runs
  ADD COLUMN IF NOT EXISTS resources jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS points int DEFAULT 0;

COMMENT ON COLUMN quest_runs.resources IS 'Off-chain village-loop resources (W1.2). Legacy `shards` column kept for back-compat.';
