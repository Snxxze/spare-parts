
-- Clear existing parts data and stock movements
DELETE FROM public.requisition_items;
DELETE FROM public.stock_movements;
DELETE FROM public.requisitions;
DELETE FROM public.parts;

-- Add category and unit columns
ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS unit TEXT;

-- Unique constraint on code
DO $$ BEGIN
  ALTER TABLE public.parts ADD CONSTRAINT parts_code_unique UNIQUE (code);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
