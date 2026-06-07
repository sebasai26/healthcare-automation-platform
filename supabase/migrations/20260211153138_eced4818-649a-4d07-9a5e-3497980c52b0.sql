
-- Create table for patient demographics (from birthday CSV import)
CREATE TABLE public.pacientes_demograficos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nh TEXT NOT NULL,
  nombre TEXT NOT NULL,
  apellidos TEXT,
  sexo TEXT NOT NULL DEFAULT 'DESCONOCIDO',
  fecha_nacimiento DATE,
  telefono TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint on nh (patient number)
ALTER TABLE public.pacientes_demograficos ADD CONSTRAINT pacientes_demograficos_nh_unique UNIQUE (nh);

-- Enable RLS
ALTER TABLE public.pacientes_demograficos ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "admin_select_pacientes_demograficos" ON public.pacientes_demograficos
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_insert_pacientes_demograficos" ON public.pacientes_demograficos
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_update_pacientes_demograficos" ON public.pacientes_demograficos
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_delete_pacientes_demograficos" ON public.pacientes_demograficos
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for common queries
CREATE INDEX idx_pacientes_demograficos_sexo ON public.pacientes_demograficos(sexo);
