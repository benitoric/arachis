-- Migration 010: Split quotes.client_name into client_first_name + client_last_name
-- Also add client_id FK for linking accepted quotes to clients table

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS client_first_name TEXT,
  ADD COLUMN IF NOT EXISTS client_last_name  TEXT,
  ADD COLUMN IF NOT EXISTS client_id         UUID REFERENCES clients(id) ON DELETE SET NULL;

-- Populate from existing client_name
-- Strategy: last word → last_name, rest → first_name
UPDATE quotes
SET
  client_last_name  = CASE
    WHEN client_name ~ '\s'
      THEN regexp_replace(client_name, '^.*\s', '')
    ELSE client_name
  END,
  client_first_name = CASE
    WHEN client_name ~ '\s'
      THEN regexp_replace(client_name, '\s[^\s]+$', '')
    ELSE ''
  END
WHERE client_last_name IS NULL;

-- Index for client_id FK
CREATE INDEX IF NOT EXISTS idx_quotes_client_id ON quotes(client_id);
