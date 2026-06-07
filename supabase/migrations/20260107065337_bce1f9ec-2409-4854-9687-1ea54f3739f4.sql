-- Drop existing constraint and create new one without 'mes'
ALTER TABLE public.analisis_servicios DROP CONSTRAINT IF EXISTS analisis_servicios_clinica_servicio_anio_mes_key;

-- Create new unique constraint without mes
CREATE UNIQUE INDEX IF NOT EXISTS analisis_servicios_clinica_servicio_anio_key 
ON public.analisis_servicios (clinica, servicio, anio);