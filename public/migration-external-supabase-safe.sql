-- =============================================================================
-- MIGRACIÓN SEGURA: Solo crea tablas que NO existan aún
-- Compatible con Supabase externo que ya tiene algunas tablas con datos
-- Ejecutar en el SQL Editor del dashboard de Supabase externo
-- =============================================================================

-- ========== ENUM (solo si no existe) ==========
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ========== FUNCIÓN has_role ==========
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- ========== FUNCIÓN update_updated_at ==========
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- TABLAS (IF NOT EXISTS - no toca las que ya existen)
-- =============================================================================

-- ========== user_roles ==========
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ========== analisis_ia ==========
CREATE TABLE IF NOT EXISTS public.analisis_ia (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  semana INTEGER NOT NULL,
  anio INTEGER NOT NULL,
  diagnostico TEXT,
  problemas JSONB,
  oportunidades JSONB,
  acciones JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cosas_positivas JSONB DEFAULT '[]'::jsonb,
  areas_mejora JSONB DEFAULT '[]'::jsonb,
  objetivo_mes TEXT,
  objetivo_mes_contexto TEXT,
  UNIQUE (semana, anio)
);
ALTER TABLE public.analisis_ia ENABLE ROW LEVEL SECURITY;

-- ========== analisis_servicios ==========
CREATE TABLE IF NOT EXISTS public.analisis_servicios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  clinica TEXT NOT NULL,
  servicio TEXT NOT NULL,
  num_citas INTEGER DEFAULT 0,
  importe_total NUMERIC DEFAULT 0,
  total_base NUMERIC DEFAULT 0,
  anio INTEGER NOT NULL DEFAULT 2025,
  mes TEXT,
  especialidad TEXT,
  mutua TEXT,
  imp_servicio NUMERIC DEFAULT 0,
  imp_cita NUMERIC DEFAULT 0,
  duracion_media NUMERIC DEFAULT 0,
  total_desc NUMERIC DEFAULT 0,
  total_iva NUMERIC DEFAULT 0,
  total_ret NUMERIC DEFAULT 0,
  fecha_inicio DATE,
  fecha_fin DATE,
  periodo_tipo TEXT DEFAULT 'monthly'::text
);
ALTER TABLE public.analisis_servicios ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS analisis_servicios_unique_key ON public.analisis_servicios
  USING btree (clinica, servicio, anio, COALESCE(fecha_inicio, '1900-01-01'::date));

-- ========== balance_mensual ==========
CREATE TABLE IF NOT EXISTS public.balance_mensual (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  clinic_id TEXT NOT NULL,
  mes TEXT NOT NULL,
  anio INTEGER NOT NULL DEFAULT 2025,
  total NUMERIC DEFAULT 0,
  fecha TEXT,
  efectivo NUMERIC DEFAULT 0,
  tarjeta NUMERIC DEFAULT 0,
  talon_transferencia NUMERIC DEFAULT 0,
  domiciliacion NUMERIC DEFAULT 0,
  bono_regalo NUMERIC DEFAULT 0,
  UNIQUE (clinic_id, mes, anio)
);
ALTER TABLE public.balance_mensual ENABLE ROW LEVEL SECURITY;

-- ========== balance_profesional ==========
CREATE TABLE IF NOT EXISTS public.balance_profesional (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  clinic_id TEXT NOT NULL,
  usuario TEXT NOT NULL,
  mes TEXT NOT NULL,
  anio INTEGER NOT NULL DEFAULT 2025,
  total NUMERIC DEFAULT 0,
  fecha TEXT,
  efectivo NUMERIC DEFAULT 0,
  tarjeta NUMERIC DEFAULT 0,
  talon_transferencia NUMERIC DEFAULT 0,
  domiciliacion NUMERIC DEFAULT 0,
  bono_regalo NUMERIC DEFAULT 0,
  porcentaje NUMERIC DEFAULT 0,
  liquido NUMERIC DEFAULT 0,
  UNIQUE (clinic_id, usuario, mes, anio)
);
ALTER TABLE public.balance_profesional ENABLE ROW LEVEL SECURITY;

