-- Migration 011: Add guest_city to orders table for portal orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS guest_city TEXT;
