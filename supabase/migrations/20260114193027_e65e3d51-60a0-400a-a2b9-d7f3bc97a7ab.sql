-- Añadir campo para el objetivo del mes en análisis IA
ALTER TABLE public.analisis_ia 
ADD COLUMN IF NOT EXISTS objetivo_mes TEXT,
ADD COLUMN IF NOT EXISTS objetivo_mes_contexto TEXT;