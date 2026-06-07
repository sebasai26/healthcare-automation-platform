-- Create analisis_servicios table
CREATE TABLE public.analisis_servicios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  clinica TEXT NOT NULL,
  servicio TEXT NOT NULL,
  num_citas INTEGER DEFAULT 0,
  importe_total NUMERIC DEFAULT 0,
  total_base NUMERIC DEFAULT 0,
  anio INTEGER NOT NULL DEFAULT 2025,
  mes TEXT,
  UNIQUE(clinica, servicio, anio, mes)
);

-- Create balance_mensual table
CREATE TABLE public.balance_mensual (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  clinic_id TEXT NOT NULL,
  mes TEXT NOT NULL,
  anio INTEGER NOT NULL DEFAULT 2025,
  total NUMERIC DEFAULT 0,
  UNIQUE(clinic_id, mes, anio)
);

-- Create balance_profesional table
CREATE TABLE public.balance_profesional (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  clinic_id TEXT NOT NULL,
  usuario TEXT NOT NULL,
  mes TEXT NOT NULL,
  anio INTEGER NOT NULL DEFAULT 2025,
  total NUMERIC DEFAULT 0,
  UNIQUE(clinic_id, usuario, mes, anio)
);

-- Create citas_profesional table
CREATE TABLE public.citas_profesional (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  usuario TEXT NOT NULL,
  anio INTEGER NOT NULL DEFAULT 2025,
  enero INTEGER DEFAULT 0,
  febrero INTEGER DEFAULT 0,
  marzo INTEGER DEFAULT 0,
  abril INTEGER DEFAULT 0,
  mayo INTEGER DEFAULT 0,
  junio INTEGER DEFAULT 0,
  julio INTEGER DEFAULT 0,
  agosto INTEGER DEFAULT 0,
  septiembre INTEGER DEFAULT 0,
  octubre INTEGER DEFAULT 0,
  noviembre INTEGER DEFAULT 0,
  diciembre INTEGER DEFAULT 0,
  UNIQUE(usuario, anio)
);

-- Create ocupacion_profesional table
CREATE TABLE public.ocupacion_profesional (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  usuario TEXT NOT NULL,
  anio INTEGER NOT NULL DEFAULT 2025,
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
  UNIQUE(usuario, anio)
);

-- Enable RLS on all tables
ALTER TABLE public.analisis_servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balance_mensual ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balance_profesional ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citas_profesional ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocupacion_profesional ENABLE ROW LEVEL SECURITY;

-- Create public read/write policies for all tables (same as horas_profesional)
CREATE POLICY "Permitir lectura pública" ON public.analisis_servicios FOR SELECT USING (true);
CREATE POLICY "Permitir inserción pública" ON public.analisis_servicios FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualización pública" ON public.analisis_servicios FOR UPDATE USING (true);
CREATE POLICY "Permitir eliminación pública" ON public.analisis_servicios FOR DELETE USING (true);

CREATE POLICY "Permitir lectura pública" ON public.balance_mensual FOR SELECT USING (true);
CREATE POLICY "Permitir inserción pública" ON public.balance_mensual FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualización pública" ON public.balance_mensual FOR UPDATE USING (true);
CREATE POLICY "Permitir eliminación pública" ON public.balance_mensual FOR DELETE USING (true);

CREATE POLICY "Permitir lectura pública" ON public.balance_profesional FOR SELECT USING (true);
CREATE POLICY "Permitir inserción pública" ON public.balance_profesional FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualización pública" ON public.balance_profesional FOR UPDATE USING (true);
CREATE POLICY "Permitir eliminación pública" ON public.balance_profesional FOR DELETE USING (true);

CREATE POLICY "Permitir lectura pública" ON public.citas_profesional FOR SELECT USING (true);
CREATE POLICY "Permitir inserción pública" ON public.citas_profesional FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualización pública" ON public.citas_profesional FOR UPDATE USING (true);
CREATE POLICY "Permitir eliminación pública" ON public.citas_profesional FOR DELETE USING (true);

CREATE POLICY "Permitir lectura pública" ON public.ocupacion_profesional FOR SELECT USING (true);
CREATE POLICY "Permitir inserción pública" ON public.ocupacion_profesional FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualización pública" ON public.ocupacion_profesional FOR UPDATE USING (true);
CREATE POLICY "Permitir eliminación pública" ON public.ocupacion_profesional FOR DELETE USING (true);