CREATE TABLE IF NOT EXISTS product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  storage_path TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id, position);

-- Migrate existing image_url values into the new table
INSERT INTO product_images (product_id, url, storage_path, position)
SELECT id, image_url, NULL, 0
FROM products
WHERE image_url IS NOT NULL;
