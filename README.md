# 🛩️ NDT Warehouse — Gestión de Ensayos No Destructivos

Aplicación web para la gestión y administración del almacén NDT con
autenticación de dos factores (TOTP / Google Authenticator) y base de datos
Supabase (PostgreSQL).

## 🚀 Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Estilos:** Tailwind CSS (paleta Airbus)
- **Backend:** Supabase (Auth + PostgreSQL + Storage)
- **MFA:** TOTP compatible con Google Authenticator
- **Gráficos:** Recharts
- **Escáner:** ZXing (@zxing/library)

## 📋 Requisitos

- Node.js 18+
- Cuenta en [Supabase](https://supabase.com)
- Aplicación autenticadora (Google Authenticator, Authy, etc.)

## ⚙️ Instalación

```bash
# 1. Clonar / crear el proyecto
mkdir ndt-warehouse && cd ndt-warehouse

# 2. Copiar todos los archivos anteriores respetando la estructura

# 3. Instalar dependencias
npm install

# 4. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus claves de Supabase

# 5. Configurar la base de datos
# Ir al SQL Editor de Supabase y ejecutar supabase/schema.sql

# 6. Ejecutar en desarrollo
npm run dev