-- Delta migration for already-provisioned databases. No migration runner
-- exists in this project; apply by hand once per database:
--   psql -d family_tree -f backend/migrations/001_add_family_collaborators.sql
-- Fresh installs get this automatically via backend/schema.sql, which
-- contains the identical block below.

-- Collaborators: users other than the family owner (families.created_by)
-- who have been granted viewer or editor access to a family.
CREATE TABLE IF NOT EXISTS family_collaborators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('viewer', 'editor')),
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_family_collaborator UNIQUE (family_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_family_collaborators_family_id ON family_collaborators(family_id);
CREATE INDEX IF NOT EXISTS idx_family_collaborators_user_id ON family_collaborators(user_id);
