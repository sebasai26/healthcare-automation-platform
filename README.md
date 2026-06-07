# Marbellafisio — CRM & Business Intelligence Clínico

**Marbellafisio** es una plataforma moderna e inteligente de gestión clínica y análisis de negocio (Business Intelligence) diseñada específicamente para centros de fisioterapia. Integra visualizaciones interactivas de KPIs clínicos, automatizaciones de marketing y un motor de recomendaciones de negocio impulsado por Inteligencia Artificial (Google Gemini).

Este proyecto ha sido optimizado con un **Modo de Demostración** integrado para permitir que reclutadores y empresas evalúen la experiencia completa de usuario de forma instantánea.

---

## 🚀 Características Principales

### 📊 1. Panel de Control & KPIs (Business Intelligence)
* **Visualización de KPIs en Tiempo Real:** Monitorización de Ingresos Totales, Ocupación Media, Ticket Medio, y Valor de Vida del Paciente (LTV).
* **Resumen Semanal:** Comparativa automática de citas, ingresos y cancelaciones respecto al promedio mensual histórico.
* **Alertas Inteligentes:** Notificaciones proactivas de desvíos en el rendimiento (ej. caídas de facturación, alta tasa de cancelaciones, baja ocupación de salas).

### 🩺 2. Gestión de Servicios, Citas y Cancelaciones
* **Segmentación de Sesiones:** Desglose y análisis de sesiones de Fisioterapia vs. clases de Pilates.
* **Control de Cancelaciones:** Registro estructurado de ausencias y anulaciones por tipo de tratamiento o fisioterapeuta.
* **Extras y Ajustes:** Registro rápido de conceptos extraordinarios fuera de la agenda estándar.

### 💼 3. Contabilidad & Rentabilidad Real
* **Control de Gastos:** Registro clasificado de gastos fijos y variables del centro.
* **Cálculo de Margen Neto:** Obtención del beneficio real del centro deduciendo salarios y costes de operación directamente de los ingresos brutos.

### 👥 4. Gestión de Fisioterapeutas & Productividad
* **Rendimiento Individual:** Análisis de horas trabajadas, facturación generada y tarifa horaria efectiva por profesional.
* **Tasa de Ocupación:** Gráficas de productividad individual y disponibilidad de salas de tratamiento.

### 🎯 5. CRM de Pacientes & Campañas de Fidelización
* **Campañas de Recaptación:** Identificación automática de pacientes inactivos segmentados por fecha de última visita y tipo de dolencia.
* **Automatización de Cumpleaños:** Alertas y plantillas para felicitaciones a pacientes.
* **Control de Consentimiento de Datos:** Registro de cumplimiento y firmas de la política de protección de datos (RGPD).

### 🧠 6. Recomendaciones de Negocio Autónomas con IA
* **Integración con Google Gemini:** Análisis contextual del estado de la clínica mediante prompts estructurados.
* **Generación de Consejos Clínicos:** Sugerencias automáticas y personalizadas de marketing, gestión de equipo y optimización financiera que se guardan en el historial del panel.

### 📥 7. Importación de Datos Inteligente
* **Procesamiento de Archivos Excel/CSV:** Parsers avanzados con validación de datos para importar de manera fluida registros de citas y balances desde otros software de gestión clínica populares.

---

## 🛠️ Stack Tecnológico

