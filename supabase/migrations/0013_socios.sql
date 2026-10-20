-- ============================================================================
-- HK23 — 0013 · Freelancers Fundadores: freelancers que venden los productos de HK23
-- ADITIVA · IDEMPOTENTE · se puede correr dos veces (no pisa la configuración ni el catálogo que ya editaste)
--
-- CÓMO APLICAR
--   1. Supabase → proyecto iiqhhglgjsbnuihythko → SQL Editor → New query.
--   2. Pega este archivo entero.
--   3. ANTES de correr: reemplaza __SET_ADMIN_TOKEN__ (bloque "Clave del panel", al final) por una clave
--      larga tuya: mínimo 24 caracteres (en la terminal: openssl rand -hex 24). Es la que abre /socios-admin.
--      Si lo corres sin reemplazarla, el panel queda cerrado y se conserva la clave que hubiera antes.
--   4. Run.
--
-- QUÉ HACE
--   • Antes de la fecha de apertura (config 'abre') solo se puede anotar en la lista de espera.
--   • Desde la apertura se postula. Postular exige aceptar que las ventas propias se publiquen
--     (alias, número de ventas y montos) como datos reales de la etapa 2.
--   • Al aprobar, el socio recibe un código (el mismo que se crea como código de descuento en Shopify),
--     una llave para su panel privado y su comisión: fundador mientras queden cupos en la etapa 1.
--   • Las ventas entran solas desde Shopify (edge function socios-shopify) o las registra el dueño a mano.
--   • Los números siempre cuadran a favor de HK23:
--       ganancia = lo que pagó el cliente − costo del producto (costo_pct sobre el precio de lista)
--       comisión = % del socio × ganancia, con el % siempre menor a 50 → HK23 se queda con la mayor parte
--       el descuento del código + el costo de cada producto de la tienda nunca llegan a 100 %
--   • El ranking público se muestra solo en la etapa 2.
--
-- MODELO DE SEGURIDAD
--   • 5 tablas con RLS y SIN políticas; todo revocado a anon/authenticated → PostgREST no las expone.
--   • Las únicas puertas son funciones security definer:
--       públicas (clave anon):  socios_estado, socios_anotar, socios_postular, socios_mi_panel
--       panel del dueño:        socios_admin (exige la clave; la base guarda solo su sha256)
--       solo servidor:          socios_registrar_shopify (service_role; la llama la edge function)
--   • Lo público nunca devuelve correos, teléfonos ni llaves de otras personas.
--   • Topes de envíos: 8 por IP al día (si la IP llega en los headers) y 400 en total al día.
--   • Errores: raise 'socios: <motivo>' → PostgREST responde 400 {message}.
--   • Cada función fija search_path y timezone UTC.
-- ============================================================================

-- ----------------------------------------------------------------------------- tablas
create table if not exists public.socios_config (
  key   text primary key,
  value text not null
);

insert into public.socios_config (key, value) values
  ('abre',               '2026-10-27T15:00:00Z'),            -- martes 27 oct 2026, 12:00 en Chile
  ('etapa',              '1'),                               -- 1 = fundadores · 2 = ranking público
  ('cupos',              '20'),                              -- cupos de fundador
  ('comision_fundador',  '49'),                              -- % por venta para fundadores (casi la mitad: por eso hay cupos)
  ('comision_normal',    '10'),                              -- % por venta desde la etapa 2
  ('descuento',          '10'),                              -- % que obtiene el comprador con el código
  ('mostrar_desde',      '10'),                              -- muestra "N interesados" desde este número
  ('tienda',             'https://fcqevq-jr.myshopify.com'), -- tienda Shopify HK23 STUDIO
  ('panel_url',          'https://hk23universe.vercel.app/socios'),
  ('admin_token_sha256', 'unset')
on conflict (key) do nothing;

