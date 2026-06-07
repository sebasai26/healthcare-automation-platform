CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



SET default_table_access_method = heap;

--
-- Name: horas_profesional; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.horas_profesional (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario text NOT NULL,
    enero numeric DEFAULT 0,
    febrero numeric DEFAULT 0,
    marzo numeric DEFAULT 0,
    abril numeric DEFAULT 0,
    mayo numeric DEFAULT 0,
    junio numeric DEFAULT 0,
    julio numeric DEFAULT 0,
    agosto numeric DEFAULT 0,
    septiembre numeric DEFAULT 0,
    octubre numeric DEFAULT 0,
    noviembre numeric DEFAULT 0,
    diciembre numeric DEFAULT 0,
    anio integer DEFAULT 2025 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: horas_profesional horas_profesional_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horas_profesional
    ADD CONSTRAINT horas_profesional_pkey PRIMARY KEY (id);


--
-- Name: horas_profesional horas_profesional_usuario_anio_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horas_profesional
    ADD CONSTRAINT horas_profesional_usuario_anio_key UNIQUE (usuario, anio);


--
-- Name: horas_profesional Permitir actualización pública; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir actualización pública" ON public.horas_profesional FOR UPDATE USING (true);


--
-- Name: horas_profesional Permitir eliminación pública; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir eliminación pública" ON public.horas_profesional FOR DELETE USING (true);


--
-- Name: horas_profesional Permitir inserción pública; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir inserción pública" ON public.horas_profesional FOR INSERT WITH CHECK (true);


--
-- Name: horas_profesional Permitir lectura pública; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir lectura pública" ON public.horas_profesional FOR SELECT USING (true);


--
-- Name: horas_profesional; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.horas_profesional ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;