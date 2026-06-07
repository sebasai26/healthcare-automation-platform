-- Tabla para almacenar análisis IA generados (máximo 1 por semana)
CREATE TABLE public.analisis_ia (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  semana INT NOT NULL, -- Número de semana del año (1-52)
  anio INT NOT NULL,
  diagnostico TEXT,
  problemas JSONB, -- Array de problemas detectados
  oportunidades JSONB, -- Array de oportunidades
  acciones JSONB, -- Array de acciones recomendadas
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(semana, anio) -- Solo 1 análisis por semana
);

-- RLS: Por ahora público ya que no hay auth implementado
ALTER TABLE public.analisis_ia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura pública de análisis" 
ON public.analisis_ia 
FOR SELECT 
USING (true);

CREATE POLICY "Permitir inserción pública de análisis" 
ON public.analisis_ia 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Permitir actualización pública de análisis" 
ON public.analisis_ia 
FOR UPDATE 
USING (true);