create table if not exists public.socios_productos (
  id          bigint generated always as identity primary key,
  clave       text not null unique check (clave ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  nombre      text not null check (char_length(nombre) between 2 and 80),
  marca       text not null default '' check (char_length(marca) <= 40),
  categoria   text not null default '' check (char_length(categoria) <= 30),
  descripcion text not null default '' check (char_length(descripcion) <= 300),
  precio      text not null default '' check (char_length(precio) <= 40),
  url         text null check (url is null or (char_length(url) <= 300 and url ~ '^https://[^[:space:]<>"'']{4,}$')),
  canal       text not null default 'directo' check (canal in ('shopify', 'directo')),
  -- lo que cuesta fabricar, enviar y cobrar una venta, como % del precio de lista. La comisión se paga sobre lo que queda.
  costo_pct   numeric(5,2) not null default 15 check (costo_pct between 0 and 95),
  estado      text not null default 'proximamente' check (estado in ('disponible', 'proximamente', 'oculto')),
  color       text not null default '#FFD200' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  orden       int  not null default 100,
  creado      timestamptz not null default now()
);

-- Catálogo inicial. Solo la tienda está a la venta hoy; el resto se activa desde /socios-admin cuando esté listo.
-- Costos: la tienda usa el peor caso real de Printify en Shopify (posters PROOF OF WORK: 57 % del precio)
-- más 5 % de cobro = 62 %. Los productos digitales llevan 15 % por plataforma y medios de pago.
insert into public.socios_productos (clave, nombre, marca, categoria, descripcion, precio, url, canal, costo_pct, estado, color, orden) values
  ('agentes-pixel', 'Ecosistema de agentes Pixel', 'Pixel', 'AGENTES IA',
   'El equipo de agentes de IA que crea productos, escribe sus fichas y los publica en la tienda. La tienda HK23 STUDIO es su prueba de trabajo.',
   '', null, 'directo', 15, 'proximamente', '#AAFF00', 10),
  ('tienda-hk23-studio', 'Tienda HK23 STUDIO', 'Proof of Work', 'ARTE · OBJETOS',
   'Posters, stickers y ediciones PROOF OF WORK publicados por los agentes. Se imprimen bajo pedido.',
   'desde US$3', 'https://fcqevq-jr.myshopify.com', 'shopify', 62, 'disponible', '#FF3A1F', 20),
  ('el-centro', 'El Centro', 'El Centro', 'MERCADO DE AGENTES',
   'Un mercado de agentes de IA vivos: se usan en el navegador y cualquiera puede postular el suyo.',
   '', null, 'directo', 15, 'proximamente', '#FFD200', 30),
  ('universo-hk23', 'Universo HK23', 'HK23 OS', 'SISTEMA',
   'El universo HK23: frameworks, blueprints y agentes para construir y operar proyectos.',
   '', null, 'directo', 15, 'proximamente', '#00F0FF', 40),
  ('app-golf', 'App de golf ViceGolfer', 'Vice Golfer', 'APP · GOLF',
   'La app de golf de HK23.',
   '', null, 'directo', 15, 'proximamente', '#B84DFF', 50),
  ('rugby-vice', 'Rugby Vice', 'Rugby Vice', 'APP · RUGBY',
   'La app de rugby de HK23.',
   '', null, 'directo', 15, 'proximamente', '#00F0FF', 60),
  ('libros-guias', 'Libros y guías HK23', 'Libros', 'LIBROS · GUÍAS',
   'Libros y guías escritos en HK23.',
   '', null, 'directo', 15, 'proximamente', '#FFD200', 70)
on conflict (clave) do nothing;

create table if not exists public.socios (
  id          bigint generated always as identity primary key,
  email       text not null unique check (email = lower(email) and char_length(email) <= 120
                                          and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  nombre      text not null check (char_length(nombre) between 2 and 80),
  alias       text null check (alias is null or char_length(alias) between 2 and 32),
  whatsapp    text null check (whatsapp is null or char_length(whatsapp) <= 30),
  pais        text null check (pais is null or char_length(pais) <= 40),
  red         text null check (red is null or char_length(red) <= 160),
  canal       text null check (canal is null or char_length(canal) <= 500),
  intereses   text[] not null default '{}' check (cardinality(intereses) <= 20),
  consiente   boolean not null default false,
  estado      text not null default 'lista' check (estado in ('lista', 'postulado', 'aprobado', 'rechazado')),
  fundador_n  int  null unique check (fundador_n is null or fundador_n > 0),
  codigo      text null unique check (codigo is null or codigo ~ '^[A-Z0-9][A-Z0-9-]{3,23}$'),
  llave       text null unique check (llave is null or llave ~ '^[0-9a-f]{32}$'),
  comision    numeric(5,2) null check (comision is null or (comision >= 0 and comision < 50)), -- % de la ganancia; HK23 siempre se queda con más
  creado      timestamptz not null default now(),
  postulado   timestamptz null,
  decidido    timestamptz null,
  check (estado <> 'aprobado' or (codigo is not null and llave is not null and comision is not null and consiente))
);

create table if not exists public.socios_ventas (
  id           bigint generated always as identity primary key,
  socio_id     bigint not null references public.socios (id) on delete restrict,
  origen       text not null check (origen in ('shopify', 'manual')),
  referencia   text not null check (char_length(referencia) between 1 and 80),
  producto_id  bigint null references public.socios_productos (id) on delete set null,
  detalle      text not null default '' check (char_length(detalle) <= 200),
  monto        numeric(12,2) not null check (monto >= 0),        -- USD que pagó el cliente, sin envío ni impuestos
  lista        numeric(12,2) not null check (lista >= 0),        -- USD a precio de lista, antes del descuento del código
  costo_pct    numeric(5,2) not null check (costo_pct between 0 and 95), -- costo del producto al momento de la venta
  reembolsado  numeric(12,2) not null default 0 check (reembolsado >= 0),
  reembolsos   text[] not null default '{}',                     -- ids de reembolso ya aplicados
  comision_pct numeric(5,2) not null check (comision_pct >= 0 and comision_pct < 50),
  estado       text not null default 'valida' check (estado in ('valida', 'anulada')),
  fecha        timestamptz not null default now(),
  creado       timestamptz not null default now(),
  unique (origen, referencia)
);
create index if not exists socios_ventas_socio_idx on public.socios_ventas (socio_id, fecha desc);

create table if not exists public.socios_cuotas (
  clave text not null,
  dia   date not null,
  n     int  not null default 0,
  primary key (clave, dia)
);

alter table public.socios_config    enable row level security;
alter table public.socios_productos enable row level security;
alter table public.socios           enable row level security;
alter table public.socios_ventas    enable row level security;
alter table public.socios_cuotas    enable row level security;

revoke all on table public.socios_config, public.socios_productos, public.socios,
                    public.socios_ventas, public.socios_cuotas
  from public, anon, authenticated;

-- ----------------------------------------------------------------------------- utilidades internas
create or replace function public.socios__cfg(p_key text)
returns text language sql stable set search_path = public
as $$ select value from public.socios_config where key = p_key $$;

-- texto limpio: sin caracteres de control, espacios recortados, largo máximo; vacío → null
create or replace function public.socios__txt(p text, p_max int)
returns text language sql immutable set search_path = public
as $$ select nullif(left(btrim(regexp_replace(coalesce(p, ''), '[[:cntrl:]]', ' ', 'g')), p_max), '') $$;

create or replace function public.socios__num(p text)
returns numeric language plpgsql immutable set search_path = public
as $$ begin return nullif(btrim(coalesce(p, '')), '')::numeric; exception when others then return null; end $$;

create or replace function public.socios__ts(p text)
returns timestamptz language plpgsql stable set search_path = public set timezone = 'UTC'
as $$ begin return nullif(btrim(coalesce(p, '')), '')::timestamptz; exception when others then return null; end $$;

create or replace function public.socios__email(p text)
returns text language sql immutable set search_path = public
as $$
  select case when char_length(e) <= 120 and e ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then e end
    from (select lower(btrim(coalesce(p, ''))) as e) x
$$;

-- IP del visitante (cf-connecting-ip o x-forwarded-for de PostgREST), como hash; null si no llega
create or replace function public.socios__ip()
returns text language plpgsql stable set search_path = public
as $$
declare h json; ip text;
begin
  begin
    h := nullif(current_setting('request.headers', true), '')::json;
  exception when others then h := null;
  end;
  ip := coalesce(nullif(btrim(h->>'cf-connecting-ip'), ''),
                 nullif(btrim(split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1)), ''));
  if ip is null then return null; end if;
  return 'ip:' || encode(sha256(convert_to(ip, 'UTF8')), 'hex');
end $$;

create or replace function public.socios__cuota(p_clave text, p_tope int)
returns boolean language plpgsql set search_path = public set timezone = 'UTC'
as $$
declare k int;
begin
  insert into public.socios_cuotas (clave, dia, n) values (p_clave, current_date, 1)
    on conflict (clave, dia) do update set n = public.socios_cuotas.n + 1
    returning n into k;
  return k <= p_tope;
end $$;

-- topes de envíos públicos (un envío rechazado más adelante revierte su propio conteo)
create or replace function public.socios__topes()
returns void language plpgsql set search_path = public
as $$
declare ip text := public.socios__ip();
begin
  if ip is not null and not public.socios__cuota(ip, 8) then
    raise exception 'socios: muchos_envios';
  end if;
  if not public.socios__cuota('global', 400) then
    raise exception 'socios: cupo_diario';
  end if;
end $$;

-- monto neto de una venta: lo pagado menos lo reembolsado; 0 si se anuló
create or replace function public.socios__neto(p_estado text, p_monto numeric, p_reembolsado numeric)
returns numeric language sql immutable set search_path = public
as $$ select case when p_estado = 'valida' then greatest(p_monto - p_reembolsado, 0) else 0 end $$;

-- ganancia de una venta: lo que pagó el cliente (neto de reembolsos) menos el costo, calculado sobre el precio de
-- lista (el descuento del código no abarata la fabricación). Nunca negativa. Con un reembolso parcial, el costo se
-- descuenta en la misma proporción que la venta.
create or replace function public.socios__ganancia(p_estado text, p_monto numeric, p_reembolsado numeric,
                                                   p_lista numeric, p_costo numeric)
returns numeric language sql immutable set search_path = public
as $$
  select case when p_monto > 0
              then greatest(round(public.socios__neto(p_estado, p_monto, p_reembolsado)
                                  * (1 - p_costo / 100 * greatest(p_lista, p_monto) / p_monto), 2), 0)
              else 0 end
$$;

-- comisión del socio: su % (siempre < 50) de la ganancia. HK23 se queda con el resto, que siempre es más.
create or replace function public.socios__comision(p_estado text, p_monto numeric, p_reembolsado numeric,
                                                   p_lista numeric, p_costo numeric, p_pct numeric)
returns numeric language sql immutable set search_path = public
as $$ select round(public.socios__ganancia(p_estado, p_monto, p_reembolsado, p_lista, p_costo) * p_pct / 100, 2) $$;

create or replace function public.socios__alias(p_alias text, p_nombre text)
returns text language sql immutable set search_path = public
as $$ select coalesce(p_alias, split_part(p_nombre, ' ', 1)) $$;

create or replace function public.socios__slug(p text)
returns text language sql immutable set search_path = public
as $$
  select btrim(regexp_replace(lower(translate(coalesce(p, ''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun')), '[^a-z0-9]+', '-', 'g'), '-')
$$;

-- ----------------------------------------------------------------------------- públicas
create or replace function public.socios_estado()
returns jsonb
language plpgsql stable security definer
set search_path = public set timezone = 'UTC'
as $$
declare
  v_etapa int := coalesce(public.socios__num(public.socios__cfg('etapa')), 1)::int;
  r jsonb;
begin
  r := jsonb_build_object(
    'ahora',             now(),
    'abre',              public.socios__ts(public.socios__cfg('abre')),
    'abierto',           now() >= coalesce(public.socios__ts(public.socios__cfg('abre')), 'infinity'::timestamptz),
    'etapa',             v_etapa,
    'cupos',             public.socios__num(public.socios__cfg('cupos')),
    'fundadores',        (select count(*) from public.socios where estado = 'aprobado' and fundador_n is not null),
    'interesados',       (select count(*) from public.socios where estado in ('lista', 'postulado', 'aprobado')),
    'mostrar_desde',     public.socios__num(public.socios__cfg('mostrar_desde')),
    'comision_fundador', public.socios__num(public.socios__cfg('comision_fundador')),
    'comision_normal',   public.socios__num(public.socios__cfg('comision_normal')),
    'descuento',         public.socios__num(public.socios__cfg('descuento')),
    'tienda',            public.socios__cfg('tienda'),
    'productos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'clave', p.clave, 'nombre', p.nombre, 'marca', p.marca, 'categoria', p.categoria,
               'descripcion', p.descripcion, 'precio', p.precio, 'url', p.url, 'canal', p.canal,
               'costo_pct', p.costo_pct, 'estado', p.estado, 'color', p.color) order by p.orden, p.id)
        from public.socios_productos p where p.estado <> 'oculto'), '[]'::jsonb),
    'ranking', null,
    'totales', null
  );

  if v_etapa >= 2 then
    with t as (
      select s.id, public.socios__alias(s.alias, s.nombre) as alias, s.fundador_n,
             count(v.id) filter (where public.socios__neto(v.estado, v.monto, v.reembolsado) > 0) as ventas,
             coalesce(sum(public.socios__neto(v.estado, v.monto, v.reembolsado)), 0) as monto,
             coalesce(sum(public.socios__comision(v.estado, v.monto, v.reembolsado, v.lista, v.costo_pct, v.comision_pct)), 0) as comision
        from public.socios s
        left join public.socios_ventas v on v.socio_id = s.id
       where s.estado = 'aprobado' and s.consiente
       group by s.id
    )
    select r || jsonb_build_object(
             'ranking', coalesce((select jsonb_agg(jsonb_build_object(
                                   'alias', t.alias, 'fundador', t.fundador_n, 'ventas', t.ventas, 'monto', t.monto)
                                   order by t.monto desc, t.ventas desc, t.fundador_n nulls last, t.id)
                                  from (select * from t order by monto desc, ventas desc, fundador_n nulls last, id limit 100) t), '[]'::jsonb),
             'totales', (select jsonb_build_object('socios', count(*), 'ventas', coalesce(sum(ventas), 0),
                                                   'monto', coalesce(sum(monto), 0), 'comisiones', coalesce(sum(comision), 0))
                           from t))
      into r;
  end if;
  return r;
end $$;

create or replace function public.socios_anotar(p_nombre text, p_email text, p_whatsapp text default null)
returns jsonb
language plpgsql security definer
set search_path = public set timezone = 'UTC'
as $$
declare
  v_nombre text := public.socios__txt(p_nombre, 80);
  v_email  text := public.socios__email(p_email);
begin
  if v_nombre is null or char_length(v_nombre) < 2 then raise exception 'socios: falta_nombre'; end if;
  if v_email is null then raise exception 'socios: correo_invalido'; end if;
  perform public.socios__topes();
  insert into public.socios (email, nombre, whatsapp)
  values (v_email, v_nombre, public.socios__txt(p_whatsapp, 30))
  on conflict (email) do nothing;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.socios_postular(
  p_nombre text, p_email text, p_alias text, p_canal text,
  p_whatsapp text default null, p_pais text default null, p_red text default null,
  p_intereses text[] default '{}', p_consiente boolean default false
)
returns jsonb
language plpgsql security definer
set search_path = public set timezone = 'UTC'
as $$
declare
  v_nombre text := public.socios__txt(p_nombre, 80);
  v_email  text := public.socios__email(p_email);
  v_alias  text := public.socios__txt(p_alias, 32);
  v_canal  text := public.socios__txt(p_canal, 500);
  v_int    text[];
  s        public.socios%rowtype;
begin
  if now() < coalesce(public.socios__ts(public.socios__cfg('abre')), 'infinity'::timestamptz) then
    raise exception 'socios: aun_no_abre';
  end if;
  if v_nombre is null or char_length(v_nombre) < 2 then raise exception 'socios: falta_nombre'; end if;
  if v_email is null then raise exception 'socios: correo_invalido'; end if;
  if v_alias is null or char_length(v_alias) < 2 then raise exception 'socios: falta_alias'; end if;
  if v_canal is null or char_length(v_canal) < 10 then raise exception 'socios: falta_canal'; end if;
  if p_consiente is not true then raise exception 'socios: falta_consentimiento'; end if;

  v_int := array(select distinct i from unnest(coalesce(p_intereses, '{}'::text[])) i
                  where i in (select clave from public.socios_productos where estado <> 'oculto') limit 20);

  perform public.socios__topes();

  select * into s from public.socios where email = v_email for update;
  if found and s.estado <> 'lista' then raise exception 'socios: ya_postulaste'; end if;

  if found then
    update public.socios
       set nombre = v_nombre, alias = v_alias, canal = v_canal, intereses = v_int, consiente = true,
           whatsapp = coalesce(public.socios__txt(p_whatsapp, 30), whatsapp),
           pais = public.socios__txt(p_pais, 40), red = public.socios__txt(p_red, 160),
           estado = 'postulado', postulado = now()
     where id = s.id;
  else
    insert into public.socios (email, nombre, alias, whatsapp, pais, red, canal, intereses, consiente, estado, postulado)
    values (v_email, v_nombre, v_alias, public.socios__txt(p_whatsapp, 30), public.socios__txt(p_pais, 40),
            public.socios__txt(p_red, 160), v_canal, v_int, true, 'postulado', now());
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.socios_mi_panel(p_llave text)
returns jsonb
language plpgsql stable security definer
set search_path = public set timezone = 'UTC'
as $$
declare s public.socios%rowtype; r jsonb;
begin
  if p_llave is null or p_llave !~ '^[0-9a-f]{32}$' then raise exception 'socios: llave_invalida'; end if;
  select * into s from public.socios where llave = p_llave and estado = 'aprobado';
  if not found then raise exception 'socios: llave_invalida'; end if;

  with v as (
    select x.fecha, x.origen, x.detalle, p.nombre as producto, x.estado,
           public.socios__neto(x.estado, x.monto, x.reembolsado) as neto,
           public.socios__comision(x.estado, x.monto, x.reembolsado, x.lista, x.costo_pct, x.comision_pct) as comision
      from public.socios_ventas x
      left join public.socios_productos p on p.id = x.producto_id
     where x.socio_id = s.id
  )
  select jsonb_build_object(
    'alias',     public.socios__alias(s.alias, s.nombre),
    'nombre',    s.nombre,
    'codigo',    s.codigo,
    'fundador',  s.fundador_n,
    'comision',  s.comision,
    'descuento', public.socios__num(public.socios__cfg('descuento')),
    'tienda',    public.socios__cfg('tienda'),
    'ventas', coalesce((select jsonb_agg(jsonb_build_object(
                          'fecha', v.fecha, 'origen', v.origen, 'detalle', v.detalle, 'producto', v.producto,
                          'monto', v.neto, 'comision', v.comision, 'estado', v.estado)
                          order by v.fecha desc)
                        from (select * from v order by fecha desc limit 200) v), '[]'::jsonb),
    'totales', (select jsonb_build_object(
                  'ventas',   count(*) filter (where v.neto > 0),
                  'monto',    coalesce(sum(v.neto), 0),
                  'comision', coalesce(sum(v.comision), 0))
                from v)
  ) into r;
  return r;
end $$;

-- ----------------------------------------------------------------------------- panel del dueño (internas)
create or replace function public.socios__resumen()
returns jsonb language sql stable set search_path = public set timezone = 'UTC'
as $$
  with tot as (
    select v.socio_id,
           count(*) filter (where public.socios__neto(v.estado, v.monto, v.reembolsado) > 0) as ventas,
           sum(public.socios__neto(v.estado, v.monto, v.reembolsado)) as monto,
           sum(public.socios__comision(v.estado, v.monto, v.reembolsado, v.lista, v.costo_pct, v.comision_pct)) as comision
      from public.socios_ventas v group by v.socio_id
  )
  select jsonb_build_object(
    'config', (select jsonb_object_agg(key, value) from public.socios_config where key <> 'admin_token_sha256'),
    'conteo', (select jsonb_build_object(
                 'lista',      count(*) filter (where estado = 'lista'),
                 'postulados', count(*) filter (where estado = 'postulado'),
                 'aprobados',  count(*) filter (where estado = 'aprobado'),
                 'rechazados', count(*) filter (where estado = 'rechazado')) from public.socios),
    'lista', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre, 'email', email,
                                                           'whatsapp', whatsapp, 'creado', creado) order by creado)
                         from (select * from public.socios where estado = 'lista' order by creado limit 5000) l), '[]'::jsonb),
    'postulados', coalesce((select jsonb_agg(jsonb_build_object(
                              'id', id, 'nombre', nombre, 'alias', alias, 'email', email, 'whatsapp', whatsapp,
                              'pais', pais, 'red', red, 'canal', canal, 'intereses', intereses, 'postulado', postulado)
                              order by postulado)
                             from public.socios where estado = 'postulado'), '[]'::jsonb),
    'socios', coalesce((select jsonb_agg(jsonb_build_object(
                          'id', s.id, 'nombre', s.nombre, 'alias', s.alias, 'email', s.email, 'whatsapp', s.whatsapp,
                          'codigo', s.codigo, 'llave', s.llave, 'fundador', s.fundador_n, 'comision', s.comision,
                          'ventas', coalesce(t.ventas, 0), 'monto', coalesce(t.monto, 0), 'ganado', coalesce(t.comision, 0))
                          order by s.fundador_n nulls last, s.id)
                         from public.socios s left join tot t on t.socio_id = s.id
                        where s.estado = 'aprobado'), '[]'::jsonb),
    'productos', coalesce((select jsonb_agg(to_jsonb(p) order by p.orden, p.id) from public.socios_productos p), '[]'::jsonb),
    'ventas', coalesce((select jsonb_agg(jsonb_build_object(
                          'id', v.id, 'fecha', v.fecha, 'origen', v.origen, 'referencia', v.referencia,
                          'detalle', v.detalle, 'socio', public.socios__alias(s.alias, s.nombre), 'codigo', s.codigo,
                          'producto', p.nombre, 'monto', v.monto, 'lista', v.lista, 'reembolsado', v.reembolsado,
                          'costo_pct', v.costo_pct, 'comision_pct', v.comision_pct, 'estado', v.estado,
                          'ganancia', public.socios__ganancia(v.estado, v.monto, v.reembolsado, v.lista, v.costo_pct),
                          'comision', public.socios__comision(v.estado, v.monto, v.reembolsado, v.lista, v.costo_pct, v.comision_pct))
                          order by v.fecha desc)
                         from (select * from public.socios_ventas order by fecha desc limit 200) v
                         join public.socios s on s.id = v.socio_id
                         left join public.socios_productos p on p.id = v.producto_id), '[]'::jsonb)
  )
