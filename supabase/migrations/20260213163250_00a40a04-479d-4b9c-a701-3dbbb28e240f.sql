
-- Table for birthday+inactive patient matches, consumed by n8n
CREATE TABLE public.cumple_inactivos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_paciente TEXT,
  nh TEXT,
  nombre TEXT NOT NULL,
  apellidos TEXT,
  telefono TEXT NOT NULL,
  fecha_nacimiento DATE,
  ultima_cita DATE,
  dias_inactivo INTEGER NOT NULL,
  procesado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cumple_inactivos ENABLE ROW LEVEL SECURITY;

-- Admin policies
CREATE POLICY "admin_select_cumple_inactivos" ON public.cumple_inactivos FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_insert_cumple_inactivos" ON public.cumple_inactivos FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_update_cumple_inactivos" ON public.cumple_inactivos FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_delete_cumple_inactivos" ON public.cumple_inactivos FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
