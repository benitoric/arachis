-- Add show_in_portal column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS show_in_portal BOOLEAN DEFAULT false NOT NULL;
