-- ============================================================================
-- HK23 — 0011 · Motivation Scale · Circle (friends) + daily reminders (Web Push)
-- ADDITIVE · IDEMPOTENT · safe to re-run
--
-- HOW TO APPLY
--   1. Supabase Dashboard → project iiqhhglgjsbnuihythko → SQL Editor → New query.
--   2. Paste this whole file.
--   3. BEFORE running: replace the token placeholder __SET_CRON_TOKEN__ (in the scale_config insert
--      below) with the exact secret stored in the Vercel env var SCALE_CRON_TOKEN.
--      While the placeholder is still stored, every server-only RPC answers 'scale: forbidden'.
--   4. Run. The cron block at the very end needs pg_cron + pg_net; if its CREATE EXTENSION lines
--      are refused, enable both in Dashboard → Database → Extensions and run the file again.
--   Re-running rewrites the token row with whatever value this file holds.
--
-- SECURITY MODEL
--   • 6 tables, RLS on, NO policies, every privilege revoked from anon/authenticated → unreachable
--     through PostgREST. The only door is the security-definer RPCs below (anon key is public).
--   • Identity is device-bound: the client keeps a 64-hex secret, the server stores sha256(secret).
--     User RPCs authenticate through the internal scale__auth (not executable by anon).
--   • Server-only RPCs (scale_due, scale_nudge_targets, scale_self_targets, scale_push_drop) require
--     p_token = scale_config.cron_token.
--   • Push endpoints are allowlisted to the real push services (anti-SSRF: the sender POSTs to them).
--   • Only named users can join a circle or nudge (checked before a join try is consumed). The
--     100-friend cap counts named friends only, and scale_circle lists unnamed ones too (name '')
--     so any friendship stored before that rule can still be seen and removed.
--   • Push fan-out is bounded: at most 5 devices per user (scale_push_set trims; the target RPCs
--     return ≤ 5) and scale_due claims at most 500 rows per call. The sender calls it again only
--     while it has time left, so no row is ever marked sent unless it is about to be sent.
--   • Errors: raise 'scale: <reason>' → PostgREST 400 {message}. One exception, scale_join: its
--     failures must consume a try (anti code-enumeration) and a raise would roll the counter back,
--     so those failures commit and answer 400 via the PostgREST response.status GUC with the same
--     {code:'P0001', message:'scale: …'} body a raise produces.
--   • Every function pins search_path and timezone (UTC), so current_date cannot be shifted by a
--     client-supplied `Prefer: timezone` header.
-- ============================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ----------------------------------------------------------------------------- tables
create table if not exists public.scale_users (
  id          uuid primary key default gen_random_uuid(),
  secret_hash text not null,
  code        text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  name        text null check (name is null or char_length(name) between 1 and 24),
  emoji       text null check (emoji is null or octet_length(emoji) <= 16),
  share_score boolean not null default true,
  lang        text null check (lang is null or lang in ('en', 'es', 'pt')),
  tz          text null check (tz is null or char_length(tz) <= 64),
  streak      int not null default 0 check (streak >= 0),
  best        int not null default 0 check (best >= 0),
  last_day    date null,
  join_day    date null,
  join_tries  int not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.scale_logs (
  user_id    uuid not null references public.scale_users (id) on delete cascade,
  day        date not null,
  score      smallint not null check (score between 0 and 10),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

create table if not exists public.scale_friends (
  user_id    uuid not null references public.scale_users (id) on delete cascade,
  friend_id  uuid not null references public.scale_users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);
create index if not exists scale_friends_friend_idx on public.scale_friends (friend_id);

create table if not exists public.scale_push (
  endpoint      text primary key check (char_length(endpoint) < 1024),
  user_id       uuid not null references public.scale_users (id) on delete cascade,
  p256dh        text not null,
  auth          text not null,
  hour          smallint not null default 21 check (hour between 0 and 23),
  tz            text not null default 'America/Santiago',
  enabled       boolean not null default true,
  last_sent_day date null,
  created_at    timestamptz not null default now()
);
create index if not exists scale_push_user_idx on public.scale_push (user_id);
-- At most 5 devices per user (the rule scale_push_set enforces): trims rows stored before it, newest kept.
delete from public.scale_push p
 using (select k.endpoint,
               row_number() over (partition by k.user_id order by k.created_at desc, k.endpoint) as rn
          from public.scale_push k) r
 where r.endpoint = p.endpoint
   and r.rn > 5;

create table if not exists public.scale_nudges (
  from_id    uuid not null references public.scale_users (id) on delete cascade,
  to_id      uuid not null references public.scale_users (id) on delete cascade,
  day        date not null,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id, day)
);
create index if not exists scale_nudges_to_idx on public.scale_nudges (to_id, day);

create table if not exists public.scale_config (
  key   text primary key,
  value text not null
);

alter table public.scale_users   enable row level security;
alter table public.scale_logs    enable row level security;
alter table public.scale_friends enable row level security;
alter table public.scale_push    enable row level security;
alter table public.scale_nudges  enable row level security;
alter table public.scale_config  enable row level security;

revoke all on table public.scale_users, public.scale_logs, public.scale_friends,
                    public.scale_push, public.scale_nudges, public.scale_config
  from public, anon, authenticated;

-- Cron token (keep in sync with Vercel env SCALE_CRON_TOKEN).
insert into public.scale_config (key, value) values ('cron_token', '__SET_CRON_TOKEN__')
  on conflict (key) do update set value = excluded.value;

-- ----------------------------------------------------------------------------- internal auth
-- (id, secret) → id, or 'scale: bad credentials'. NOT executable by anon/authenticated.
create or replace function public.scale__auth(p_id uuid, p_secret text)
returns uuid
language plpgsql
stable
security definer
set search_path = public, extensions
set timezone to 'UTC'
as $$
begin
  if p_id is null or p_secret is null or p_secret !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'scale: bad credentials';
  end if;
  perform 1
     from public.scale_users u
    where u.id = p_id
      and u.secret_hash = encode(extensions.digest(lower(p_secret), 'sha256'), 'hex');
  if not found then
    raise exception 'scale: bad credentials';
  end if;
  return p_id;
end
$$;

-- ----------------------------------------------------------------------------- 1. register
create or replace function public.scale_register(p_secret text, p_lang text default null, p_tz text default null)
returns json
language plpgsql
security definer
set search_path = public, extensions
set timezone to 'UTC'
as $$
declare
  v_alpha constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- 32 chars: byte % 32 is unbiased
  v_lang  text := lower(btrim(p_lang));
  v_tz    text := nullif(btrim(p_tz), '');
  v_bytes bytea;
  v_code  text;
  v_id    uuid;
begin
  if p_secret is null or p_secret !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'scale: bad secret';
  end if;

  -- optional hints: an unknown lang / tz is ignored (never blocks registration)
  if v_lang is null or v_lang not in ('en', 'es', 'pt') then
    v_lang := null;
  end if;
  if v_tz is not null and char_length(v_tz) <= 64 then
    begin
      perform now() at time zone v_tz;
    exception when others then
      v_tz := null;
    end;
  else
    v_tz := null;
  end if;

  for v_try in 1..20 loop
    v_bytes := extensions.gen_random_bytes(8);
    v_code := '';
    for i in 0..7 loop
      v_code := v_code || substr(v_alpha, get_byte(v_bytes, i) % 32 + 1, 1);
    end loop;
    continue when exists (select 1 from public.scale_users u where u.code = v_code);
    begin
      insert into public.scale_users (secret_hash, code, lang, tz)
      values (encode(extensions.digest(lower(p_secret), 'sha256'), 'hex'), v_code, v_lang, v_tz)
      returning id into v_id;
      return json_build_object('id', v_id, 'code', v_code);
    exception when unique_violation then
      null;  -- lost a race for this code: draw again
    end;
  end loop;
  raise exception 'scale: try again';
end
$$;

-- ----------------------------------------------------------------------------- 2. me
create or replace function public.scale_me(p_id uuid, p_secret text)
returns json
language plpgsql
security definer
set search_path = public, extensions
set timezone to 'UTC'
as $$
declare
  v_me  uuid;
  v_out json;
begin
  v_me := public.scale__auth(p_id, p_secret);
  select json_build_object(
           'id', u.id, 'code', u.code, 'name', u.name, 'emoji', u.emoji,
           'share_score', u.share_score, 'streak', u.streak, 'best', u.best, 'last_day', u.last_day)
    into v_out
    from public.scale_users u
   where u.id = v_me;
  return v_out;
end
$$;

-- ----------------------------------------------------------------------------- 3. profile
-- Null args keep current values. p_emoji = '' clears the emoji. Unknown lang/tz are ignored.
create or replace function public.scale_profile(
  p_id uuid, p_secret text, p_name text, p_emoji text, p_share_score boolean,
  p_lang text default null, p_tz text default null)
returns json
language plpgsql
security definer
set search_path = public, extensions
set timezone to 'UTC'
as $$
declare
  v_me    uuid;
  v_name  text;
  v_emoji text;
  v_lang  text := lower(btrim(p_lang));
  v_tz    text := nullif(btrim(p_tz), '');
begin
  v_me := public.scale__auth(p_id, p_secret);

  if p_name is not null then
    v_name := regexp_replace(p_name, '^\s+|\s+$', '', 'g');
    if v_name = '' or char_length(v_name) > 24
       or v_name ~ '[\u0001-\u001f\u007f-\u009f\u2028\u2029]' then
      raise exception 'scale: bad name';
    end if;
  end if;

  if p_emoji is not null then
    v_emoji := regexp_replace(p_emoji, '^\s+|\s+$', '', 'g');
    if octet_length(v_emoji) > 16
       or v_emoji ~ '[\u0001-\u001f\u007f-\u009f\u2028\u2029]' then
      raise exception 'scale: bad emoji';
    end if;
  end if;

  if v_lang is not null and v_lang not in ('en', 'es', 'pt') then
    v_lang := null;
  end if;
  if v_tz is not null and char_length(v_tz) <= 64 then
    begin
      perform now() at time zone v_tz;
    exception when others then
      v_tz := null;
    end;
  else
    v_tz := null;
  end if;

  update public.scale_users u
     set name        = coalesce(v_name, u.name),
         emoji       = case when p_emoji is null then u.emoji else nullif(v_emoji, '') end,
         share_score = coalesce(p_share_score, u.share_score),
         lang        = coalesce(v_lang, u.lang),
         tz          = coalesce(v_tz, u.tz)
   where u.id = v_me;

  return public.scale_me(p_id, p_secret);
end
$$;

-- ----------------------------------------------------------------------------- 4. log
create or replace function public.scale_log(
  p_id uuid, p_secret text, p_day date, p_score int, p_streak int, p_best int)
returns json
language plpgsql
security definer
set search_path = public, extensions
set timezone to 'UTC'
as $$
declare
  v_me uuid;
begin
  v_me := public.scale__auth(p_id, p_secret);

  if p_score is null or p_score < 0 or p_score > 10 then
    raise exception 'scale: bad score';
  end if;
  if p_day is null or p_day < current_date - 2 or p_day > current_date + 2 then
    raise exception 'scale: bad day';
  end if;
  if p_streak is null or p_streak < 0 or p_streak > 10000
     or (p_best is not null and (p_best < 0 or p_best > 10000)) then
    raise exception 'scale: bad streak';
  end if;

  insert into public.scale_logs (user_id, day, score, updated_at)
  values (v_me, p_day, p_score, now())
  on conflict (user_id, day) do update
    set score = excluded.score, updated_at = now();

  -- right-hand sides all read the OLD row
  update public.scale_users u
     set streak   = case when p_day >= coalesce(u.last_day, p_day) then p_streak else u.streak end,
         best     = greatest(u.best, p_best,
                             case when p_day >= coalesce(u.last_day, p_day) then p_streak else u.streak end),
         last_day = greatest(u.last_day, p_day)
   where u.id = v_me;

  return json_build_object('ok', true);
end
$$;

-- ----------------------------------------------------------------------------- 5. circle
create or replace function public.scale_circle(p_id uuid, p_secret text)
returns json
language plpgsql
security definer
set search_path = public, extensions
set timezone to 'UTC'
as $$
declare
  v_me  uuid;
  v_out json;
begin
  v_me := public.scale__auth(p_id, p_secret);
  -- Unnamed friends are listed too (name '', after the named ones): nobody unnamed can join any
  -- more, but a friendship stored before that rule must stay visible so it can be removed.
  select coalesce(json_agg(json_build_object(
           'id',          u.id,
           'name',        coalesce(u.name, ''),
           'emoji',       u.emoji,
           -- alive = logged on the friend's own local yesterday or later (UTC would zero a
           -- Santiago streak every evening from 20–21h)
           'streak',      case when u.last_day >= (now() at time zone coalesce(u.tz, 'UTC'))::date - 1
                               then u.streak else 0 end,
           'best',        u.best,
           'last_day',    u.last_day,
           'share_score', u.share_score,
           'nudged_me',   exists (select 1
                                    from public.scale_nudges n
                                   where n.from_id = u.id and n.to_id = v_me and n.day = current_date),
           'days',        (select coalesce(json_agg(json_build_object(
                                     'day',   l.day,
                                     'score', case when u.share_score then l.score end
                                   ) order by l.day), '[]'::json)
                             from public.scale_logs l
                            where l.user_id = u.id
                              and l.day between current_date - 7 and current_date + 1)
         ) order by (u.name is null), lower(u.name), u.id), '[]'::json)
    into v_out
    from public.scale_friends f
    join public.scale_users u on u.id = f.friend_id
   where f.user_id = v_me;
  return v_out;