$$;

create or replace function public.socios__aprobar(d jsonb)
returns jsonb language plpgsql set search_path = public set timezone = 'UTC'
as $$
declare
  s public.socios%rowtype;
  v_id   bigint := public.socios__num(d->>'id')::bigint;
  v_cod  text := upper(coalesce(public.socios__txt(d->>'codigo', 24), ''));
  v_base text;
  v_n    int;
  i      int := 1;
begin
  perform pg_advisory_xact_lock(hashtext('socios_aprobar'));
  select * into s from public.socios where id = v_id for update;
  if not found or s.estado <> 'postulado' then raise exception 'socios: no_esta_en_revision'; end if;

  if v_cod <> '' then
    if v_cod !~ '^[A-Z0-9][A-Z0-9-]{3,23}$' then raise exception 'socios: codigo_invalido'; end if;
    if exists (select 1 from public.socios where codigo = v_cod) then raise exception 'socios: codigo_en_uso'; end if;
  else
    v_base := 'HK23-' || left(upper(regexp_replace(translate(public.socios__alias(s.alias, s.nombre),
                                'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'), '[^A-Za-z0-9]', '', 'g')), 12);
    if v_base = 'HK23-' then v_base := 'HK23-SOCIO'; end if;
    v_cod := v_base;
    while exists (select 1 from public.socios where codigo = v_cod) loop
      i := i + 1;
      v_cod := v_base || i::text;
    end loop;
  end if;

  if public.socios__cfg('etapa') = '1'
     and (select count(*) from public.socios where estado = 'aprobado' and fundador_n is not null)
         < coalesce(public.socios__num(public.socios__cfg('cupos')), 0) then
    select coalesce(max(fundador_n), 0) + 1 into v_n from public.socios;
  end if;

  update public.socios
     set estado = 'aprobado', codigo = v_cod, llave = replace(gen_random_uuid()::text, '-', ''),
         fundador_n = v_n,
         comision = coalesce(public.socios__num(public.socios__cfg(
                      case when v_n is not null then 'comision_fundador' else 'comision_normal' end)), 0),
         decidido = now()
   where id = s.id
  returning * into s;
  return jsonb_build_object('ok', true, 'id', s.id, 'codigo', s.codigo, 'llave', s.llave,
                            'fundador', s.fundador_n, 'comision', s.comision);
