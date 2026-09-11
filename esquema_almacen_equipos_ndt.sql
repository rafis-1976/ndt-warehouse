-- =====================================================================
-- ESQUEMA DE BASE DE DATOS: GESTIÓN DE EQUIPOS NDT
-- (Almacén + Calibraciones + Préstamos + Códigos de barras + Estadísticas)
-- Diseñado para Supabase (PostgreSQL)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TÉCNICAS NDT (ET, UT, RT, TT...)
-- ---------------------------------------------------------------------
create table tecnicas_ndt (
    id bigint generated always as identity primary key,
    codigo text not null unique,        -- 'ET', 'UT', 'RT', 'TT'
    nombre text not null,               -- ej: "Ultrasonidos"
    descripcion text
);

insert into tecnicas_ndt (codigo, nombre) values
    ('ET', 'Corrientes Inducidas'),
    ('UT', 'Ultrasonidos'),
    ('RT', 'Radiografía'),
    ('TT', 'Termografía');

-- ---------------------------------------------------------------------
-- 2. PERFILES DE USUARIO Y ROLES
-- ---------------------------------------------------------------------
create table perfiles (
    id uuid primary key references auth.users(id) on delete cascade,
    nombre_completo text not null,
    rol text not null default 'tecnico'
        check (rol in ('admin', 'tma_jefe', 'ingeniero', 'tecnico', 'consulta')),
    tecnica_principal_id bigint references tecnicas_ndt(id),
    activo boolean default true,
    created_at timestamptz default now()
);

-- ---------------------------------------------------------------------
-- 3. UBICACIONES DE ALMACÉN
-- ---------------------------------------------------------------------
create table ubicaciones (
    id bigint generated always as identity primary key,
    codigo text not null unique,        -- ej: "A-03-02"
    descripcion text,
    created_at timestamptz default now()
);