end
$$;

-- ----------------------------------------------------------------------------- 6. join
create or replace function public.scale_join(p_id uuid, p_secret text, p_code text)
returns json
language plpgsql
security definer
set search_path = public, extensions
set timezone to 'UTC'
as $$
declare
  v_me      uuid;
  v_day     date;
  v_tries   int;
  v_code    text;
  v_friend  uuid;
  v_fname   text;
  v_err     text;
  v_card    json;
  v_myname  text;
begin
  v_me := public.scale__auth(p_id, p_secret);

  select u.join_day, u.join_tries, u.name into v_day, v_tries, v_myname
    from public.scale_users u where u.id = v_me for update;
  -- Named callers only, checked before a try is consumed: an unnamed account would sit in the
  -- other circle invisible, holding one of its 100 slots and nudging anonymously.
  if v_myname is null then
    raise exception 'scale: set a name first';
  end if;
  if v_day = current_date and v_tries >= 20 then
    raise exception 'scale: slow down';
  end if;
  -- every try counts, failures included (committed even when the lookup fails, see below)
  update public.scale_users u
     set join_tries = case when u.join_day = current_date then u.join_tries + 1 else 1 end,
         join_day   = current_date
   where u.id = v_me;

  v_code := upper(regexp_replace(left(coalesce(p_code, ''), 64), '[^A-Za-z0-9]', '', 'g'));
  select u.id, u.name into v_friend, v_fname from public.scale_users u where u.code = v_code;

  if v_friend is null then
    v_err := 'scale: code not found';
  elsif v_friend = v_me then
    v_err := 'scale: that is you';
  elsif v_fname is null then
    v_err := 'scale: code not found';
  elsif not exists (select 1 from public.scale_friends f where f.user_id = v_me and f.friend_id = v_friend)
        -- the cap counts named friends only: rows left by unnamed accounts can never fill a circle
        and ((select count(*) from public.scale_friends f join public.scale_users n on n.id = f.friend_id
               where f.user_id = v_me and n.name is not null) >= 100
          or (select count(*) from public.scale_friends f join public.scale_users n on n.id = f.friend_id
               where f.user_id = v_friend and n.name is not null) >= 100) then
    v_err := 'scale: circle full';
  end if;

  if v_err is not null then
    -- A raise would roll back the try counter; answer PostgREST 400 with the raise-shaped body instead.
    perform set_config('response.status', '400', true);
    return json_build_object('code', 'P0001', 'details', null, 'hint', null, 'message', v_err);
  end if;

  insert into public.scale_friends (user_id, friend_id)
  values (v_me, v_friend), (v_friend, v_me)
  on conflict do nothing;

  select t.card into v_card
    from json_array_elements(public.scale_circle(p_id, p_secret)) as t(card)
   where t.card ->> 'id' = v_friend::text;
  return v_card;
