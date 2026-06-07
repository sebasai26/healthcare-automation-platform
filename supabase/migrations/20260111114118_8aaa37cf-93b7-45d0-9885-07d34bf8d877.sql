-- Eliminar todas las políticas públicas/permisivas que usan "true"
-- Mantener solo las políticas admin que ya existen

-- analisis_ia
DROP POLICY IF EXISTS "Authenticated users can insert analisis_ia" ON public.analisis_ia;
DROP POLICY IF EXISTS "Authenticated users can read analisis_ia" ON public.analisis_ia;
DROP POLICY IF EXISTS "Permitir actualización pública de análisis" ON public.analisis_ia;
DROP POLICY IF EXISTS "Permitir inserción pública de análisis" ON public.analisis_ia;
DROP POLICY IF EXISTS "Permitir lectura pública de análisis" ON public.analisis_ia;
DROP POLICY IF EXISTS "Permitir lectura pública" ON public.analisis_ia;

-- analisis_servicios
DROP POLICY IF EXISTS "Authenticated users can delete analisis_servicios" ON public.analisis_servicios;
DROP POLICY IF EXISTS "Authenticated users can insert analisis_servicios" ON public.analisis_servicios;
DROP POLICY IF EXISTS "Authenticated users can read analisis_servicios" ON public.analisis_servicios;
DROP POLICY IF EXISTS "Permitir actualización pública" ON public.analisis_servicios;
DROP POLICY IF EXISTS "Permitir eliminación pública" ON public.analisis_servicios;
DROP POLICY IF EXISTS "Permitir inserción pública" ON public.analisis_servicios;
DROP POLICY IF EXISTS "Permitir lectura pública" ON public.analisis_servicios;

-- balance_mensual
DROP POLICY IF EXISTS "Authenticated users can delete balance_mensual" ON public.balance_mensual;
DROP POLICY IF EXISTS "Authenticated users can insert balance_mensual" ON public.balance_mensual;
DROP POLICY IF EXISTS "Authenticated users can read balance_mensual" ON public.balance_mensual;
DROP POLICY IF EXISTS "Authenticated users can update balance_mensual" ON public.balance_mensual;
DROP POLICY IF EXISTS "Permitir actualización pública" ON public.balance_mensual;
DROP POLICY IF EXISTS "Permitir eliminación pública" ON public.balance_mensual;
DROP POLICY IF EXISTS "Permitir inserción pública" ON public.balance_mensual;
DROP POLICY IF EXISTS "Permitir lectura pública" ON public.balance_mensual;

-- balance_profesional
DROP POLICY IF EXISTS "Authenticated users can delete balance_profesional" ON public.balance_profesional;
DROP POLICY IF EXISTS "Authenticated users can insert balance_profesional" ON public.balance_profesional;
DROP POLICY IF EXISTS "Authenticated users can read balance_profesional" ON public.balance_profesional;
DROP POLICY IF EXISTS "Authenticated users can update balance_profesional" ON public.balance_profesional;
DROP POLICY IF EXISTS "Permitir actualización pública" ON public.balance_profesional;
DROP POLICY IF EXISTS "Permitir eliminación pública" ON public.balance_profesional;
DROP POLICY IF EXISTS "Permitir inserción pública" ON public.balance_profesional;
DROP POLICY IF EXISTS "Permitir lectura pública" ON public.balance_profesional;

-- citas_profesional
DROP POLICY IF EXISTS "Authenticated users can delete citas_profesional" ON public.citas_profesional;
DROP POLICY IF EXISTS "Authenticated users can insert citas_profesional" ON public.citas_profesional;
DROP POLICY IF EXISTS "Authenticated users can read citas_profesional" ON public.citas_profesional;
DROP POLICY IF EXISTS "Authenticated users can update citas_profesional" ON public.citas_profesional;
DROP POLICY IF EXISTS "Permitir actualización pública" ON public.citas_profesional;
DROP POLICY IF EXISTS "Permitir eliminación pública" ON public.citas_profesional;
DROP POLICY IF EXISTS "Permitir inserción pública" ON public.citas_profesional;
DROP POLICY IF EXISTS "Permitir lectura pública" ON public.citas_profesional;

-- horas_profesional
DROP POLICY IF EXISTS "Authenticated users can delete horas_profesional" ON public.horas_profesional;
DROP POLICY IF EXISTS "Authenticated users can insert horas_profesional" ON public.horas_profesional;
DROP POLICY IF EXISTS "Authenticated users can read horas_profesional" ON public.horas_profesional;
DROP POLICY IF EXISTS "Authenticated users can update horas_profesional" ON public.horas_profesional;
DROP POLICY IF EXISTS "Permitir actualización pública" ON public.horas_profesional;
DROP POLICY IF EXISTS "Permitir eliminación pública" ON public.horas_profesional;
DROP POLICY IF EXISTS "Permitir inserción pública" ON public.horas_profesional;
DROP POLICY IF EXISTS "Permitir lectura pública" ON public.horas_profesional;

-- listado_citas
DROP POLICY IF EXISTS "Authenticated users can delete listado_citas" ON public.listado_citas;
DROP POLICY IF EXISTS "Authenticated users can insert listado_citas" ON public.listado_citas;
DROP POLICY IF EXISTS "Authenticated users can read listado_citas" ON public.listado_citas;
DROP POLICY IF EXISTS "Authenticated users can update listado_citas" ON public.listado_citas;
DROP POLICY IF EXISTS "Permitir actualización pública" ON public.listado_citas;
DROP POLICY IF EXISTS "Permitir eliminación pública" ON public.listado_citas;
DROP POLICY IF EXISTS "Permitir inserción pública" ON public.listado_citas;
DROP POLICY IF EXISTS "Permitir lectura pública" ON public.listado_citas;

-- ocupacion_profesional
DROP POLICY IF EXISTS "Authenticated users can delete ocupacion_profesional" ON public.ocupacion_profesional;
DROP POLICY IF EXISTS "Authenticated users can insert ocupacion_profesional" ON public.ocupacion_profesional;
DROP POLICY IF EXISTS "Authenticated users can read ocupacion_profesional" ON public.ocupacion_profesional;
DROP POLICY IF EXISTS "Authenticated users can update ocupacion_profesional" ON public.ocupacion_profesional;
DROP POLICY IF EXISTS "Permitir actualización pública" ON public.ocupacion_profesional;
DROP POLICY IF EXISTS "Permitir eliminación pública" ON public.ocupacion_profesional;
DROP POLICY IF EXISTS "Permitir inserción pública" ON public.ocupacion_profesional;
DROP POLICY IF EXISTS "Permitir lectura pública" ON public.ocupacion_profesional;