-- ========== citas_profesional ==========
CREATE TABLE IF NOT EXISTS public.citas_profesional (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  usuario TEXT NOT NULL,
  anio INTEGER NOT NULL DEFAULT 2025,
  enero NUMERIC,
  febrero NUMERIC,
  marzo NUMERIC,
  abril NUMERIC,
  mayo NUMERIC,
  junio NUMERIC,
  julio NUMERIC,
  agosto NUMERIC,
  septiembre NUMERIC,
  octubre NUMERIC,
  noviembre NUMERIC,
  diciembre NUMERIC,
  UNIQUE (usuario, anio)
);
ALTER TABLE public.citas_profesional ENABLE ROW LEVEL SECURITY;

-- ========== clinic_config ==========
CREATE TABLE IF NOT EXISTS public.clinic_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clinic_config ENABLE ROW LEVEL SECURITY;

-- ========== contabilidad_clinica ==========
CREATE TABLE IF NOT EXISTS public.contabilidad_clinica (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  seccion TEXT NOT NULL,
  concepto TEXT NOT NULL,
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
  total NUMERIC DEFAULT 0,
  UNIQUE (anio, seccion, concepto)
);
ALTER TABLE public.contabilidad_clinica ENABLE ROW LEVEL SECURITY;

-- ========== cumple_inactivos ==========
CREATE TABLE IF NOT EXISTS public.cumple_inactivos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  nombre TEXT NOT NULL,
  apellidos TEXT,
  telefono TEXT NOT NULL,
  fecha_nacimiento TEXT,
  dias_inactivo INTEGER NOT NULL,
  ultima_cita TEXT,
  procesado BOOLEAN NOT NULL DEFAULT false,
  nh TEXT,
  numero_paciente TEXT
);
ALTER TABLE public.cumple_inactivos ENABLE ROW LEVEL SECURITY;

-- ========== horas_profesional ==========
CREATE TABLE IF NOT EXISTS public.horas_profesional (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  usuario TEXT NOT NULL,
  anio INTEGER NOT NULL DEFAULT 2025,
  enero NUMERIC,
  febrero NUMERIC,
  marzo NUMERIC,
  abril NUMERIC,
  mayo NUMERIC,
  junio NUMERIC,
  julio NUMERIC,
  agosto NUMERIC,
  septiembre NUMERIC,
  octubre NUMERIC,
  noviembre NUMERIC,
  diciembre NUMERIC,
  UNIQUE (usuario, anio)
);
ALTER TABLE public.horas_profesional ENABLE ROW LEVEL SECURITY;

-- ========== listado_citas ==========
CREATE TABLE IF NOT EXISTS public.listado_citas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  clinic_id TEXT NOT NULL DEFAULT ''::text,
  source_key TEXT NOT NULL,
  agenda TEXT NOT NULL,
  estado TEXT NOT NULL,
  fecha_cita TEXT NOT NULL,
  mes TEXT NOT NULL,
  anio INTEGER NOT NULL,
  importe NUMERIC DEFAULT 0,
  paciente_nombre TEXT,
  paciente_telefono TEXT,
  servicio TEXT,
  asunto TEXT,
  tipo TEXT,
  procedencia TEXT,
  sala_box TEXT,
  confirmada BOOLEAN,
  semana INTEGER,
  accion_id TEXT,
  fecha_creacion TEXT,
  UNIQUE (clinic_id, source_key)
);
ALTER TABLE public.listado_citas ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_listado_citas_estado ON public.listado_citas USING btree (estado);
CREATE INDEX IF NOT EXISTS idx_listado_citas_fecha ON public.listado_citas USING btree (fecha_cita);
CREATE INDEX IF NOT EXISTS idx_listado_citas_anio_mes ON public.listado_citas USING btree (anio, mes);

-- ========== objetivo_mensual ==========
CREATE TABLE IF NOT EXISTS public.objetivo_mensual (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  anio INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  objetivo TEXT NOT NULL,
  contexto TEXT,
  tendencia_negativa_principal TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mes, anio)
);
ALTER TABLE public.objetivo_mensual ENABLE ROW LEVEL SECURITY;

