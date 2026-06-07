-- Create table for manually added extra appointments
CREATE TABLE IF NOT EXISTS public.citas_extras_profesional (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario TEXT NOT NULL,
    fecha DATE NOT NULL,
    duracion NUMERIC NOT NULL DEFAULT 1.0, -- default 1 hour
    anio INTEGER NOT NULL,
    mes TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.citas_extras_profesional ENABLE ROW LEVEL SECURITY;

-- Public access policies (read/write)
CREATE POLICY "Permitir lectura pública citas extras" ON public.citas_extras_profesional FOR SELECT USING (true);
CREATE POLICY "Permitir inserción pública citas extras" ON public.citas_extras_profesional FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualización pública citas extras" ON public.citas_extras_profesional FOR UPDATE USING (true);
CREATE POLICY "Permitir eliminación pública citas extras" ON public.citas_extras_profesional FOR DELETE USING (true);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_citas_extras_usuario_fecha ON public.citas_extras_profesional(usuario, fecha);