end
$$;

-- ----------------------------------------------------------------------------- 7. unfriend
create or replace function public.scale_unfriend(p_id uuid, p_secret text, p_friend uuid)
returns json
language plpgsql
security definer
set search_path = public, extensions
set timezone to 'UTC'
as $$
declare
  v_me uuid;
begin
  v_me := public.scale__auth(p_id, p_secret);
  delete from public.scale_friends f
   where (f.user_id = v_me and f.friend_id = p_friend)
      or (f.user_id = p_friend and f.friend_id = v_me);
  return json_build_object('ok', true);
end
$$;

-- ----------------------------------------------------------------------------- 8. push_set
create or replace function public.scale_push_set(
  p_id uuid, p_secret text, p_endpoint text, p_p256dh text, p_auth text,
  p_hour int, p_tz text, p_enabled boolean, p_lang text default null)
returns json
language plpgsql
security definer
set search_path = public, extensions
set timezone to 'UTC'
as $$
declare
  v_me      uuid;
  v_tz      text := btrim(p_tz);
  v_lang    text := lower(btrim(p_lang));
  v_enabled boolean := coalesce(p_enabled, true);
begin
  v_me := public.scale__auth(p_id, p_secret);

  -- push-service allowlist (anti-SSRF): anchored, host must be followed directly by '/'
  -- (no port, no userinfo), printable ASCII only, and no '@' anywhere before the path.
  if p_endpoint is null
     or char_length(p_endpoint) >= 1024
     or p_endpoint !~ '^[!-~]+$'
     or p_endpoint !~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)/'
     or strpos(split_part(substr(p_endpoint, 9), '/', 1), '@') > 0 then
    raise exception 'scale: bad endpoint';
  end if;

  -- base64 / base64url, 1..256 chars (PG regex bounds max out at 255, so length is checked apart)
  if p_p256dh is null or p_auth is null
     or char_length(p_p256dh) > 256 or char_length(p_auth) > 256
     or p_p256dh !~ '^[A-Za-z0-9_+/=-]+$'
     or p_auth   !~ '^[A-Za-z0-9_+/=-]+$' then
    raise exception 'scale: bad keys';
  end if;

  if p_hour is null or p_hour < 0 or p_hour > 23 then
    raise exception 'scale: bad hour';
  end if;

  if v_tz is null or v_tz = '' or char_length(v_tz) > 64 then
    raise exception 'scale: bad tz';
  end if;
  begin
    perform now() at time zone v_tz;
  exception when others then
    raise exception 'scale: bad tz';
  end;

  if v_lang is not null and v_lang not in ('en', 'es', 'pt') then
    v_lang := null;
  end if;

  -- one push_set at a time per user, so parallel calls cannot race past the 5-device cap below
  perform 1 from public.scale_users u where u.id = v_me for update;

  insert into public.scale_push as sp (endpoint, user_id, p256dh, auth, hour, tz, enabled)
  values (p_endpoint, v_me, p_p256dh, p_auth, p_hour, v_tz, v_enabled)
  on conflict (endpoint) do update
    set user_id       = excluded.user_id,
        p256dh        = excluded.p256dh,
        auth          = excluded.auth,
        hour          = excluded.hour,
        tz            = excluded.tz,
        enabled       = excluded.enabled,
        last_sent_day = case when sp.user_id = excluded.user_id then sp.last_sent_day end;

  -- At most 5 devices per user: this endpoint plus the 4 newest others. Every stored row is one
  -- push per reminder / nudge / test, so an unbounded list is a free send amplifier.
  delete from public.scale_push p
   where p.user_id = v_me
     and p.endpoint not in (select k.endpoint
                              from public.scale_push k
                             where k.user_id = v_me
                             order by (k.endpoint = p_endpoint) desc, k.created_at desc, k.endpoint
                             limit 5);

  update public.scale_users u
     set tz   = v_tz,
         lang = coalesce(v_lang, u.lang)
   where u.id = v_me;

  return json_build_object('ok', true, 'hour', p_hour, 'tz', v_tz, 'enabled', v_enabled);