-- ---------------------------------------------------------------------
-- 4. EQUIPOS (ficha maestra, identificados por código de barras)
-- ---------------------------------------------------------------------
create table equipos (
    id bigint generated always as identity primary key,
    codigo_barras text not null unique,     -- valor escaneado
    numero_serie text unique,
    nombre text not null,                   -- ej: "Equipo de ultrasonidos Olympus"
    marca text,
    modelo text,
    tecnica_id bigint not null references tecnicas_ndt(id),
    ubicacion_id bigint references ubicaciones(id),
    estado text not null default 'disponible'
        check (estado in ('disponible', 'prestado', 'en_calibracion', 'baja', 'averiado')),
    requiere_calibracion boolean default true,
    periodicidad_calibracion_meses integer default 12,
    fecha_alta date default current_date,
    activo boolean default true,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create index idx_equipos_codigo_barras on equipos(codigo_barras);
create index idx_equipos_tecnica on equipos(tecnica_id);
create index idx_equipos_estado on equipos(estado);

-- ---------------------------------------------------------------------
-- 5. CALIBRACIONES (envíos a calibrar y su histórico)
-- ---------------------------------------------------------------------
create table calibraciones (
    id bigint generated always as identity primary key,
    equipo_id bigint not null references equipos(id),
    empresa_calibradora text,
    fecha_envio date not null,
    fecha_retorno_prevista date,
    fecha_retorno_real date,
    numero_certificado text,
    certificado_url text,               -- si subes el PDF a Supabase Storage
    resultado text check (resultado in ('apto', 'no_apto', 'pendiente')) default 'pendiente',
    fecha_proxima_calibracion date,
    usuario_gestor_id uuid references perfiles(id),
    observaciones text,
    created_at timestamptz default now()
);

create index idx_calibraciones_equipo on calibraciones(equipo_id);
create index idx_calibraciones_proxima on calibraciones(fecha_proxima_calibracion);

-- ---------------------------------------------------------------------
-- 6. PRÉSTAMOS / EXTRACCIONES TEMPORALES (uso diario)
-- ---------------------------------------------------------------------
create table prestamos (
    id bigint generated always as identity primary key,
    equipo_id bigint not null references equipos(id),
    usuario_id uuid not null references perfiles(id),
    fecha_salida timestamptz not null default now(),
    fecha_devolucion_prevista date,
    fecha_devolucion_real timestamptz,
    motivo text,                        -- ej: "inspección planta X", "viaje en noria"
    estado text not null default 'activo'
        check (estado in ('activo', 'devuelto', 'vencido')),
    observaciones text,
    created_at timestamptz default now()
);

create index idx_prestamos_equipo on prestamos(equipo_id);
create index idx_prestamos_usuario on prestamos(usuario_id);
create index idx_prestamos_estado on prestamos(estado);

-- ---------------------------------------------------------------------
-- 7. HISTORIAL DE MOVIMIENTOS (log de cada escaneo/evento del equipo)
-- ---------------------------------------------------------------------
create table historial_movimientos (
    id bigint generated always as identity primary key,
    equipo_id bigint not null references equipos(id),
    tipo text not null check (tipo in (
        'salida_prestamo', 'entrada_devolucion',
        'envio_calibracion', 'retorno_calibracion',
        'cambio_ubicacion', 'alta', 'baja'
    )),
    usuario_id uuid references perfiles(id),
    referencia_id bigint,               -- id del préstamo o calibración relacionado
    fecha timestamptz default now(),
    notas text
);

create index idx_historial_equipo on historial_movimientos(equipo_id);
create index idx_historial_fecha on historial_movimientos(fecha);

-- =====================================================================
-- TRIGGERS: mantener el estado del equipo sincronizado
-- =====================================================================

-- Al crear un préstamo -> equipo pasa a "prestado" + log
create or replace function tr_prestamo_insert()
returns trigger as $$
begin
    update equipos set estado = 'prestado', updated_at = now() where id = new.equipo_id;
    insert into historial_movimientos (equipo_id, tipo, usuario_id, referencia_id, notas)
    values (new.equipo_id, 'salida_prestamo', new.usuario_id, new.id, new.motivo);
    return new;
end;
$$ language plpgsql;

create trigger trg_prestamo_insert
after insert on prestamos
for each row execute function tr_prestamo_insert();

-- Al marcar devolución -> equipo vuelve a "disponible" + log
create or replace function tr_prestamo_devolucion()
returns trigger as $$
begin
    if new.estado = 'devuelto' and old.estado <> 'devuelto' then
        update equipos set estado = 'disponible', updated_at = now() where id = new.equipo_id;
        insert into historial_movimientos (equipo_id, tipo, usuario_id, referencia_id)
        values (new.equipo_id, 'entrada_devolucion', new.usuario_id, new.id);
    end if;
    return new;
end;
$$ language plpgsql;

create trigger trg_prestamo_devolucion
after update on prestamos
for each row execute function tr_prestamo_devolucion();

-- Al enviar a calibración -> equipo pasa a "en_calibracion" + log
create or replace function tr_calibracion_insert()
returns trigger as $$
begin
    update equipos set estado = 'en_calibracion', updated_at = now() where id = new.equipo_id;
    insert into historial_movimientos (equipo_id, tipo, usuario_id, referencia_id, notas)
    values (new.equipo_id, 'envio_calibracion', new.usuario_gestor_id, new.id, new.empresa_calibradora);
    return new;
end;
$$ language plpgsql;

create trigger trg_calibracion_insert
after insert on calibraciones
for each row execute function tr_calibracion_insert();

-- Al registrar retorno de calibración -> equipo vuelve a "disponible" + log
create or replace function tr_calibracion_retorno()
returns trigger as $$
begin
    if new.fecha_retorno_real is not null and old.fecha_retorno_real is null then
        update equipos set estado = 'disponible', updated_at = now() where id = new.equipo_id;
        insert into historial_movimientos (equipo_id, tipo, usuario_id, referencia_id, notas)
        values (new.equipo_id, 'retorno_calibracion', new.usuario_gestor_id, new.id, new.resultado);
    end if;
    return new;
end;
$$ language plpgsql;

create trigger trg_calibracion_retorno
after update on calibraciones
for each row execute function tr_calibracion_retorno();

-- =====================================================================
-- VISTAS: ESTADÍSTICAS E HISTORIAL DE USO
-- =====================================================================

-- Calibraciones próximas a vencer (útil para alertas)
create view vista_calibraciones_pendientes as
select
    e.id as equipo_id,
    e.codigo_barras,
    e.nombre,
    t.codigo as tecnica,
    c.fecha_proxima_calibracion,
    (c.fecha_proxima_calibracion - current_date) as dias_restantes
from equipos e
join tecnicas_ndt t on t.id = e.tecnica_id
left join lateral (
    select * from calibraciones
    where equipo_id = e.id
    order by fecha_retorno_real desc nulls last
    limit 1
) c on true
where c.fecha_proxima_calibracion is not null
order by c.fecha_proxima_calibracion asc;

-- Uso de equipos por técnica y usuario (estadísticas)
create view vista_estadisticas_uso as
select
    e.id as equipo_id,
    e.codigo_barras,
    e.nombre,
    t.codigo as tecnica,
    count(p.id) as veces_prestado,
    sum(
        extract(epoch from (coalesce(p.fecha_devolucion_real, now()) - p.fecha_salida)) / 86400
    ) as dias_totales_uso,
    max(p.fecha_salida) as ultimo_uso
from equipos e
join tecnicas_ndt t on t.id = e.tecnica_id
left join prestamos p on p.equipo_id = e.id
group by e.id, e.codigo_barras, e.nombre, t.codigo;

-- Equipos actualmente en préstamo (control operativo diario)
create view vista_equipos_prestados as
select
    p.id as prestamo_id,
    e.codigo_barras,
    e.nombre,
    perf.nombre_completo as usuario,
    p.fecha_salida,
    p.fecha_devolucion_prevista,
    case when p.fecha_devolucion_prevista < current_date then true else false end as vencido
from prestamos p
join equipos e on e.id = p.equipo_id
join perfiles perf on perf.id = p.usuario_id
where p.estado = 'activo';

-- =====================================================================
-- SEGURIDAD: ROW LEVEL SECURITY (RLS)
-- =====================================================================
alter table equipos enable row level security;
alter table calibraciones enable row level security;
alter table prestamos enable row level security;
alter table historial_movimientos enable row level security;

-- Lectura para cualquier usuario autenticado
create policy "lectura_equipos" on equipos for select using (auth.role() = 'authenticated');
create policy "lectura_calibraciones" on calibraciones for select using (auth.role() = 'authenticated');
create policy "lectura_prestamos" on prestamos for select using (auth.role() = 'authenticated');
create policy "lectura_historial" on historial_movimientos for select using (auth.role() = 'authenticated');

-- Cualquier técnico autenticado puede crear su propio préstamo (extracción diaria)
create policy "crear_prestamo_propio" on prestamos for insert
with check (usuario_id = auth.uid());

-- Solo el propio usuario o admin/tma_jefe pueden marcar devolución
create policy "actualizar_prestamo" on prestamos for update
using (
    usuario_id = auth.uid()
    or exists (select 1 from perfiles where id = auth.uid() and rol in ('admin', 'tma_jefe'))
);

-- Solo admin/tma_jefe/ingeniero gestionan calibraciones y altas de equipo
create policy "gestionar_calibraciones" on calibraciones for insert
with check (
    exists (select 1 from perfiles where id = auth.uid() and rol in ('admin', 'tma_jefe', 'ingeniero'))
);

create policy "gestionar_equipos" on equipos for insert
with check (
    exists (select 1 from perfiles where id = auth.uid() and rol in ('admin', 'tma_jefe', 'ingeniero'))
);

create policy "modificar_equipos" on equipos for update
using (
    exists (select 1 from perfiles where id = auth.uid() and rol in ('admin', 'tma_jefe', 'ingeniero'))
);
