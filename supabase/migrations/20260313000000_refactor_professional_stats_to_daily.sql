-- Drop existing monthly tables
DROP TABLE IF EXISTS public.citas_profesional;
DROP TABLE IF EXISTS public.horas_profesional;
DROP TABLE IF EXISTS public.ocupacion_profesional;

-- Create new daily tables
CREATE TABLE public.citas_profesional (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario TEXT NOT NULL,
    fecha DATE NOT NULL,
    num_citas INTEGER NOT NULL DEFAULT 0,
    anio INTEGER NOT NULL,
    mes TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.horas_profesional (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario TEXT NOT NULL,
    fecha DATE NOT NULL,
    horas NUMERIC NOT NULL DEFAULT 0,
    anio INTEGER NOT NULL,
    mes TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.ocupacion_profesional (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario TEXT NOT NULL,
    fecha DATE NOT NULL,
    valor_ocupacion NUMERIC NOT NULL DEFAULT 0,
    anio INTEGER NOT NULL,
    mes TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Unique constraints to prevent duplicate entries for the same physio on the same day
ALTER TABLE public.citas_profesional ADD CONSTRAINT citas_profesional_usuario_fecha_key UNIQUE (usuario, fecha);
ALTER TABLE public.horas_profesional ADD CONSTRAINT horas_profesional_usuario_fecha_key UNIQUE (usuario, fecha);
ALTER TABLE public.ocupacion_profesional ADD CONSTRAINT ocupacion_profesional_usuario_fecha_key UNIQUE (usuario, fecha);

-- Enable RLS
ALTER TABLE public.citas_profesional ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horas_profesional ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocupacion_profesional ENABLE ROW LEVEL SECURITY;

-- Public access policies (read/write)
CREATE POLICY "Permitir lectura pública" ON public.citas_profesional FOR SELECT USING (true);
CREATE POLICY "Permitir inserción pública" ON public.citas_profesional FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualización pública" ON public.citas_profesional FOR UPDATE USING (true);
CREATE POLICY "Permitir eliminación pública" ON public.citas_profesional FOR DELETE USING (true);

CREATE POLICY "Permitir lectura pública" ON public.horas_profesional FOR SELECT USING (true);
CREATE POLICY "Permitir inserción pública" ON public.horas_profesional FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualización pública" ON public.horas_profesional FOR UPDATE USING (true);
CREATE POLICY "Permitir eliminación pública" ON public.horas_profesional FOR DELETE USING (true);

CREATE POLICY "Permitir lectura pública" ON public.ocupacion_profesional FOR SELECT USING (true);
CREATE POLICY "Permitir inserción pública" ON public.ocupacion_profesional FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualización pública" ON public.ocupacion_profesional FOR UPDATE USING (true);
CREATE POLICY "Permitir eliminación pública" ON public.ocupacion_profesional FOR DELETE USING (true);