end
$$;

-- ----------------------------------------------------------------------------- 9. due  (server-only)
create or replace function public.scale_due(p_token text, p_now timestamptz default now())
returns json
language plpgsql
security definer
set search_path = public, extensions
set timezone to 'UTC'
as $$
declare
  v_now timestamptz := coalesce(p_now, now());
  v_out json;
begin
  if p_token is null or not exists (
       select 1 from public.scale_config c
        where c.key = 'cron_token'
          and c.value <> ''
          and c.value <> ('__SET_' || 'CRON_TOKEN__')   -- placeholder never authorizes
          and extensions.digest(c.value, 'sha256') = extensions.digest(p_token, 'sha256')) then
    raise exception 'scale: forbidden';
  end if;

  -- Claims at most 500 rows per call, oldest subscriptions first: the sender sends each batch before
  -- calling again, and stops calling when it runs out of time, so a row marked here always goes out.
  -- Rows are locked (re-checked under the lock, skipping ones another run holds) → no double send
  -- on overlapping runs.
  with pick as (
    select p.endpoint
      from public.scale_push p
      join public.scale_users u on u.id = p.user_id
     where p.enabled
       and extract(hour from (v_now at time zone p.tz)) = p.hour
       and (u.last_day is null or u.last_day < (v_now at time zone p.tz)::date)
       and (p.last_sent_day is null or p.last_sent_day < (v_now at time zone p.tz)::date)
     order by p.created_at, p.endpoint
     limit 500
       for update of p skip locked
  ), sent as (
    update public.scale_push p
       set last_sent_day = (v_now at time zone p.tz)::date
      from pick, public.scale_users u
     where p.endpoint = pick.endpoint
       and u.id = p.user_id
    returning p.endpoint, p.p256dh, p.auth, u.lang, u.name, u.streak, u.last_day,
              (v_now at time zone p.tz)::date as local_today
  )
  select coalesce(json_agg(json_build_object(
           'endpoint', s.endpoint,
           'p256dh',   s.p256dh,
           'auth',     s.auth,
           'lang',     s.lang,
           'streak',   case when s.last_day >= s.local_today - 1 then s.streak else 0 end,
           'name',     s.name)), '[]'::json)
    into v_out
    from sent s;
  return v_out;
