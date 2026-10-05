-- last_name was NOT NULL, but the "Add Member" form has never required it
-- (only first_name is required client-side) — every submission with a
-- blank last name was silently rejected by the backend with no clear
-- error surfaced to the user. Relaxing the constraint to match the UI.
ALTER TABLE persons ALTER COLUMN last_name DROP NOT NULL;
