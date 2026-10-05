-- Delta migration for already-provisioned databases. Apply by hand once:
--   psql -d family_tree -f backend/migrations/002_add_memory_tags_emotion_people.sql
-- Fresh installs get this automatically via backend/schema.sql.

ALTER TABLE memories ADD COLUMN IF NOT EXISTS tags VARCHAR(50)[] DEFAULT '{}';
ALTER TABLE memories ADD COLUMN IF NOT EXISTS emotion VARCHAR(10);
ALTER TABLE memories ADD COLUMN IF NOT EXISTS people_involved VARCHAR(255);
