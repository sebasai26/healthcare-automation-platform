-- ============================================
-- NUCLEAR Y RECONSTRUIR - Supabase Externo
-- Ejecutar TODO de una vez en el SQL Editor
-- ============================================

-- ============================================
-- PASO 1: ELIMINAR TODAS LAS POLICIES
-- ============================================

-- user_roles
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

-- analisis_ia
DROP POLICY IF EXISTS "admin_select_analisis_ia" ON public.analisis_ia;
DROP POLICY IF EXISTS "admin_insert_analisis_ia" ON public.analisis_ia;
DROP POLICY IF EXISTS "admin_update_analisis_ia" ON public.analisis_ia;
DROP POLICY IF EXISTS "admin_delete_analisis_ia" ON public.analisis_ia;

-- analisis_servicios
DROP POLICY IF EXISTS "admin_select_analisis_servicios" ON public.analisis_servicios;
DROP POLICY IF EXISTS "admin_insert_analisis_servicios" ON public.analisis_servicios;
DROP POLICY IF EXISTS "admin_update_analisis_servicios" ON public.analisis_servicios;
DROP POLICY IF EXISTS "admin_delete_analisis_servicios" ON public.analisis_servicios;

-- balance_mensual
DROP POLICY IF EXISTS "admin_select_balance_mensual" ON public.balance_mensual;
DROP POLICY IF EXISTS "admin_insert_balance_mensual" ON public.balance_mensual;
DROP POLICY IF EXISTS "admin_update_balance_mensual" ON public.balance_mensual;
DROP POLICY IF EXISTS "admin_delete_balance_mensual" ON public.balance_mensual;

-- balance_profesional
DROP POLICY IF EXISTS "admin_select_balance_profesional" ON public.balance_profesional;
DROP POLICY IF EXISTS "admin_insert_balance_profesional" ON public.balance_profesional;
DROP POLICY IF EXISTS "admin_update_balance_profesional" ON public.balance_profesional;
DROP POLICY IF EXISTS "admin_delete_balance_profesional" ON public.balance_profesional;

-- citas_profesional
DROP POLICY IF EXISTS "admin_select_citas_profesional" ON public.citas_profesional;
DROP POLICY IF EXISTS "admin_insert_citas_profesional" ON public.citas_profesional;
DROP POLICY IF EXISTS "admin_update_citas_profesional" ON public.citas_profesional;
DROP POLICY IF EXISTS "admin_delete_citas_profesional" ON public.citas_profesional;

-- clinic_config
DROP POLICY IF EXISTS "admin_select_clinic_config" ON public.clinic_config;
DROP POLICY IF EXISTS "admin_insert_clinic_config" ON public.clinic_config;
DROP POLICY IF EXISTS "admin_update_clinic_config" ON public.clinic_config;
DROP POLICY IF EXISTS "admin_delete_clinic_config" ON public.clinic_config;

-- contabilidad_clinica
DROP POLICY IF EXISTS "admin_select_contabilidad_clinica" ON public.contabilidad_clinica;
DROP POLICY IF EXISTS "admin_insert_contabilidad_clinica" ON public.contabilidad_clinica;
DROP POLICY IF EXISTS "admin_update_contabilidad_clinica" ON public.contabilidad_clinica;
DROP POLICY IF EXISTS "admin_delete_contabilidad_clinica" ON public.contabilidad_clinica;

-- cumple_inactivos
DROP POLICY IF EXISTS "admin_select_cumple_inactivos" ON public.cumple_inactivos;
DROP POLICY IF EXISTS "admin_insert_cumple_inactivos" ON public.cumple_inactivos;
DROP POLICY IF EXISTS "admin_update_cumple_inactivos" ON public.cumple_inactivos;
DROP POLICY IF EXISTS "admin_delete_cumple_inactivos" ON public.cumple_inactivos;

-- horas_profesional
DROP POLICY IF EXISTS "admin_select_horas_profesional" ON public.horas_profesional;
DROP POLICY IF EXISTS "admin_insert_horas_profesional" ON public.horas_profesional;
DROP POLICY IF EXISTS "admin_update_horas_profesional" ON public.horas_profesional;
DROP POLICY IF EXISTS "admin_delete_horas_profesional" ON public.horas_profesional;

-- listado_citas
DROP POLICY IF EXISTS "admin_select_listado_citas" ON public.listado_citas;
DROP POLICY IF EXISTS "admin_insert_listado_citas" ON public.listado_citas;
DROP POLICY IF EXISTS "admin_update_listado_citas" ON public.listado_citas;
DROP POLICY IF EXISTS "admin_delete_listado_citas" ON public.listado_citas;

-- objetivo_mensual
DROP POLICY IF EXISTS "Admins pueden gestionar objetivos mensuales" ON public.objetivo_mensual;
DROP POLICY IF EXISTS "Admins pueden leer objetivos mensuales" ON public.objetivo_mensual;
DROP POLICY IF EXISTS "admin_select_objetivo_mensual" ON public.objetivo_mensual;
DROP POLICY IF EXISTS "admin_insert_objetivo_mensual" ON public.objetivo_mensual;
DROP POLICY IF EXISTS "admin_update_objetivo_mensual" ON public.objetivo_mensual;
DROP POLICY IF EXISTS "admin_delete_objetivo_mensual" ON public.objetivo_mensual;

-- ocupacion_profesional
DROP POLICY IF EXISTS "admin_select_ocupacion_profesional" ON public.ocupacion_profesional;
DROP POLICY IF EXISTS "admin_insert_ocupacion_profesional" ON public.ocupacion_profesional;
DROP POLICY IF EXISTS "admin_update_ocupacion_profesional" ON public.ocupacion_profesional;
DROP POLICY IF EXISTS "admin_delete_ocupacion_profesional" ON public.ocupacion_profesional;

