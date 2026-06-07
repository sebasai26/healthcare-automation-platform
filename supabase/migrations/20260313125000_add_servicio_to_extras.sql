-- Add servicio column to citas_extras_profesional
ALTER TABLE public.citas_extras_profesional 
ADD COLUMN IF NOT EXISTS servicio TEXT;

-- Update index to include servicio if needed, but for now simple addition is enough
