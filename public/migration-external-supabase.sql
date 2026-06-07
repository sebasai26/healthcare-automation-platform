-- =============================================================================
-- MIGRACIÓN COMPLETA: Esquema de Base de Datos para Supabase Externo
-- Generado automáticamente desde Lovable Cloud
-- Ejecutar en el SQL Editor del dashboard de Supabase externo
-- =============================================================================

-- ========== ENUM ==========
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

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
-- TABLAS
-- =============================================================================

-- ========== user_roles ==========
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ========== analisis_ia ==========
CREATE TABLE public.analisis_ia (
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
CREATE TABLE public.analisis_servicios (
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
CREATE UNIQUE INDEX analisis_servicios_unique_key ON public.analisis_servicios
  USING btree (clinica, servicio, anio, COALESCE(fecha_inicio, '1900-01-01'::date));

-- ========== balance_mensual ==========
CREATE TABLE public.balance_mensual (
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
CREATE TABLE public.balance_profesional (
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
CREATE TABLE public.citas_profesional (
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
CREATE TABLE public.clinic_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clinic_config ENABLE ROW LEVEL SECURITY;

-- ========== contabilidad_clinica ==========
CREATE TABLE public.contabilidad_clinica (
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
CREATE TABLE public.cumple_inactivos (
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
CREATE TABLE public.horas_profesional (
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
CREATE TABLE public.listado_citas (
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
CREATE INDEX idx_listado_citas_estado ON public.listado_citas USING btree (estado);
CREATE INDEX idx_listado_citas_fecha ON public.listado_citas USING btree (fecha_cita);
CREATE INDEX idx_listado_citas_anio_mes ON public.listado_citas USING btree (anio, mes);

-- ========== objetivo_mensual ==========
CREATE TABLE public.objetivo_mensual (
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
CREATE TABLE public.ocupacion_profesional (
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
CREATE TABLE public.pacientes_demograficos (
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
CREATE UNIQUE INDEX pacientes_demograficos_nh_unique ON public.pacientes_demograficos USING btree (nh);
CREATE INDEX idx_pacientes_demograficos_sexo ON public.pacientes_demograficos USING btree (sexo);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

-- ========== user_roles ==========
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR (user_id = auth.uid()));

CREATE POLICY "Admins can insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ========== analisis_ia ==========
CREATE POLICY "admin_select_analisis_ia" ON public.analisis_ia
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_insert_analisis_ia" ON public.analisis_ia
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_update_analisis_ia" ON public.analisis_ia
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_delete_analisis_ia" ON public.analisis_ia
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ========== analisis_servicios ==========
CREATE POLICY "admin_select_analisis_servicios" ON public.analisis_servicios
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_insert_analisis_servicios" ON public.analisis_servicios
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_update_analisis_servicios" ON public.analisis_servicios
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_delete_analisis_servicios" ON public.analisis_servicios
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ========== balance_mensual ==========
CREATE POLICY "admin_select_balance_mensual" ON public.balance_mensual
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_insert_balance_mensual" ON public.balance_mensual
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_update_balance_mensual" ON public.balance_mensual
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_delete_balance_mensual" ON public.balance_mensual
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ========== balance_profesional ==========
CREATE POLICY "admin_select_balance_profesional" ON public.balance_profesional
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_insert_balance_profesional" ON public.balance_profesional
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_update_balance_profesional" ON public.balance_profesional
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_delete_balance_profesional" ON public.balance_profesional
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ========== citas_profesional ==========
CREATE POLICY "admin_select_citas_profesional" ON public.citas_profesional
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_insert_citas_profesional" ON public.citas_profesional
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_update_citas_profesional" ON public.citas_profesional
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_delete_citas_profesional" ON public.citas_profesional
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ========== clinic_config ==========
CREATE POLICY "admin_select_clinic_config" ON public.clinic_config
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_insert_clinic_config" ON public.clinic_config
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_update_clinic_config" ON public.clinic_config
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_delete_clinic_config" ON public.clinic_config
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ========== contabilidad_clinica ==========
CREATE POLICY "admin_select_contabilidad_clinica" ON public.contabilidad_clinica
  FOR SELECT TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_insert_contabilidad_clinica" ON public.contabilidad_clinica
  FOR INSERT TO public WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_update_contabilidad_clinica" ON public.contabilidad_clinica
  FOR UPDATE TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_delete_contabilidad_clinica" ON public.contabilidad_clinica
  FOR DELETE TO public USING (has_role(auth.uid(), 'admin'::app_role));

-- ========== cumple_inactivos ==========
CREATE POLICY "admin_select_cumple_inactivos" ON public.cumple_inactivos
  FOR SELECT TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_insert_cumple_inactivos" ON public.cumple_inactivos
  FOR INSERT TO public WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_update_cumple_inactivos" ON public.cumple_inactivos
  FOR UPDATE TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_delete_cumple_inactivos" ON public.cumple_inactivos
  FOR DELETE TO public USING (has_role(auth.uid(), 'admin'::app_role));

-- ========== horas_profesional ==========
CREATE POLICY "admin_select_horas_profesional" ON public.horas_profesional
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_insert_horas_profesional" ON public.horas_profesional
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_update_horas_profesional" ON public.horas_profesional
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_delete_horas_profesional" ON public.horas_profesional
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ========== listado_citas ==========
CREATE POLICY "admin_select_listado_citas" ON public.listado_citas
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_insert_listado_citas" ON public.listado_citas
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_update_listado_citas" ON public.listado_citas
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_delete_listado_citas" ON public.listado_citas
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ========== objetivo_mensual ==========
CREATE POLICY "Admins pueden leer objetivos mensuales" ON public.objetivo_mensual
  FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role));
CREATE POLICY "Admins pueden gestionar objetivos mensuales" ON public.objetivo_mensual
  FOR ALL TO public
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::app_role));

-- ========== ocupacion_profesional ==========
CREATE POLICY "admin_select_ocupacion_profesional" ON public.ocupacion_profesional
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_insert_ocupacion_profesional" ON public.ocupacion_profesional
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_update_ocupacion_profesional" ON public.ocupacion_profesional
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_delete_ocupacion_profesional" ON public.ocupacion_profesional
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ========== pacientes_demograficos ==========
CREATE POLICY "admin_select_pacientes_demograficos" ON public.pacientes_demograficos
  FOR SELECT TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_insert_pacientes_demograficos" ON public.pacientes_demograficos
  FOR INSERT TO public WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_update_pacientes_demograficos" ON public.pacientes_demograficos
  FOR UPDATE TO public USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_delete_pacientes_demograficos" ON public.pacientes_demograficos
  FOR DELETE TO public USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================================================
-- FIN DE LA MIGRACIÓN
-- =============================================================================
-- NOTA: Después de ejecutar esto, recuerda:
-- 1. Crear tu usuario admin en Auth del Supabase externo
-- 2. Insertar manualmente el rol admin en user_roles:
--    INSERT INTO public.user_roles (user_id, role) VALUES ('<tu-user-uuid>', 'admin');
-- 3. Actualizar EXTERNAL_SUPABASE_URL y EXTERNAL_SUPABASE_ANON_KEY en los secrets
-- 4. Exportar los datos actuales e importarlos en el nuevo proyecto