-- ========== ocupacion_profesional ==========
CREATE TABLE IF NOT EXISTS public.ocupacion_profesional (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  usuario TEXT NOT NULL,
  anio INTEGER NOT NULL DEFAULT 2025,
  enero NUMERIC,
  febrero NUMERIC,
  marzo NUMERIC,
  abril NUMERIC,
  mayo NUMERIC,
  junio NUMERIC,
  julio NUMERIC,
  agosto NUMERIC,
  septiembre NUMERIC,
  octubre NUMERIC,
  noviembre NUMERIC,
  diciembre NUMERIC,
  UNIQUE (usuario, anio)
);
ALTER TABLE public.ocupacion_profesional ENABLE ROW LEVEL SECURITY;

-- ========== pacientes_demograficos ==========
CREATE TABLE IF NOT EXISTS public.pacientes_demograficos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  nh TEXT NOT NULL,
  nombre TEXT NOT NULL,
  apellidos TEXT,
  sexo TEXT NOT NULL DEFAULT ''::text,
  telefono TEXT,
  fecha_nacimiento TEXT
);
ALTER TABLE public.pacientes_demograficos ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS pacientes_demograficos_nh_unique ON public.pacientes_demograficos USING btree (nh);
CREATE INDEX IF NOT EXISTS idx_pacientes_demograficos_sexo ON public.pacientes_demograficos USING btree (sexo);

-- ========== recordatorios_cita (tabla externa para n8n) ==========
CREATE TABLE IF NOT EXISTS public.recordatorios_cita (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  telefono TEXT NOT NULL,
  fecha_cita TEXT NOT NULL,
  hora_cita TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- RLS POLICIES (usa IF NOT EXISTS vía DO blocks para no fallar si ya existen)
-- =============================================================================

-- Macro para crear policies solo si no existen
DO $$ BEGIN

-- user_roles
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_roles' AND policyname='Admins can view all roles') THEN
  CREATE POLICY "Admins can view all roles" ON public.user_roles
    FOR SELECT TO authenticated
    USING (has_role(auth.uid(), 'admin'::app_role) OR (user_id = auth.uid()));
END IF;

IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_roles' AND policyname='Admins can insert roles') THEN
  CREATE POLICY "Admins can insert roles" ON public.user_roles
    FOR INSERT TO authenticated
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
END IF;

IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_roles' AND policyname='Admins can delete roles') THEN
  CREATE POLICY "Admins can delete roles" ON public.user_roles
    FOR DELETE TO authenticated
    USING (has_role(auth.uid(), 'admin'::app_role));
END IF;

-- analisis_ia
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='analisis_ia' AND policyname='admin_select_analisis_ia') THEN
  CREATE POLICY "admin_select_analisis_ia" ON public.analisis_ia FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='analisis_ia' AND policyname='admin_insert_analisis_ia') THEN
  CREATE POLICY "admin_insert_analisis_ia" ON public.analisis_ia FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='analisis_ia' AND policyname='admin_update_analisis_ia') THEN
  CREATE POLICY "admin_update_analisis_ia" ON public.analisis_ia FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='analisis_ia' AND policyname='admin_delete_analisis_ia') THEN
  CREATE POLICY "admin_delete_analisis_ia" ON public.analisis_ia FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;

-- analisis_servicios
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='analisis_servicios' AND policyname='admin_select_analisis_servicios') THEN
  CREATE POLICY "admin_select_analisis_servicios" ON public.analisis_servicios FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='analisis_servicios' AND policyname='admin_insert_analisis_servicios') THEN
  CREATE POLICY "admin_insert_analisis_servicios" ON public.analisis_servicios FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='analisis_servicios' AND policyname='admin_update_analisis_servicios') THEN
  CREATE POLICY "admin_update_analisis_servicios" ON public.analisis_servicios FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='analisis_servicios' AND policyname='admin_delete_analisis_servicios') THEN
  CREATE POLICY "admin_delete_analisis_servicios" ON public.analisis_servicios FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;

