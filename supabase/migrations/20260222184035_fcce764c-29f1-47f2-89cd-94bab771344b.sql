
-- Table to store accounting data from CSV (each row = one line item with monthly values)
CREATE TABLE public.contabilidad_clinica (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  anio INTEGER NOT NULL DEFAULT 2025,
  seccion TEXT NOT NULL, -- Secciones contables: FIJOS, EMPLEADOS, VARIABLES, INGRESOS, PROFESIONAL_1..N, RESUMEN
  concepto TEXT NOT NULL, -- Nombre del concepto contable (e.g. Alquiler, Suministros, INGRESO, BENEFICIO REAL, etc.)
  enero NUMERIC DEFAULT 0,
  febrero NUMERIC DEFAULT 0,
  marzo NUMERIC DEFAULT 0,
  abril NUMERIC DEFAULT 0,
  mayo NUMERIC DEFAULT 0,
  junio NUMERIC DEFAULT 0,
  julio NUMERIC DEFAULT 0,
  agosto NUMERIC DEFAULT 0,
  septiembre NUMERIC DEFAULT 0,
  octubre NUMERIC DEFAULT 0,
  noviembre NUMERIC DEFAULT 0,
  diciembre NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(anio, seccion, concepto)
);

-- Enable RLS
ALTER TABLE public.contabilidad_clinica ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "admin_select_contabilidad_clinica" ON public.contabilidad_clinica FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_insert_contabilidad_clinica" ON public.contabilidad_clinica FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_update_contabilidad_clinica" ON public.contabilidad_clinica FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_delete_contabilidad_clinica" ON public.contabilidad_clinica FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