* **Frontend:** [React](https://react.dev/) (v18), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/)
* **Estilos & UI:** [Tailwind CSS](https://tailwindcss.com/), [Shadcn/ui](https://ui.shadcn.com/), [Lucide Icons](https://lucide.dev/)
* **Base de Datos & Backend:** [Supabase](https://supabase.com/) (PostgreSQL, Row Level Security, Edge Functions)
* **Consulta de Datos:** [TanStack Query](https://tanstack.com/query/latest) (React Query v5)
* **Gráficos:** [Recharts](https://recharts.org/)
* **Inteligencia Artificial:** API de [Google Gemini](https://ai.google.dev/) (integrada en Supabase Edge Functions)
* **Lectura de Ficheros:** [XLSX](https://sheetjs.com/) & [PapaParse](https://www.papaparse.com/)

---

## 📦 Estructura del Proyecto

```markdown
├── .env.example            # Plantilla de variables de entorno configuradas
├── DESPLEGAR_IA.ps1        # Script PowerShell para despliegue automático de IA en Supabase
├── index.html              # Entrada HTML principal de la SPA con metadatos personalizados
├── src/
│   ├── App.tsx             # Enrutador principal y configuración de Providers
│   ├── main.tsx            # Punto de entrada de React
│   ├── components/         # Componentes organizados por funcionalidad
│   │   ├── dashboard/      # Secciones del CRM (Overview, Finanzas, IA, Marketing, etc.)
│   │   └── ui/             # Componentes base reutilizables de Shadcn/ui
│   ├── hooks/              # Custom React Hooks (queries, mutaciones y lógica de negocio)
│   ├── integrations/       # Configuración y Tipos de la API de Supabase
│   ├── lib/                # Utilidades, parsers de CSV y validadores comunes
│   └── pages/              # Páginas principales (Index, Login, NotFound)
├── supabase/               # Backend-as-a-Service
│   ├── config.toml         # Configuración del proyecto Supabase
│   ├── migrations/         # Esquema de base de datos PostgreSQL y políticas RLS
│   └── functions/          # Serverless Edge Functions de Supabase (TypeScript)
└── scripts/                # Carpeta de utilidades y scripts locales de prueba de desarrollo
```

---

## 🔧 Configuración e Instalación Local

Para ejecutar este proyecto en tu entorno local, sigue estos pasos:

### 1. Requisitos Previos
Asegúrate de tener instalado [Node.js](https://nodejs.org/) (versión 18 o superior) y tu gestor de paquetes preferido (`npm`, `yarn` o `bun`).

### 2. Clonar el Repositorio
```bash
git clone https://github.com/sebasai26/healthcare-automation-platform.git
cd healthcare-automation-platform
```

### 3. Instalar Dependencias
```bash
npm install
```

### 4. Configurar Variables de Entorno
Copia el archivo de ejemplo y rellénalo con tus claves del proyecto Supabase y Gemini:
```bash
cp .env.example .env
```
Abre `.env` y define los valores necesarios:
* `VITE_SUPABASE_PROJECT_ID`: El identificador de tu proyecto Supabase.
* `VITE_SUPABASE_URL`: La URL pública de tu API REST de Supabase.
* `VITE_SUPABASE_PUBLISHABLE_KEY`: La clave de API anónima pública de tu cliente Supabase.
* `VITE_GEMINI_API_KEY`: Tu clave de desarrollo de Google Gemini AI (opcional para ejecución básica del frontend).

### 5. Configuración del Servidor de Base de Datos (Supabase)
Si deseas desplegar tu propio backend de base de datos, inicia sesión con Supabase CLI y aplica las migraciones que se encuentran en `/supabase/migrations`:
```bash
npx supabase login
npx supabase link --project-ref tu_project_id
npx supabase db push
```

### 6. Desplegar Edge Functions de IA
Puedes desplegar la función serverless de Gemini usando el script de PowerShell incluido:
```powershell
./DESPLEGAR_IA.ps1
```
*(Nota: El script te solicitará tu Gemini API Key si no está en el archivo `.env` para subirla de manera segura a los secretos de tu base de datos en Supabase).*

### 7. Ejecutar el Servidor de Desarrollo
```bash
npm run dev
```
La aplicación estará disponible localmente en `http://localhost:5173`.

---

## 🚪 Acceso de Demostración (Reclutadores)

Si se accede a la aplicación desplegada sin una cuenta activa en la base de datos de Supabase, es posible entrar al panel directamente utilizando el botón **"Acceso de Demostración (Invitado)"** ubicado en la pantalla de inicio de sesión. 

Este modo simula de forma local una sesión autenticada con privilegios para interactuar con las visualizaciones y funcionalidades del CRM clínico, permitiendo explorar la interfaz de manera fluida y sin bloqueos de login.

---

## ⚠️ Nota de Seguridad (Portfolio)

Este repositorio es una **versión de demostración para portfolio** y contiene simplificaciones de seguridad intencionadas para facilitar la evaluación:

* **Políticas RLS simplificadas:** Algunas tablas utilizan políticas `USING (true)` para permitir el acceso sin autenticación en el entorno de demo. En un entorno de producción real, estas políticas restringen el acceso por `auth.uid()` y rol de usuario.
* **Edge Functions con `verify_jwt = true`:** Todas las funciones serverless exigen un JWT válido. En desarrollo interno, algunas se configuraban con `verify_jwt = false` para pruebas locales.
* **Datos ficticios:** Todos los datos de pacientes, citas, campañas y sugerencias mostrados en el Modo Demo son completamente ficticios y no representan a personas reales.
* **Sin credenciales:** Este repositorio no contiene claves de API, tokens de acceso ni contraseñas. Las variables sensibles se gestionan a través de archivos `.env` (excluidos del control de versiones) y secretos de Supabase.