end
$$;

-- ----------------------------------------------------------------------------- 10. nudge_targets  (server-only)
create or replace function public.scale_nudge_targets(
  p_token text, p_id uuid, p_secret text, p_friend uuid, p_now timestamptz default now())
returns json
language plpgsql
security definer
set search_path = public, extensions
set timezone to 'UTC'
as $$
declare
  v_now      timestamptz := coalesce(p_now, now());
  v_day      date := (coalesce(p_now, now()) at time zone 'UTC')::date;
  v_me       uuid;
  v_f_last   date;
  v_f_tz     text;
  v_f_lang   text;
  v_name     text;
  v_emoji    text;
  v_n        int;
begin
  if p_token is null or not exists (
       select 1 from public.scale_config c
        where c.key = 'cron_token'
          and c.value <> ''
          and c.value <> ('__SET_' || 'CRON_TOKEN__')
          and extensions.digest(c.value, 'sha256') = extensions.digest(p_token, 'sha256')) then
    raise exception 'scale: forbidden';
  end if;
  v_me := public.scale__auth(p_id, p_secret);

  select u.name, u.emoji into v_name, v_emoji from public.scale_users u where u.id = v_me;
  if v_name is null then
    raise exception 'scale: set a name first';   -- no anonymous nudges
  end if;

  if p_friend is null or not exists (
       select 1 from public.scale_friends f where f.user_id = v_me and f.friend_id = p_friend) then
    raise exception 'scale: not in your circle';
  end if;

  select u.last_day, coalesce(u.tz, 'America/Santiago'), u.lang
    into v_f_last, v_f_tz, v_f_lang
    from public.scale_users u where u.id = p_friend;
  if v_f_last >= (v_now at time zone v_f_tz)::date then
    raise exception 'scale: already logged';
  end if;

  if exists (select 1 from public.scale_nudges n
              where n.from_id = v_me and n.to_id = p_friend and n.day = v_day) then
    raise exception 'scale: already nudged';
  end if;
  if (select count(*) from public.scale_nudges n where n.from_id = v_me and n.day = v_day) >= 20 then
    raise exception 'scale: slow down';
  end if;

  insert into public.scale_nudges (from_id, to_id, day) values (v_me, p_friend, v_day)
  on conflict do nothing;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'scale: already nudged';   -- lost a race with a concurrent nudge
  end if;

  return json_build_object(
    'from_name',  v_name,
    'from_emoji', v_emoji,
    'lang',       v_f_lang,
    'subs', (select coalesce(json_agg(json_build_object(          -- ≤ 5 devices, newest first
                      'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)
                    order by s.created_at desc, s.endpoint), '[]'::json)
               from (select p.endpoint, p.p256dh, p.auth, p.created_at
                       from public.scale_push p
                      where p.user_id = p_friend and p.enabled
                      order by p.created_at desc, p.endpoint
                      limit 5) s));
end
$$;

-- ----------------------------------------------------------------------------- 11. self_targets  (server-only)
create or replace function public.scale_self_targets(p_token text, p_id uuid, p_secret text)
returns json
language plpgsql
security definer
set search_path = public, extensions
set timezone to 'UTC'
as $$
declare
  v_me uuid;
begin
  if p_token is null or not exists (
       select 1 from public.scale_config c
        where c.key = 'cron_token'
          and c.value <> ''
          and c.value <> ('__SET_' || 'CRON_TOKEN__')
          and extensions.digest(c.value, 'sha256') = extensions.digest(p_token, 'sha256')) then
    raise exception 'scale: forbidden';
  end if;
  v_me := public.scale__auth(p_id, p_secret);

  return json_build_object(
    'lang', (select u.lang from public.scale_users u where u.id = v_me),
    'subs', (select coalesce(json_agg(json_build_object(          -- ≤ 5 devices, newest first
                      'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)
                    order by s.created_at desc, s.endpoint), '[]'::json)
               from (select p.endpoint, p.p256dh, p.auth, p.created_at
                       from public.scale_push p
                      where p.user_id = v_me and p.enabled
                      order by p.created_at desc, p.endpoint
                      limit 5) s));
end
$$;

-- ----------------------------------------------------------------------------- 12. push_drop  (server-only)
create or replace function public.scale_push_drop(p_token text, p_endpoints text[])
returns json
language plpgsql
security definer
set search_path = public, extensions
set timezone to 'UTC'
as $$
declare
  v_n int;
begin
  if p_token is null or not exists (
       select 1 from public.scale_config c
        where c.key = 'cron_token'
          and c.value <> ''
          and c.value <> ('__SET_' || 'CRON_TOKEN__')
          and extensions.digest(c.value, 'sha256') = extensions.digest(p_token, 'sha256')) then
    raise exception 'scale: forbidden';
  end if;
  delete from public.scale_push p where p.endpoint = any (coalesce(p_endpoints, '{}'::text[]));
  get diagnostics v_n = row_count;
  return json_build_object('dropped', v_n);
end
$$;

-- ----------------------------------------------------------------------------- grants
revoke execute on function public.scale__auth(uuid, text) from public, anon, authenticated;

revoke execute on function public.scale_register(text, text, text) from public;
revoke execute on function public.scale_me(uuid, text) from public;
revoke execute on function public.scale_profile(uuid, text, text, text, boolean, text, text) from public;
revoke execute on function public.scale_log(uuid, text, date, int, int, int) from public;
revoke execute on function public.scale_circle(uuid, text) from public;
revoke execute on function public.scale_join(uuid, text, text) from public;
revoke execute on function public.scale_unfriend(uuid, text, uuid) from public;
revoke execute on function public.scale_push_set(uuid, text, text, text, text, int, text, boolean, text) from public;
revoke execute on function public.scale_due(text, timestamptz) from public;
revoke execute on function public.scale_nudge_targets(text, uuid, text, uuid, timestamptz) from public;
revoke execute on function public.scale_self_targets(text, uuid, text) from public;
revoke execute on function public.scale_push_drop(text, text[]) from public;

grant execute on function public.scale_register(text, text, text) to anon, authenticated;
grant execute on function public.scale_me(uuid, text) to anon, authenticated;
grant execute on function public.scale_profile(uuid, text, text, text, boolean, text, text) to anon, authenticated;
grant execute on function public.scale_log(uuid, text, date, int, int, int) to anon, authenticated;
grant execute on function public.scale_circle(uuid, text) to anon, authenticated;
grant execute on function public.scale_join(uuid, text, text) to anon, authenticated;
grant execute on function public.scale_unfriend(uuid, text, uuid) to anon, authenticated;
grant execute on function public.scale_push_set(uuid, text, text, text, text, int, text, boolean, text) to anon, authenticated;
grant execute on function public.scale_due(text, timestamptz) to anon, authenticated;
grant execute on function public.scale_nudge_targets(text, uuid, text, uuid, timestamptz) to anon, authenticated;
grant execute on function public.scale_self_targets(text, uuid, text) to anon, authenticated;
grant execute on function public.scale_push_drop(text, text[]) to anon, authenticated;

-- ----------------------------------------------------------------------------- hourly reminder cron
-- @cron-begin
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
select cron.unschedule(j.jobid) from cron.job j where j.jobname = 'scale-remind';
select cron.schedule(
  'scale-remind',
  '0 * * * *',
  $cron$
    select net.http_post(
      url := 'https://hk23universe.vercel.app/api/scale-push',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-scale-token', (select value from public.scale_config where key = 'cron_token')
      ),
      body := '{"kind":"remind"}'::jsonb,
      timeout_milliseconds := 20000
    );
  $cron$
);
-- @cron-end
