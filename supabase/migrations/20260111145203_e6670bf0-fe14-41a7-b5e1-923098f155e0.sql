-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create table for clinic configuration/context
CREATE TABLE public.clinic_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clinic_config ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write config
CREATE POLICY "admin_select_clinic_config" 
ON public.clinic_config 
FOR SELECT 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_insert_clinic_config" 
ON public.clinic_config 
FOR INSERT 
TO authenticated 
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_update_clinic_config" 
ON public.clinic_config 
FOR UPDATE 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_delete_clinic_config" 
ON public.clinic_config 
FOR DELETE 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_clinic_config_updated_at
BEFORE UPDATE ON public.clinic_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert the clinic context
INSERT INTO public.clinic_config (key, value) VALUES 
('clinic_context', 'CONTEXTO DE LA CLÍNICA MARBELLAFISIO:

POLÍTICAS Y PROCESOS ACTUALES (NO SUGERIR ESTAS SOLUCIONES):
1. Política de cancelación: Se cobra el 50% del importe si el paciente cancela con menos de 6 horas de antelación
2. Recordatorios: Se envían recordatorios automáticos el día anterior a la cita
3. Gestión de huecos: Los huecos disponibles se publican ocasionalmente en estados de WhatsApp

INSTRUCCIONES PARA EL ANÁLISIS:
- NO proponer soluciones idénticas a las ya implementadas
- Ser creativo y proponer alternativas innovadoras
- Enfocarse en mejoras complementarias, no en reemplazar lo que funciona
- Si se detecta un problema relacionado con cancelaciones/recordatorios, buscar ángulos diferentes a los ya cubiertos');