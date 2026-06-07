-- Tabla para objetivos mensuales basados en tendencias de 3 meses
CREATE TABLE IF NOT EXISTS public.objetivo_mensual (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  anio INTEGER NOT NULL,
  objetivo TEXT NOT NULL,
  contexto TEXT,
  tendencia_negativa_principal TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(mes, anio)
);

-- Habilitar RLS
ALTER TABLE public.objetivo_mensual ENABLE ROW LEVEL SECURITY;

-- Política para que admins puedan leer
CREATE POLICY "Admins pueden leer objetivos mensuales"
ON public.objetivo_mensual
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Política para que admins puedan insertar/actualizar
CREATE POLICY "Admins pueden gestionar objetivos mensuales"
ON public.objetivo_mensual
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Trigger para actualizar updated_at
CREATE TRIGGER update_objetivo_mensual_updated_at
BEFORE UPDATE ON public.objetivo_mensual
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();