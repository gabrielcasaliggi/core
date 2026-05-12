-- ══════════════════════════════════════════════════════════════════
-- VERTIA CORE — Schema inicial
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ══════════════════════════════════════════════════════════════════

-- ── Tabla: routers ────────────────────────────────────────────────
-- Almacena la configuración de cada router MikroTik registrado.
-- Reemplaza los bloques ROUTER_*_* de .env.local a largo plazo.

create table if not exists public.routers (
  id                       uuid primary key default gen_random_uuid(),
  site_id                  text unique not null,
  display_name             text not null,
  short_name               text not null,
  site_type                text not null check (site_type in ('headquarters','branch','remote','studio')),
  lat                      numeric(9,6) not null,
  lng                      numeric(9,6) not null,
  host                     text not null,
  port                     integer not null default 80,
  protocol                 text not null default 'http' check (protocol in ('http','https')),
  username                 text not null,
  password                 text not null,
  tls_reject_unauthorized  boolean not null default false,
  provider                 text,
  bandwidth_mbps           integer not null default 100,
  wan_type                 text not null default 'fiber' check (wan_type in ('fiber','radiolink','starlink','vpn')),
  enabled                  boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- Trigger para updated_at automático
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists routers_updated_at on public.routers;
create trigger routers_updated_at
  before update on public.routers
  for each row execute function public.set_updated_at();

-- ── Tabla: provisioning_jobs ──────────────────────────────────────
-- Historial de trabajos de aprovisionamiento.

create table if not exists public.provisioning_jobs (
  id             uuid primary key default gen_random_uuid(),
  router_id      uuid references public.routers(id) on delete set null,
  site_name      text not null,
  template_id    text not null,
  hardware       text not null,
  status         text not null default 'pending' check (status in ('pending','running','success','error')),
  started_at     timestamptz not null default now(),
  completed_at   timestamptz,
  steps          jsonb not null default '[]'::jsonb,
  error_message  text,
  metadata       jsonb
);

-- Índice para listar historial por fecha
create index if not exists provisioning_jobs_started_at_idx
  on public.provisioning_jobs (started_at desc);

-- ── Tabla: alerts ─────────────────────────────────────────────────
-- Alertas persistentes de la red.

create table if not exists public.alerts (
  id               uuid primary key default gen_random_uuid(),
  site_id          text not null,
  severity         text not null check (severity in ('info','warning','critical')),
  message          text not null,
  created_at       timestamptz not null default now(),
  acknowledged     boolean not null default false,
  acknowledged_at  timestamptz,
  acknowledged_by  text
);

create index if not exists alerts_site_id_idx      on public.alerts (site_id);
create index if not exists alerts_acknowledged_idx on public.alerts (acknowledged) where acknowledged = false;

-- ── Habilitar Realtime en provisioning_jobs ───────────────────────
-- Permite que el dashboard reciba updates en tiempo real del job.
alter publication supabase_realtime add table public.provisioning_jobs;
alter publication supabase_realtime add table public.alerts;

-- ── Seed: router de oficina (el que ya está funcionando) ──────────
-- Ajustar los valores según .env.local
insert into public.routers (
  site_id, display_name, short_name, site_type,
  lat, lng, host, port, protocol,
  username, password, tls_reject_unauthorized,
  provider, bandwidth_mbps, wan_type
) values (
  'site-office', 'Oficina', 'OFC', 'branch',
  -32.89, -60.64,
  'hge09ha1kc3.sn.mynetname.net', 80, 'http',
  'admin', 'Verystr0ng!!!', false,
  'ISP', 100, 'fiber'
) on conflict (site_id) do nothing;
