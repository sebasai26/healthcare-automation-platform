-- Crear tabla para listado de citas
CREATE TABLE public.listado_citas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  estado TEXT NOT NULL,
  fecha_cita DATE NOT NULL,
  fecha_creacion DATE,
  accion_id TEXT,
  asunto TEXT,
  paciente_nombre TEXT,
  paciente_telefono TEXT,
  servicio TEXT,
  agenda TEXT NOT NULL,
  tipo TEXT,
  importe NUMERIC DEFAULT 0,
  sala_box TEXT,
  confirmada BOOLEAN DEFAULT false,
  procedencia TEXT,
  anio INTEGER NOT NULL,
  mes TEXT NOT NULL,
  semana INTEGER,
  clinic_id TEXT NOT NULL DEFAULT 'default',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.listado_citas ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Permitir lectura pública" 
ON public.listado_citas 
FOR SELECT 
USING (true);

CREATE POLICY "Permitir inserción pública" 
ON public.listado_citas 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Permitir actualización pública" 
ON public.listado_citas 
FOR UPDATE 
USING (true);

CREATE POLICY "Permitir eliminación pública" 
ON public.listado_citas 
FOR DELETE 
USING (true);

-- Create indexes for filtering
CREATE INDEX idx_listado_citas_fecha ON public.listado_citas(fecha_cita);
CREATE INDEX idx_listado_citas_anio_mes ON public.listado_citas(anio, mes);
CREATE INDEX idx_listado_citas_estado ON public.listado_citas(estado);