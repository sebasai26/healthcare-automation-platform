-- Add new columns for the updated AI analysis format
ALTER TABLE public.analisis_ia 
ADD COLUMN IF NOT EXISTS cosas_positivas jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS areas_mejora jsonb DEFAULT '[]'::jsonb;