-- pacientes_demograficos
DROP POLICY IF EXISTS "admin_select_pacientes_demograficos" ON public.pacientes_demograficos;
DROP POLICY IF EXISTS "admin_insert_pacientes_demograficos" ON public.pacientes_demograficos;
DROP POLICY IF EXISTS "admin_update_pacientes_demograficos" ON public.pacientes_demograficos;
DROP POLICY IF EXISTS "admin_delete_pacientes_demograficos" ON public.pacientes_demograficos;

-- ============================================
-- PASO 2: ELIMINAR FUNCIÓN has_role
-- ============================================
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);
DROP FUNCTION IF EXISTS public.has_role(uuid, text);

-- ============================================
-- PASO 3: CREAR ENUM SI NO EXISTE
-- ============================================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- PASO 4: CONVERTIR COLUMNA role SI ES TEXT
-- ============================================
DO $$ BEGIN
  ALTER TABLE public.user_roles
    ALTER COLUMN role TYPE app_role USING role::app_role;
EXCEPTION
  WHEN others THEN NULL; -- Ya es app_role, ignorar
END $$;

-- ============================================
-- PASO 5: RECREAR FUNCIÓN has_role
-- ============================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_role FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role TO authenticated;

-- ============================================
-- PASO 6: RECREAR TODAS LAS POLICIES
-- ============================================

-- user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR (user_id = auth.uid()));
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- analisis_ia
ALTER TABLE public.analisis_ia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_select_analisis_ia" ON public.analisis_ia FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_insert_analisis_ia" ON public.analisis_ia FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_update_analisis_ia" ON public.analisis_ia FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_delete_analisis_ia" ON public.analisis_ia FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- analisis_servicios
ALTER TABLE public.analisis_servicios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_select_analisis_servicios" ON public.analisis_servicios FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_insert_analisis_servicios" ON public.analisis_servicios FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_update_analisis_servicios" ON public.analisis_servicios FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_delete_analisis_servicios" ON public.analisis_servicios FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- balance_mensual
ALTER TABLE public.balance_mensual ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_select_balance_mensual" ON public.balance_mensual FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_insert_balance_mensual" ON public.balance_mensual FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_update_balance_mensual" ON public.balance_mensual FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_delete_balance_mensual" ON public.balance_mensual FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- balance_profesional
ALTER TABLE public.balance_profesional ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_select_balance_profesional" ON public.balance_profesional FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_insert_balance_profesional" ON public.balance_profesional FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_update_balance_profesional" ON public.balance_profesional FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_delete_balance_profesional" ON public.balance_profesional FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- citas_profesional
ALTER TABLE public.citas_profesional ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_select_citas_profesional" ON public.citas_profesional FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_insert_citas_profesional" ON public.citas_profesional FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_update_citas_profesional" ON public.citas_profesional FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_delete_citas_profesional" ON public.citas_profesional FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- clinic_config
ALTER TABLE public.clinic_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_select_clinic_config" ON public.clinic_config FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_insert_clinic_config" ON public.clinic_config FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_update_clinic_config" ON public.clinic_config FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_delete_clinic_config" ON public.clinic_config FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- contabilidad_clinica
ALTER TABLE public.contabilidad_clinica ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_select_contabilidad_clinica" ON public.contabilidad_clinica FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_insert_contabilidad_clinica" ON public.contabilidad_clinica FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_update_contabilidad_clinica" ON public.contabilidad_clinica FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_delete_contabilidad_clinica" ON public.contabilidad_clinica FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- cumple_inactivos
ALTER TABLE public.cumple_inactivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_select_cumple_inactivos" ON public.cumple_inactivos FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_insert_cumple_inactivos" ON public.cumple_inactivos FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_update_cumple_inactivos" ON public.cumple_inactivos FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_delete_cumple_inactivos" ON public.cumple_inactivos FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- horas_profesional
ALTER TABLE public.horas_profesional ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_select_horas_profesional" ON public.horas_profesional FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_insert_horas_profesional" ON public.horas_profesional FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_update_horas_profesional" ON public.horas_profesional FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_delete_horas_profesional" ON public.horas_profesional FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- listado_citas
ALTER TABLE public.listado_citas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_select_listado_citas" ON public.listado_citas FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_insert_listado_citas" ON public.listado_citas FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_update_listado_citas" ON public.listado_citas FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_delete_listado_citas" ON public.listado_citas FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- objetivo_mensual
ALTER TABLE public.objetivo_mensual ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_select_objetivo_mensual" ON public.objetivo_mensual FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_insert_objetivo_mensual" ON public.objetivo_mensual FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_update_objetivo_mensual" ON public.objetivo_mensual FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_delete_objetivo_mensual" ON public.objetivo_mensual FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ocupacion_profesional
ALTER TABLE public.ocupacion_profesional ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_select_ocupacion_profesional" ON public.ocupacion_profesional FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_insert_ocupacion_profesional" ON public.ocupacion_profesional FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_update_ocupacion_profesional" ON public.ocupacion_profesional FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_delete_ocupacion_profesional" ON public.ocupacion_profesional FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- pacientes_demograficos
ALTER TABLE public.pacientes_demograficos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_select_pacientes_demograficos" ON public.pacientes_demograficos FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_insert_pacientes_demograficos" ON public.pacientes_demograficos FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_update_pacientes_demograficos" ON public.pacientes_demograficos FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_delete_pacientes_demograficos" ON public.pacientes_demograficos FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- PASO 7: FUNCIÓN update_updated_at
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================================
-- LISTO! Verificar con: SELECT * FROM user_roles;
-- ============================================
