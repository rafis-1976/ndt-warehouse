-- =====================================================================
-- ESQUEMA DE BASE DE DATOS: GESTIÓN DE EQUIPOS NDT
-- Supabase (PostgreSQL)
-- =====================================================================

-- 1. TÉCNICAS NDT
CREATE TABLE IF NOT EXISTS tecnicas_ndt (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    imagen_url TEXT,
    activa BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO tecnicas_ndt (codigo, nombre, descripcion, imagen_url) VALUES
('UT', 'Ultrasonic Testing', 'Ensayos por ultrasonidos para detección de defectos internos', '/images/ndt/ut.jpg'),
('RT', 'Radiographic Testing', 'Ensayos por rayos X o gamma para inspección volumétrica', '/images/ndt/rt.jpg'),
('ET', 'Eddy Current Testing', 'Corrientes inducidas para detección de grietas superficiales', '/images/ndt/et.jpg'),
('TT', 'Thermographic Testing', 'Termografía infrarroja para detección de anomalías térmicas', '/images/ndt/tt.jpg'),
('MT', 'Magnetic Particle Testing', 'Partículas magnéticas para detección de discontinuidades', '/images/ndt/mt.jpg'),
('PT', 'Penetrant Testing', 'Líquidos penetrantes para defectos superficiales', '/images/ndt/pt.jpg')
ON CONFLICT (codigo) DO NOTHING;

-- 2. PERFILES (vinculados a auth.users)
CREATE TABLE IF NOT EXISTS perfiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre_completo TEXT NOT NULL,
    email TEXT NOT NULL,
    rol TEXT DEFAULT 'tecnico' CHECK (rol IN ('admin', 'supervisor', 'tecnico')),
    activo BOOLEAN DEFAULT TRUE,
    telefono TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para crear perfil automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.perfiles (id, nombre_completo, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'nombre_completo', 'Usuario'),
        NEW.email
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. EQUIPOS NDT
CREATE TABLE IF NOT EXISTS equipos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_barras TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    marca TEXT,
    modelo TEXT,
    numero_serie TEXT UNIQUE,
    tecnica_id UUID REFERENCES tecnicas_ndt(id),
    estado TEXT DEFAULT 'disponible'
        CHECK (estado IN ('disponible', 'prestado', 'calibracion', 'mantenimiento', 'baja')),
    ubicacion TEXT,
    fecha_adquisicion DATE,
    vida_util_meses INTEGER,
    proxima_calibracion DATE,
    ultima_calibracion DATE,
    certificado_calibracion TEXT,
    observaciones TEXT,
    imagen_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CALIBRACIONES
CREATE TABLE IF NOT EXISTS calibraciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipo_id UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
    fecha_calibracion DATE NOT NULL,
    fecha_proxima DATE NOT NULL,
    laboratorio TEXT,
    numero_certificado TEXT,
    resultado TEXT CHECK (resultado IN ('aprobado', 'rechazado', 'condicional')),
    observaciones TEXT,
    archivo_url TEXT,
    tecnico_id UUID REFERENCES perfiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PRÉSTAMOS
CREATE TABLE IF NOT EXISTS prestamos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipo_id UUID NOT NULL REFERENCES equipos(id),
    usuario_id UUID NOT NULL REFERENCES perfiles(id),
    fecha_prestamo TIMESTAMPTZ DEFAULT NOW(),
    fecha_devolucion_prevista TIMESTAMPTZ,
    fecha_devolucion_real TIMESTAMPTZ,
    estado TEXT DEFAULT 'activo'
        CHECK (estado IN ('activo', 'devuelto', 'retrasado', 'perdido')),
    observaciones TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. MOVIMIENTOS
CREATE TABLE IF NOT EXISTS movimientos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipo_id UUID NOT NULL REFERENCES equipos(id),
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'salida', 'transferencia', 'ajuste')),
    cantidad INTEGER DEFAULT 1,
    ubicacion_origen TEXT,
    ubicacion_destino TEXT,
    usuario_id UUID REFERENCES perfiles(id),
    referencia TEXT,
    observaciones TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. MANTENIMIENTOS
CREATE TABLE IF NOT EXISTS mantenimientos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipo_id UUID NOT NULL REFERENCES equipos(id),
    tipo TEXT CHECK (tipo IN ('preventivo', 'correctivo', 'predictivo')),
    descripcion TEXT,
    fecha_inicio DATE,
    fecha_fin DATE,
    coste NUMERIC(10,2),
    proveedor TEXT,
    estado TEXT DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'en_proceso', 'completado')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
ALTER TABLE tecnicas_ndt ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE prestamos ENABLE ROW LEVEL SECURITY;
ALTER TABLE calibraciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE mantenimientos ENABLE ROW LEVEL SECURITY;

-- Lectura para usuarios autenticados
CREATE POLICY "Lectura autenticada tecnicas" ON tecnicas_ndt
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lectura autenticada equipos" ON equipos
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lectura autenticada calibraciones" ON calibraciones
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lectura autenticada prestamos" ON prestamos
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lectura autenticada movimientos" ON movimientos
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lectura autenticada mantenimientos" ON mantenimientos
    FOR SELECT TO authenticated USING (true);

-- Perfil propio
CREATE POLICY "Usuario ve su perfil" ON perfiles
    FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Usuario actualiza su perfil" ON perfiles
    FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Escritura solo admin/supervisor
CREATE POLICY "Admin/supervisor gestionan equipos" ON equipos
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin','supervisor')))
    WITH CHECK (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin','supervisor')));

CREATE POLICY "Admin/supervisor gestionan prestamos" ON prestamos
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin','supervisor')))
    WITH CHECK (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin','supervisor')));

CREATE POLICY "Admin/supervisor gestionan calibraciones" ON calibraciones
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin','supervisor')))
    WITH CHECK (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin','supervisor')));

CREATE POLICY "Admin/supervisor gestionan movimientos" ON movimientos
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin','supervisor')))
    WITH CHECK (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin','supervisor')));

CREATE POLICY "Admin/supervisor gestionan mantenimientos" ON mantenimientos
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin','supervisor')))
    WITH CHECK (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin','supervisor')));

-- =====================================================================
-- ÍNDICES
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_equipos_tecnica ON equipos(tecnica_id);
CREATE INDEX IF NOT EXISTS idx_equipos_estado ON equipos(estado);
CREATE INDEX IF NOT EXISTS idx_equipos_codigo_barras ON equipos(codigo_barras);
CREATE INDEX IF NOT EXISTS idx_prestamos_usuario ON prestamos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_prestamos_equipo ON prestamos(equipo_id);
CREATE INDEX IF NOT EXISTS idx_calibraciones_equipo ON calibraciones(equipo_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_equipo ON movimientos(equipo_id);