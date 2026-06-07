-- Eliminar políticas permisivas existentes y reemplazar con políticas basadas en roles

-- analisis_ia
DROP POLICY IF EXISTS "authenticated_select_analisis_ia" ON public.analisis_ia;
DROP POLICY IF EXISTS "authenticated_insert_analisis_ia" ON public.analisis_ia;
DROP POLICY IF EXISTS "authenticated_update_analisis_ia" ON public.analisis_ia;
DROP POLICY IF EXISTS "authenticated_delete_analisis_ia" ON public.analisis_ia;

CREATE POLICY "admin_select_analisis_ia" ON public.analisis_ia
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_insert_analisis_ia" ON public.analisis_ia
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_update_analisis_ia" ON public.analisis_ia
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_delete_analisis_ia" ON public.analisis_ia
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- analisis_servicios
DROP POLICY IF EXISTS "authenticated_select_analisis_servicios" ON public.analisis_servicios;
DROP POLICY IF EXISTS "authenticated_insert_analisis_servicios" ON public.analisis_servicios;
DROP POLICY IF EXISTS "authenticated_update_analisis_servicios" ON public.analisis_servicios;
DROP POLICY IF EXISTS "authenticated_delete_analisis_servicios" ON public.analisis_servicios;

CREATE POLICY "admin_select_analisis_servicios" ON public.analisis_servicios
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_insert_analisis_servicios" ON public.analisis_servicios
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_update_analisis_servicios" ON public.analisis_servicios
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_delete_analisis_servicios" ON public.analisis_servicios
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- balance_mensual
DROP POLICY IF EXISTS "authenticated_select_balance_mensual" ON public.balance_mensual;
DROP POLICY IF EXISTS "authenticated_insert_balance_mensual" ON public.balance_mensual;
DROP POLICY IF EXISTS "authenticated_update_balance_mensual" ON public.balance_mensual;
DROP POLICY IF EXISTS "authenticated_delete_balance_mensual" ON public.balance_mensual;

CREATE POLICY "admin_select_balance_mensual" ON public.balance_mensual
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_insert_balance_mensual" ON public.balance_mensual
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_update_balance_mensual" ON public.balance_mensual
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_delete_balance_mensual" ON public.balance_mensual
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- balance_profesional
DROP POLICY IF EXISTS "authenticated_select_balance_profesional" ON public.balance_profesional;
DROP POLICY IF EXISTS "authenticated_insert_balance_profesional" ON public.balance_profesional;
DROP POLICY IF EXISTS "authenticated_update_balance_profesional" ON public.balance_profesional;
DROP POLICY IF EXISTS "authenticated_delete_balance_profesional" ON public.balance_profesional;

CREATE POLICY "admin_select_balance_profesional" ON public.balance_profesional
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_insert_balance_profesional" ON public.balance_profesional
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_update_balance_profesional" ON public.balance_profesional
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_delete_balance_profesional" ON public.balance_profesional
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- citas_profesional
DROP POLICY IF EXISTS "authenticated_select_citas_profesional" ON public.citas_profesional;
DROP POLICY IF EXISTS "authenticated_insert_citas_profesional" ON public.citas_profesional;
DROP POLICY IF EXISTS "authenticated_update_citas_profesional" ON public.citas_profesional;
DROP POLICY IF EXISTS "authenticated_delete_citas_profesional" ON public.citas_profesional;

CREATE POLICY "admin_select_citas_profesional" ON public.citas_profesional
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_insert_citas_profesional" ON public.citas_profesional
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_update_citas_profesional" ON public.citas_profesional
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_delete_citas_profesional" ON public.citas_profesional
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- horas_profesional
DROP POLICY IF EXISTS "authenticated_select_horas_profesional" ON public.horas_profesional;
DROP POLICY IF EXISTS "authenticated_insert_horas_profesional" ON public.horas_profesional;
DROP POLICY IF EXISTS "authenticated_update_horas_profesional" ON public.horas_profesional;
DROP POLICY IF EXISTS "authenticated_delete_horas_profesional" ON public.horas_profesional;

CREATE POLICY "admin_select_horas_profesional" ON public.horas_profesional
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_insert_horas_profesional" ON public.horas_profesional
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_update_horas_profesional" ON public.horas_profesional
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_delete_horas_profesional" ON public.horas_profesional
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- listado_citas
DROP POLICY IF EXISTS "authenticated_select_listado_citas" ON public.listado_citas;
DROP POLICY IF EXISTS "authenticated_insert_listado_citas" ON public.listado_citas;
DROP POLICY IF EXISTS "authenticated_update_listado_citas" ON public.listado_citas;
DROP POLICY IF EXISTS "authenticated_delete_listado_citas" ON public.listado_citas;

CREATE POLICY "admin_select_listado_citas" ON public.listado_citas
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_insert_listado_citas" ON public.listado_citas
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_update_listado_citas" ON public.listado_citas
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_delete_listado_citas" ON public.listado_citas
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ocupacion_profesional
DROP POLICY IF EXISTS "authenticated_select_ocupacion_profesional" ON public.ocupacion_profesional;
DROP POLICY IF EXISTS "authenticated_insert_ocupacion_profesional" ON public.ocupacion_profesional;
DROP POLICY IF EXISTS "authenticated_update_ocupacion_profesional" ON public.ocupacion_profesional;
DROP POLICY IF EXISTS "authenticated_delete_ocupacion_profesional" ON public.ocupacion_profesional;

CREATE POLICY "admin_select_ocupacion_profesional" ON public.ocupacion_profesional
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_insert_ocupacion_profesional" ON public.ocupacion_profesional
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_update_ocupacion_profesional" ON public.ocupacion_profesional
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_delete_ocupacion_profesional" ON public.ocupacion_profesional
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));