-- balance_mensual
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='balance_mensual' AND policyname='admin_select_balance_mensual') THEN
  CREATE POLICY "admin_select_balance_mensual" ON public.balance_mensual FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='balance_mensual' AND policyname='admin_insert_balance_mensual') THEN
  CREATE POLICY "admin_insert_balance_mensual" ON public.balance_mensual FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='balance_mensual' AND policyname='admin_update_balance_mensual') THEN
  CREATE POLICY "admin_update_balance_mensual" ON public.balance_mensual FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='balance_mensual' AND policyname='admin_delete_balance_mensual') THEN
  CREATE POLICY "admin_delete_balance_mensual" ON public.balance_mensual FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;

-- balance_profesional
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='balance_profesional' AND policyname='admin_select_balance_profesional') THEN
  CREATE POLICY "admin_select_balance_profesional" ON public.balance_profesional FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='balance_profesional' AND policyname='admin_insert_balance_profesional') THEN
  CREATE POLICY "admin_insert_balance_profesional" ON public.balance_profesional FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='balance_profesional' AND policyname='admin_update_balance_profesional') THEN
  CREATE POLICY "admin_update_balance_profesional" ON public.balance_profesional FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='balance_profesional' AND policyname='admin_delete_balance_profesional') THEN
  CREATE POLICY "admin_delete_balance_profesional" ON public.balance_profesional FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;

-- citas_profesional
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='citas_profesional' AND policyname='admin_select_citas_profesional') THEN
  CREATE POLICY "admin_select_citas_profesional" ON public.citas_profesional FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='citas_profesional' AND policyname='admin_insert_citas_profesional') THEN
  CREATE POLICY "admin_insert_citas_profesional" ON public.citas_profesional FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='citas_profesional' AND policyname='admin_update_citas_profesional') THEN
  CREATE POLICY "admin_update_citas_profesional" ON public.citas_profesional FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='citas_profesional' AND policyname='admin_delete_citas_profesional') THEN
  CREATE POLICY "admin_delete_citas_profesional" ON public.citas_profesional FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;

-- clinic_config
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clinic_config' AND policyname='admin_select_clinic_config') THEN
  CREATE POLICY "admin_select_clinic_config" ON public.clinic_config FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clinic_config' AND policyname='admin_insert_clinic_config') THEN
  CREATE POLICY "admin_insert_clinic_config" ON public.clinic_config FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clinic_config' AND policyname='admin_update_clinic_config') THEN
  CREATE POLICY "admin_update_clinic_config" ON public.clinic_config FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clinic_config' AND policyname='admin_delete_clinic_config') THEN
  CREATE POLICY "admin_delete_clinic_config" ON public.clinic_config FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;

-- contabilidad_clinica
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contabilidad_clinica' AND policyname='admin_select_contabilidad_clinica') THEN
  CREATE POLICY "admin_select_contabilidad_clinica" ON public.contabilidad_clinica FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contabilidad_clinica' AND policyname='admin_insert_contabilidad_clinica') THEN
  CREATE POLICY "admin_insert_contabilidad_clinica" ON public.contabilidad_clinica FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contabilidad_clinica' AND policyname='admin_update_contabilidad_clinica') THEN
  CREATE POLICY "admin_update_contabilidad_clinica" ON public.contabilidad_clinica FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contabilidad_clinica' AND policyname='admin_delete_contabilidad_clinica') THEN
  CREATE POLICY "admin_delete_contabilidad_clinica" ON public.contabilidad_clinica FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;

-- cumple_inactivos
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cumple_inactivos' AND policyname='admin_select_cumple_inactivos') THEN
  CREATE POLICY "admin_select_cumple_inactivos" ON public.cumple_inactivos FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cumple_inactivos' AND policyname='admin_insert_cumple_inactivos') THEN
  CREATE POLICY "admin_insert_cumple_inactivos" ON public.cumple_inactivos FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cumple_inactivos' AND policyname='admin_update_cumple_inactivos') THEN
  CREATE POLICY "admin_update_cumple_inactivos" ON public.cumple_inactivos FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cumple_inactivos' AND policyname='admin_delete_cumple_inactivos') THEN
  CREATE POLICY "admin_delete_cumple_inactivos" ON public.cumple_inactivos FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;