end $$;

create or replace function public.socios__producto(d jsonb)
returns jsonb language plpgsql set search_path = public
as $$
declare
  v_id     bigint := public.socios__num(d->>'id')::bigint;
  v_nombre text := public.socios__txt(d->>'nombre', 80);
  v_url    text := public.socios__txt(d->>'url', 300);
  v_canal  text := coalesce(public.socios__txt(d->>'canal', 10), 'directo');
  v_estado text := coalesce(public.socios__txt(d->>'estado', 15), 'proximamente');
  v_color  text := coalesce(public.socios__txt(d->>'color', 7), '#FFD200');
  v_orden  int  := coalesce(public.socios__num(d->>'orden'), 100)::int;
  v_costo  numeric := coalesce(public.socios__num(d->>'costo_pct'), 15);
  v_clave  text;
  v_base   text;
  i        int := 1;
begin
  if v_nombre is null or char_length(v_nombre) < 2 then raise exception 'socios: falta_nombre'; end if;
  if v_url is not null and v_url !~ '^https://[^[:space:]<>"'']{4,}$' then raise exception 'socios: url_invalida'; end if;
  if v_canal not in ('shopify', 'directo') then raise exception 'socios: canal_invalido'; end if;
  if v_estado not in ('disponible', 'proximamente', 'oculto') then raise exception 'socios: estado_invalido'; end if;
  if v_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'socios: color_invalido'; end if;
  if v_estado = 'disponible' and v_url is null then raise exception 'socios: falta_url'; end if;
  if v_costo < 0 or v_costo > 95 then raise exception 'socios: costo_invalido'; end if;
  -- en la tienda el código descuenta: costo + descuento tienen que dejar ganancia
  if v_canal = 'shopify' and v_estado <> 'oculto'
     and v_costo + coalesce(public.socios__num(public.socios__cfg('descuento')), 0) >= 100 then
    raise exception 'socios: sin_margen';
  end if;

  if v_id is null then
    v_base := left(public.socios__slug(v_nombre), 36);
    if char_length(v_base) < 2 then v_base := 'producto'; end if;
    v_clave := v_base;
    while exists (select 1 from public.socios_productos where clave = v_clave) loop
      i := i + 1;
      v_clave := v_base || '-' || i::text;
    end loop;
    insert into public.socios_productos (clave, nombre, marca, categoria, descripcion, precio, url, canal, costo_pct, estado, color, orden)
    values (v_clave, v_nombre, coalesce(public.socios__txt(d->>'marca', 40), ''), coalesce(public.socios__txt(d->>'categoria', 30), ''),
            coalesce(public.socios__txt(d->>'descripcion', 300), ''), coalesce(public.socios__txt(d->>'precio', 40), ''),
            v_url, v_canal, v_costo, v_estado, v_color, v_orden)
    returning id into v_id;
  else
    update public.socios_productos
       set nombre = v_nombre, marca = coalesce(public.socios__txt(d->>'marca', 40), ''),
           categoria = coalesce(public.socios__txt(d->>'categoria', 30), ''),
           descripcion = coalesce(public.socios__txt(d->>'descripcion', 300), ''),
           precio = coalesce(public.socios__txt(d->>'precio', 40), ''),
           url = v_url, canal = v_canal, costo_pct = v_costo, estado = v_estado, color = v_color, orden = v_orden
     where id = v_id;
    if not found then raise exception 'socios: no_existe'; end if;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.socios__venta(d jsonb)
