-- Enable RLS on all tables
ALTER TABLE public.analisis_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analisis_servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balance_mensual ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balance_profesional ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citas_profesional ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horas_profesional ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listado_citas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocupacion_profesional ENABLE ROW LEVEL SECURITY;

-- Create policies: Only authenticated users can read data
CREATE POLICY "Authenticated users can read analisis_ia" 
ON public.analisis_ia FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert analisis_ia" 
ON public.analisis_ia FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can read analisis_servicios" 
ON public.analisis_servicios FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert analisis_servicios" 
ON public.analisis_servicios FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete analisis_servicios" 
ON public.analisis_servicios FOR DELETE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can read balance_mensual" 
ON public.balance_mensual FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert balance_mensual" 
ON public.balance_mensual FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update balance_mensual" 
ON public.balance_mensual FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can delete balance_mensual" 
ON public.balance_mensual FOR DELETE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can read balance_profesional" 
ON public.balance_profesional FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert balance_profesional" 
ON public.balance_profesional FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update balance_profesional" 
ON public.balance_profesional FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can delete balance_profesional" 
ON public.balance_profesional FOR DELETE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can read citas_profesional" 
ON public.citas_profesional FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert citas_profesional" 
ON public.citas_profesional FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update citas_profesional" 
ON public.citas_profesional FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can delete citas_profesional" 
ON public.citas_profesional FOR DELETE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can read horas_profesional" 
ON public.horas_profesional FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert horas_profesional" 
ON public.horas_profesional FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update horas_profesional" 
ON public.horas_profesional FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can delete horas_profesional" 
ON public.horas_profesional FOR DELETE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can read listado_citas" 
ON public.listado_citas FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert listado_citas" 
ON public.listado_citas FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update listado_citas" 
ON public.listado_citas FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can delete listado_citas" 
ON public.listado_citas FOR DELETE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can read ocupacion_profesional" 
ON public.ocupacion_profesional FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert ocupacion_profesional" 
ON public.ocupacion_profesional FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update ocupacion_profesional" 
ON public.ocupacion_profesional FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can delete ocupacion_profesional" 
ON public.ocupacion_profesional FOR DELETE 
TO authenticated 
USING (true);