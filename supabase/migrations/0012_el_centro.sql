-- ============================================================
-- HK23 — 0012 · EL CENTRO — bloque Agentes
-- Postulaciones, agentes de la comunidad, uso (calor del mapa), cuotas por persona,
-- pases comprados en Shopify y resultados de la prueba de entrada.
--
-- Todo lo escriben SOLO las funciones del servidor (/api/centro-*) con la service role.
-- RLS activado y sin políticas: nadie lee ni escribe estas tablas directo desde el navegador.
-- Solo tablas y funciones nuevas con prefijo centro_; no toca nada existente.
-- Idempotente: se puede correr de nuevo sin miedo.
-- ============================================================

create table if not exists public.centro_agentes (
  id          uuid primary key default gen_random_uuid(),
  bloque      text not null default 'agentes',
  nombre      text not null check (char_length(nombre) between 1 and 32),
  mundo       text not null check (char_length(mundo) between 1 and 24),
  forma       text not null check (forma in ('caza', 'hace', 'acom')),
  que         text not null check (char_length(que) between 1 and 140),
  por         text not null default '' check (char_length(por) <= 40),
  creador     uuid,                       -- id de la sesión de El Centro de quien lo postuló
  postulacion uuid,
  examen      jsonb,
  creado      timestamptz not null default now()
);
create index if not exists centro_agentes_creador on public.centro_agentes (creador);
create unique index if not exists centro_agentes_postulacion on public.centro_agentes (postulacion) where postulacion is not null;

create table if not exists public.centro_postulaciones (
  id        uuid primary key default gen_random_uuid(),
  bloque    text not null default 'agentes',
  nombre    text not null check (char_length(nombre) between 1 and 32),
  mundo     text not null check (char_length(mundo) between 1 and 24),
  forma     text not null check (forma in ('caza', 'hace', 'acom')),
  que       text not null check (char_length(que) between 1 and 140),
  por       text not null default '' check (char_length(por) <= 40),
  creador   uuid not null,
  estado    text not null default 'revision' check (estado in ('revision', 'aprobada', 'rechazada', 'no_paso')),
  examen    jsonb,
  creado    timestamptz not null default now(),
  decidido  timestamptz
);
create index if not exists centro_post_creador on public.centro_postulaciones (creador, creado desc);
create index if not exists centro_post_estado  on public.centro_postulaciones (estado, creado desc);

-- calor del mapa: usos totales por agente
create table if not exists public.centro_uso (
  agente      text primary key,
  usos        bigint not null default 0,
  actualizado timestamptz not null default now()
);

-- personas únicas atendidas por agente y día (base del reparto por mundo, más adelante)
create table if not exists public.centro_uso_personas (
  agente  text not null,
  persona uuid not null,
  dia     date not null default current_date,
  primary key (agente, persona, dia)
);

-- cuota de uso por persona y plan (gratis no se reinicia; pase y creador cada N días).
-- También lleva topes diarios por conexión (plan ip_*), con la IP convertida en un id opaco.
create table if not exists public.centro_cuotas (
  persona uuid not null,
  plan    text not null check (plan ~ '^[a-z_]{1,20}$'),
  desde   timestamptz not null default now(),
  usados  int not null default 0,
  primary key (persona, plan)
);

-- pases comprados en Shopify: un pedido vale para una sesión a la vez
create table if not exists public.centro_pases (
  pedido   text primary key,
  persona  uuid not null,
  vence    timestamptz not null,
  revisado timestamptz,                  -- última revisión del pedido en Shopify (reembolsos y cancelaciones)
  movido   timestamptz,                  -- última vez que el comprador lo movió a otro navegador
  creado   timestamptz not null default now()
);
create index if not exists centro_pases_persona on public.centro_pases (persona, vence desc);

-- prueba de entrada de los agentes de la casa (los postulados guardan la suya en la postulación)
create table if not exists public.centro_examenes (
  agente  text primary key,
  aprobado boolean not null,
  puntaje int,
  falla   text,
  motivo  text,
  creado  timestamptz not null default now()
);

-- si la migración ya había corrido con la versión anterior, la pone al día
alter table public.centro_pases add column if not exists revisado timestamptz;
alter table public.centro_pases add column if not exists movido timestamptz;
alter table public.centro_cuotas drop constraint if exists centro_cuotas_plan_check;
alter table public.centro_cuotas add constraint centro_cuotas_plan_check check (plan ~ '^[a-z_]{1,20}$');

alter table public.centro_agentes        enable row level security;
alter table public.centro_postulaciones  enable row level security;
alter table public.centro_uso            enable row level security;
alter table public.centro_uso_personas   enable row level security;
alter table public.centro_cuotas         enable row level security;
alter table public.centro_pases          enable row level security;
alter table public.centro_examenes       enable row level security;

-- Descuenta un uso de la cuota. Devuelve cuántos quedan (>= 0) o -1 si ya no hay.
-- Atómica: bloquea la fila mientras cuenta, así dos pedidos simultáneos no se saltan el tope.
create or replace function public.centro_consumir(p_persona uuid, p_plan text, p_tope int, p_periodo_dias int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare r public.centro_cuotas%rowtype;
begin
  insert into public.centro_cuotas (persona, plan) values (p_persona, p_plan)
    on conflict (persona, plan) do nothing;
  select * into r from public.centro_cuotas where persona = p_persona and plan = p_plan for update;
  if p_periodo_dias > 0 and r.desde < now() - make_interval(days => p_periodo_dias) then
    update public.centro_cuotas set desde = now(), usados = 0
      where persona = p_persona and plan = p_plan returning * into r;
  end if;
  if r.usados >= p_tope then
    return -1;
  end if;
  update public.centro_cuotas set usados = usados + 1 where persona = p_persona and plan = p_plan;
  return p_tope - r.usados - 1;
end;
$$;

-- Devuelve un uso cuando el agente no alcanzó a responder (error del modelo o del servidor).
create or replace function public.centro_devolver(p_persona uuid, p_plan text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.centro_cuotas set usados = greatest(usados - 1, 0) where persona = p_persona and plan = p_plan;
$$;

-- Suma calor al agente y anota a la persona atendida hoy.
create or replace function public.centro_registrar_uso(p_agente text, p_persona uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.centro_uso (agente, usos) values (p_agente, 1)
    on conflict (agente) do update set usos = public.centro_uso.usos + 1, actualizado = now();
  insert into public.centro_uso_personas (agente, persona) values (p_agente, p_persona)
    on conflict do nothing;
end;
$$;

-- Las funciones security definer quedan expuestas por la API a cualquiera si no se revocan.
revoke all on function public.centro_consumir(uuid, text, int, int)   from public, anon, authenticated;
revoke all on function public.centro_devolver(uuid, text)             from public, anon, authenticated;
revoke all on function public.centro_registrar_uso(text, uuid)        from public, anon, authenticated;
grant execute on function public.centro_consumir(uuid, text, int, int) to service_role;
grant execute on function public.centro_devolver(uuid, text)           to service_role;
grant execute on function public.centro_registrar_uso(text, uuid)      to service_role;