returns jsonb language plpgsql set search_path = public set timezone = 'UTC'
as $$
declare
  s       public.socios%rowtype;
  v_monto numeric := public.socios__num(d->>'monto');
  v_ref   text := public.socios__txt(d->>'referencia', 80);
  v_prod  bigint := public.socios__num(d->>'producto_id')::bigint;
  v_pct   numeric := public.socios__num(d->>'comision');
  v_fecha timestamptz := coalesce(public.socios__ts(d->>'fecha'), now());
  v_costo numeric;
  v_id    bigint;
begin
  select * into s from public.socios where id = public.socios__num(d->>'socio_id')::bigint and estado = 'aprobado';
  if not found then raise exception 'socios: socio_no_aprobado'; end if;
  if v_monto is null or v_monto <= 0 or v_monto > 1000000 then raise exception 'socios: monto_invalido'; end if;
  if v_ref is null then raise exception 'socios: falta_referencia'; end if;
  -- el producto define el costo: sin producto no se sabe la ganancia
  if v_prod is null then raise exception 'socios: falta_producto'; end if;
  select costo_pct into v_costo from public.socios_productos where id = v_prod;
  if not found then raise exception 'socios: no_existe'; end if;
  if v_pct is not null and (v_pct < 0 or v_pct >= 50) then raise exception 'socios: comision_sobre_mitad'; end if;

  insert into public.socios_ventas (socio_id, origen, referencia, producto_id, detalle, monto, lista, costo_pct, comision_pct, fecha)
  values (s.id, 'manual', v_ref, v_prod, coalesce(public.socios__txt(d->>'detalle', 200), ''),
          round(v_monto, 2), round(v_monto, 2), v_costo, coalesce(v_pct, s.comision), v_fecha)
  on conflict (origen, referencia) do nothing
  returning id into v_id;
  if v_id is null then raise exception 'socios: referencia_repetida'; end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.socios__config(d jsonb)