-- horas_profesional
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='horas_profesional' AND policyname='admin_select_horas_profesional') THEN
  CREATE POLICY "admin_select_horas_profesional" ON public.horas_profesional FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='horas_profesional' AND policyname='admin_insert_horas_profesional') THEN
  CREATE POLICY "admin_insert_horas_profesional" ON public.horas_profesional FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='horas_profesional' AND policyname='admin_update_horas_profesional') THEN
  CREATE POLICY "admin_update_horas_profesional" ON public.horas_profesional FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='horas_profesional' AND policyname='admin_delete_horas_profesional') THEN
  CREATE POLICY "admin_delete_horas_profesional" ON public.horas_profesional FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;

-- listado_citas
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='listado_citas' AND policyname='admin_select_listado_citas') THEN
  CREATE POLICY "admin_select_listado_citas" ON public.listado_citas FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='listado_citas' AND policyname='admin_insert_listado_citas') THEN
  CREATE POLICY "admin_insert_listado_citas" ON public.listado_citas FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='listado_citas' AND policyname='admin_update_listado_citas') THEN
  CREATE POLICY "admin_update_listado_citas" ON public.listado_citas FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='listado_citas' AND policyname='admin_delete_listado_citas') THEN
  CREATE POLICY "admin_delete_listado_citas" ON public.listado_citas FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;

-- objetivo_mensual
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objetivo_mensual' AND policyname='admin_select_objetivo_mensual') THEN
  CREATE POLICY "admin_select_objetivo_mensual" ON public.objetivo_mensual FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objetivo_mensual' AND policyname='admin_insert_objetivo_mensual') THEN
  CREATE POLICY "admin_insert_objetivo_mensual" ON public.objetivo_mensual FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objetivo_mensual' AND policyname='admin_update_objetivo_mensual') THEN
  CREATE POLICY "admin_update_objetivo_mensual" ON public.objetivo_mensual FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objetivo_mensual' AND policyname='admin_delete_objetivo_mensual') THEN
  CREATE POLICY "admin_delete_objetivo_mensual" ON public.objetivo_mensual FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;

-- ocupacion_profesional
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ocupacion_profesional' AND policyname='admin_select_ocupacion_profesional') THEN
  CREATE POLICY "admin_select_ocupacion_profesional" ON public.ocupacion_profesional FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ocupacion_profesional' AND policyname='admin_insert_ocupacion_profesional') THEN
  CREATE POLICY "admin_insert_ocupacion_profesional" ON public.ocupacion_profesional FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ocupacion_profesional' AND policyname='admin_update_ocupacion_profesional') THEN
  CREATE POLICY "admin_update_ocupacion_profesional" ON public.ocupacion_profesional FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ocupacion_profesional' AND policyname='admin_delete_ocupacion_profesional') THEN
  CREATE POLICY "admin_delete_ocupacion_profesional" ON public.ocupacion_profesional FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;

-- pacientes_demograficos
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pacientes_demograficos' AND policyname='admin_select_pacientes_demograficos') THEN
  CREATE POLICY "admin_select_pacientes_demograficos" ON public.pacientes_demograficos FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pacientes_demograficos' AND policyname='admin_insert_pacientes_demograficos') THEN
  CREATE POLICY "admin_insert_pacientes_demograficos" ON public.pacientes_demograficos FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pacientes_demograficos' AND policyname='admin_update_pacientes_demograficos') THEN
  CREATE POLICY "admin_update_pacientes_demograficos" ON public.pacientes_demograficos FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pacientes_demograficos' AND policyname='admin_delete_pacientes_demograficos') THEN
  CREATE POLICY "admin_delete_pacientes_demograficos" ON public.pacientes_demograficos FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
END IF;

END $$;

-- =============================================================================
-- TRIGGER para updated_at en tablas que lo necesitan
-- =============================================================================
DROP TRIGGER IF EXISTS update_clinic_config_updated_at ON public.clinic_config;
CREATE TRIGGER update_clinic_config_updated_at
  BEFORE UPDATE ON public.clinic_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_objetivo_mensual_updated_at ON public.objetivo_mensual;
CREATE TRIGGER update_objetivo_mensual_updated_at
  BEFORE UPDATE ON public.objetivo_mensual
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- ¡LISTO! Este script es seguro para ejecutar múltiples veces.
-- Solo creará las tablas, índices, políticas y triggers que no existan.
-- =============================================================================
