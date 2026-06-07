-- Add missing columns to analisis_servicios table
ALTER TABLE public.analisis_servicios 
ADD COLUMN IF NOT EXISTS especialidad text,
ADD COLUMN IF NOT EXISTS mutua text,
ADD COLUMN IF NOT EXISTS imp_servicio numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS imp_cita numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS duracion_media numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_desc numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_iva numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_ret numeric DEFAULT 0;