returns jsonb language plpgsql set search_path = public set timezone = 'UTC'
as $$
declare k text; v text; n numeric; t timestamptz;
begin
  for k, v in select key, value from jsonb_each_text(coalesce(d, '{}'::jsonb)) loop
    if k = 'abre' then
      t := public.socios__ts(v);
      if t is null then raise exception 'socios: fecha_invalida'; end if;
      v := to_char(t at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
    elsif k = 'etapa' then
      if v not in ('1', '2') then raise exception 'socios: etapa_invalida'; end if;
    elsif k in ('cupos', 'mostrar_desde') then
      n := public.socios__num(v);
      if n is null or n < 0 or n > 100000 or n <> trunc(n) then raise exception 'socios: numero_invalido'; end if;
      v := n::int::text;
    elsif k in ('comision_fundador', 'comision_normal') then
      -- % de la ganancia que se lleva el socio: menos de la mitad, así HK23 siempre se queda con más
      n := public.socios__num(v);
      if n is null then raise exception 'socios: porcentaje_invalido'; end if;
      if n < 0 or n >= 50 then raise exception 'socios: comision_sobre_mitad'; end if;
      v := n::text;
    elsif k = 'descuento' then
      n := public.socios__num(v);
      if n is null or n < 0 or n > 90 then raise exception 'socios: porcentaje_invalido'; end if;
      -- el descuento no puede comerse la ganancia de ningún producto de la tienda
      if n + coalesce((select max(costo_pct) from public.socios_productos where canal = 'shopify' and estado <> 'oculto'), 0) >= 100 then
        raise exception 'socios: sin_margen';
      end if;
      v := n::text;
    elsif k = 'tienda' then
      if v !~ '^https://[A-Za-z0-9.-]{4,120}$' then raise exception 'socios: url_invalida'; end if;
    else
      raise exception 'socios: ajuste_desconocido';
    end if;
    update public.socios_config set value = v where key = k;
  end loop;
  return jsonb_build_object('ok', true);
end $$;

-- ----------------------------------------------------------------------------- panel del dueño (puerta)
create or replace function public.socios_admin(p_token text, p_accion text, p_datos jsonb default '{}')
returns jsonb
language plpgsql security definer
set search_path = public set timezone = 'UTC'
as $$
declare
  h   text := public.socios__cfg('admin_token_sha256');
  d   jsonb := coalesce(p_datos, '{}'::jsonb);
  v_id bigint := public.socios__num(d->>'id')::bigint;
  v_cod text;
begin
  if h is null or h = 'unset' or p_token is null or char_length(p_token) < 24
     or encode(sha256(convert_to(p_token, 'UTF8')), 'hex') <> h then
    raise exception 'socios: clave_invalida';
  end if;

  if p_accion = 'resumen' then
    return public.socios__resumen();
  elsif p_accion = 'aprobar' then
    return public.socios__aprobar(d);
  elsif p_accion = 'rechazar' then
    update public.socios set estado = 'rechazado', decidido = now() where id = v_id and estado = 'postulado';
    if not found then raise exception 'socios: no_esta_en_revision'; end if;
    return jsonb_build_object('ok', true);
  elsif p_accion = 'codigo' then
    v_cod := upper(coalesce(public.socios__txt(d->>'codigo', 24), ''));
    if v_cod !~ '^[A-Z0-9][A-Z0-9-]{3,23}$' then raise exception 'socios: codigo_invalido'; end if;
    if exists (select 1 from public.socios where codigo = v_cod and id <> v_id) then raise exception 'socios: codigo_en_uso'; end if;
    update public.socios set codigo = v_cod where id = v_id and estado = 'aprobado';
    if not found then raise exception 'socios: socio_no_aprobado'; end if;
    return jsonb_build_object('ok', true, 'codigo', v_cod);
  elsif p_accion = 'producto' then
    return public.socios__producto(d);
  elsif p_accion = 'venta' then
    return public.socios__venta(d);
  elsif p_accion = 'anular' then
    update public.socios_ventas set estado = 'anulada' where id = v_id and estado = 'valida';
    if not found then raise exception 'socios: no_existe'; end if;
    return jsonb_build_object('ok', true);
  elsif p_accion = 'config' then
    return public.socios__config(d);
  end if;
  raise exception 'socios: accion_desconocida';
end $$;

-- ----------------------------------------------------------------------------- solo servidor: ventas de Shopify
-- La llama la edge function socios-shopify después de verificar la firma del webhook.
--   pagado    → si algún código de descuento del pedido es de un socio aprobado, registra la venta (una vez)
--   cancelado → anula la venta del pedido
--   reembolso → descuenta lo reembolsado (cada reembolso una sola vez); si llega al total, la anula
-- El costo sale del producto de la tienda (canal shopify) en el catálogo. Si no hay ninguno, se usa 95 %:
-- ante la duda, la comisión queda casi en cero y HK23 no pierde.
drop function if exists public.socios_registrar_shopify(text, text, text, text[], numeric, text, numeric);
create or replace function public.socios_registrar_shopify(
  p_evento text, p_pedido text, p_nombre text default '', p_codigos text[] default '{}',
  p_monto numeric default 0, p_reembolso_id text default null, p_reembolso numeric default 0,
  p_lista numeric default null
)
returns jsonb
language plpgsql security definer
set search_path = public set timezone = 'UTC'
as $$
declare
  s public.socios%rowtype; v_id bigint; n int; v_r numeric := greatest(coalesce(p_reembolso, 0), 0);
  v_monto numeric := round(greatest(coalesce(p_monto, 0), 0), 2);
  v_prod bigint; v_costo numeric;
begin
  if p_pedido is null or p_pedido !~ '^[0-9]{1,30}$' then raise exception 'socios: pedido_invalido'; end if;

  if p_evento = 'pagado' then
    select * into s from public.socios
     where estado = 'aprobado'
       and codigo = any (array(select upper(btrim(c)) from unnest(coalesce(p_codigos, '{}'::text[])) c))
     order by id limit 1;
    if not found then return jsonb_build_object('ok', true, 'atribuida', false); end if;
    select id, costo_pct into v_prod, v_costo from public.socios_productos
     where canal = 'shopify' and estado <> 'oculto'
     order by (estado = 'disponible') desc, orden, id limit 1;
    insert into public.socios_ventas (socio_id, origen, referencia, producto_id, detalle, monto, lista, costo_pct, comision_pct)
    values (s.id, 'shopify', p_pedido, v_prod, coalesce(left(public.socios__txt(p_nombre, 200), 200), ''),
            v_monto, greatest(round(coalesce(p_lista, v_monto), 2), v_monto), coalesce(v_costo, 95), s.comision)
    on conflict (origen, referencia) do nothing
    returning id into v_id;
    return jsonb_build_object('ok', true, 'atribuida', true, 'nueva', v_id is not null, 'codigo', s.codigo);

  elsif p_evento = 'cancelado' then
    update public.socios_ventas set estado = 'anulada' where origen = 'shopify' and referencia = p_pedido;
    get diagnostics n = row_count;
    return jsonb_build_object('ok', true, 'cambios', n);

  elsif p_evento = 'reembolso' then
    if p_reembolso_id is null or p_reembolso_id !~ '^[0-9]{1,30}$' then raise exception 'socios: reembolso_invalido'; end if;
    update public.socios_ventas
       set reembolsado = least(monto, reembolsado + v_r),
           reembolsos  = reembolsos || p_reembolso_id,
           estado      = case when least(monto, reembolsado + v_r) >= monto then 'anulada' else estado end
     where origen = 'shopify' and referencia = p_pedido and not (p_reembolso_id = any (reembolsos));
    get diagnostics n = row_count;
    return jsonb_build_object('ok', true, 'cambios', n);
  end if;
  raise exception 'socios: evento_desconocido';
end $$;

-- ----------------------------------------------------------------------------- permisos
-- Supabase da EXECUTE a anon/authenticated en funciones nuevas: se revoca todo y se abre solo lo necesario.
revoke all on function public.socios__cfg(text)                         from public, anon, authenticated;
revoke all on function public.socios__txt(text, int)                    from public, anon, authenticated;
revoke all on function public.socios__num(text)                         from public, anon, authenticated;
revoke all on function public.socios__ts(text)                          from public, anon, authenticated;
revoke all on function public.socios__email(text)                       from public, anon, authenticated;
revoke all on function public.socios__ip()                              from public, anon, authenticated;
revoke all on function public.socios__cuota(text, int)                  from public, anon, authenticated;
revoke all on function public.socios__topes()                           from public, anon, authenticated;
revoke all on function public.socios__neto(text, numeric, numeric)      from public, anon, authenticated;
revoke all on function public.socios__ganancia(text, numeric, numeric, numeric, numeric)
                                                                        from public, anon, authenticated;
revoke all on function public.socios__comision(text, numeric, numeric, numeric, numeric, numeric)
                                                                        from public, anon, authenticated;
revoke all on function public.socios__alias(text, text)                 from public, anon, authenticated;
revoke all on function public.socios__slug(text)                        from public, anon, authenticated;
revoke all on function public.socios__resumen()                         from public, anon, authenticated;
revoke all on function public.socios__aprobar(jsonb)                    from public, anon, authenticated;
revoke all on function public.socios__producto(jsonb)                   from public, anon, authenticated;
revoke all on function public.socios__venta(jsonb)                      from public, anon, authenticated;
revoke all on function public.socios__config(jsonb)                     from public, anon, authenticated;
revoke all on function public.socios_estado()                           from public, anon, authenticated;
revoke all on function public.socios_anotar(text, text, text)           from public, anon, authenticated;
revoke all on function public.socios_postular(text, text, text, text, text, text, text, text[], boolean)
                                                                        from public, anon, authenticated;
revoke all on function public.socios_mi_panel(text)                     from public, anon, authenticated;
revoke all on function public.socios_admin(text, text, jsonb)           from public, anon, authenticated;
revoke all on function public.socios_registrar_shopify(text, text, text, text[], numeric, text, numeric, numeric)
                                                                        from public, anon, authenticated;

grant execute on function public.socios_estado()                        to anon, authenticated;
grant execute on function public.socios_anotar(text, text, text)        to anon, authenticated;
grant execute on function public.socios_postular(text, text, text, text, text, text, text, text[], boolean)
                                                                        to anon, authenticated;
grant execute on function public.socios_mi_panel(text)                  to anon, authenticated;
grant execute on function public.socios_admin(text, text, jsonb)        to anon, authenticated;
grant execute on function public.socios_registrar_shopify(text, text, text, text[], numeric, text, numeric, numeric)
                                                                        to service_role;

-- ----------------------------------------------------------------------------- clave del panel
-- Reemplaza __SET_ADMIN_TOKEN__ por tu clave (mínimo 24 caracteres) antes de correr el archivo.
-- Se guarda solo su sha256. Sin reemplazar, no se toca la clave existente.
do $$
declare t text := '__SET_ADMIN_TOKEN__';
begin
  if t <> '__SET_' || 'ADMIN_TOKEN__' and char_length(t) >= 24 then
    update public.socios_config set value = encode(sha256(convert_to(t, 'UTF8')), 'hex')
     where key = 'admin_token_sha256';
  end if;
end $$;
