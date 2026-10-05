-- Run once in the Supabase SQL editor. Promote the first user with:
-- update public.profiles set role = 'gestor' where id = '<auth-user-id>';

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'operador' check (role in ('gestor', 'operador')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.create_profile()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, email, full_name)
  values(new.id, coalesce(new.email, ''), new.raw_user_meta_data->>'full_name')
  on conflict (id) do update set email = excluded.email;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.create_profile();

create table if not exists public.leads (
  id text primary key,
  place_id text unique,
  name text not null,
  niche text,
  lead_class text,
  url_type text,
  review_count integer,
  rating numeric(3,1),
  phone text,
  neighborhood text,
  city text,
  website_url text,
  instagram_url text,
  whatsapp_url text,
  maps_url text,
  maps_status text,
  source text,
  validation text not null default 'pendente' check (validation in ('pendente','validado','descartado')),
  contact_status text not null default 'novo' check (contact_status in ('novo','sem_resposta','conversou','retorno','recusou','nao_contatar')),
  call_attempts integer not null default 0 check (call_attempts >= 0),
  last_contact_at timestamptz,
  next_followup_at timestamptz,
  demo_accepted_at timestamptz,
  demo_sent_at timestamptz,
  presentation_at timestamptz,
  reserved_by uuid references public.profiles(id),
  reserved_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_new_queue_idx on public.leads(validation, contact_status, call_attempts) where phone is not null;
create index if not exists leads_followup_idx on public.leads(next_followup_at) where next_followup_at is not null;
create index if not exists leads_reservation_idx on public.leads(reserved_by, reserved_until);

create table if not exists public.contact_events (
  id bigint generated always as identity primary key,
  lead_id text not null references public.leads(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  kind text not null,
  note text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists contact_events_lead_idx on public.contact_events(lead_id, created_at desc);
create index if not exists contact_events_actor_idx on public.contact_events(actor_id, created_at desc);

create table if not exists public.app_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);
insert into public.app_settings(key, value) values ('demo_url', null) on conflict (key) do nothing;

create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and active and role = 'gestor') $$;

create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and active) $$;

alter table public.profiles enable row level security;
alter table public.leads enable row level security;
alter table public.contact_events enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
using (id = auth.uid() or public.is_manager());
drop policy if exists leads_read on public.leads;
create policy leads_read on public.leads for select to authenticated
using (public.is_manager() or (public.is_active_user() and
  (reserved_by = auth.uid() and reserved_until > now() or
   exists(select 1 from public.contact_events e where e.lead_id = leads.id and e.actor_id = auth.uid()
     and e.kind in ('sem_resposta','conversou','retorno','recusou','nao_contatar')))));
drop policy if exists events_read on public.contact_events;
create policy events_read on public.contact_events for select to authenticated
using (public.is_manager() or (public.is_active_user() and actor_id = auth.uid()));
drop policy if exists settings_read on public.app_settings;
create policy settings_read on public.app_settings for select to authenticated
using (public.is_active_user());

-- All mutations go through checked functions. Prevent direct client writes.
revoke insert, update, delete on public.profiles, public.leads, public.contact_events, public.app_settings from anon, authenticated;
grant select on public.profiles, public.leads, public.contact_events, public.app_settings to authenticated;

create or replace function public.import_leads(p_rows jsonb)
returns integer language plpgsql security definer set search_path = public
as $$
declare r jsonb; n integer := 0;
begin
  if not public.is_manager() and coalesce(auth.role(),'') <> 'service_role' then raise exception 'Acesso negado'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 100 then raise exception 'Lote inválido'; end if;
  for r in select value from jsonb_array_elements(p_rows) loop
    if nullif(r->>'id','') is null or nullif(r->>'name','') is null then continue; end if;
    insert into public.leads(id, place_id, name, niche, lead_class, url_type, review_count, rating,
      phone, neighborhood, city, website_url, instagram_url, whatsapp_url, maps_url, maps_status, source)
    values(r->>'id', nullif(r->>'place_id',''), r->>'name', r->>'niche', r->>'lead_class', r->>'url_type',
      nullif(r->>'review_count','')::integer, nullif(r->>'rating','')::numeric,
      nullif(r->>'phone',''), r->>'neighborhood', r->>'city', r->>'website_url',
      r->>'instagram_url', r->>'whatsapp_url', r->>'maps_url', r->>'maps_status', r->>'source')
    on conflict (id) do update set
      place_id = excluded.place_id, name = excluded.name, niche = excluded.niche, lead_class = excluded.lead_class,
      url_type = excluded.url_type, review_count = excluded.review_count, rating = excluded.rating,
      phone = excluded.phone, neighborhood = excluded.neighborhood, city = excluded.city,
      website_url = excluded.website_url, instagram_url = excluded.instagram_url,
      whatsapp_url = excluded.whatsapp_url, maps_url = excluded.maps_url,
      maps_status = excluded.maps_status, source = excluded.source, updated_at = now();
    n := n + 1;
  end loop;
  return n;
end; $$;

create or replace function public.set_validation(p_lead_id text, p_validation text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_manager() then raise exception 'Acesso negado'; end if;
  if p_validation not in ('pendente','validado','descartado','nao_contatar') then raise exception 'Validação inválida'; end if;
  update public.leads set
    validation = case when p_validation = 'nao_contatar' then 'descartado' else p_validation end,
    contact_status = case when p_validation = 'nao_contatar' then 'nao_contatar' else contact_status end,
    reserved_by = null, reserved_until = null, updated_at = now()
  where id = p_lead_id;
  if not found then raise exception 'Lead não encontrado'; end if;
  insert into public.contact_events(lead_id, actor_id, kind) values(p_lead_id, auth.uid(), 'validacao_' || p_validation);
end; $$;

create or replace function public.claim_lead(p_queue text)
returns public.leads language plpgsql security definer set search_path = public
as $$
declare picked public.leads; picked_id text;
begin
  if not public.is_active_user() then raise exception 'Acesso negado'; end if;
  if p_queue not in ('novo','retorno') then raise exception 'Fila inválida'; end if;
  select * into picked from public.leads where reserved_by = auth.uid() and reserved_until > now() limit 1;
  if found then return picked; end if;
  select id into picked_id from public.leads
  where validation = 'validado' and nullif(trim(phone),'') is not null
    and contact_status not in ('recusou','nao_contatar')
    and (reserved_until is null or reserved_until <= now())
    and ((p_queue = 'novo' and call_attempts = 0 and contact_status = 'novo')
      or (p_queue = 'retorno' and call_attempts > 0 and next_followup_at <= now()))
  order by random() limit 1 for update skip locked;
  if picked_id is null then return null; end if;
  update public.leads set reserved_by = auth.uid(), reserved_until = now() + interval '15 minutes', updated_at = now()
  where id = picked_id returning * into picked;
  insert into public.contact_events(lead_id, actor_id, kind) values(picked_id, auth.uid(), 'reservado_' || p_queue);
  return picked;
end; $$;

create or replace function public.release_lead(p_lead_id text, p_reason text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if nullif(trim(p_reason),'') is null then raise exception 'Informe o motivo'; end if;
  update public.leads set reserved_by = null, reserved_until = null, updated_at = now()
  where id = p_lead_id and reserved_by = auth.uid() and reserved_until > now();
  if not found then raise exception 'Reserva não encontrada ou expirada'; end if;
  insert into public.contact_events(lead_id, actor_id, kind, note)
  values(p_lead_id, auth.uid(), 'nao_ligou', left(p_reason, 1000));
end; $$;

create or replace function public.record_call(
  p_lead_id text, p_outcome text, p_note text, p_followup_at timestamptz,
  p_whatsapp_sent boolean default false, p_demo_accepted boolean default false,
  p_demo_sent boolean default false, p_presentation_at timestamptz default null)
returns void language plpgsql security definer set search_path = public
as $$
declare current_lead public.leads; demo_url text; new_attempts integer;
begin
  if p_outcome not in ('sem_resposta','conversou','retorno','recusou','nao_contatar') then raise exception 'Resultado inválido'; end if;
  select * into current_lead from public.leads where id = p_lead_id for update;
  if not found or current_lead.reserved_by is distinct from auth.uid() or current_lead.reserved_until <= now()
    then raise exception 'Reserva não encontrada ou expirada'; end if;
  if current_lead.validation <> 'validado' or current_lead.contact_status in ('recusou','nao_contatar')
    then raise exception 'Lead indisponível'; end if;
  if p_outcome in ('sem_resposta','retorno') and (p_followup_at is null or p_followup_at <= now())
    then raise exception 'Agende um retorno futuro'; end if;
  if p_followup_at is not null and p_followup_at <= now() then raise exception 'Data de retorno inválida'; end if;
  new_attempts := current_lead.call_attempts + 1;
  if p_whatsapp_sent and (p_outcome <> 'sem_resposta' or new_attempts < 2 or nullif(current_lead.whatsapp_url,'') is null)
    then raise exception 'WhatsApp indisponível para esta tentativa'; end if;
  if (p_demo_accepted or p_demo_sent or p_presentation_at is not null) and p_outcome not in ('conversou','retorno')
    then raise exception 'A demo exige conversa registrada'; end if;
  if p_demo_sent then
    select value into demo_url from public.app_settings where key = 'demo_url';
    if nullif(demo_url,'') is null or (not p_demo_accepted and current_lead.demo_accepted_at is null)
      then raise exception 'Aceite e link público da demo são necessários'; end if;
  end if;
  if p_presentation_at is not null and p_presentation_at <= now() then raise exception 'Agendamento deve ser futuro'; end if;
  update public.leads set call_attempts = new_attempts, contact_status = p_outcome,
    last_contact_at = now(), next_followup_at = p_followup_at,
    demo_accepted_at = case when p_demo_accepted then coalesce(demo_accepted_at, now()) else demo_accepted_at end,
    demo_sent_at = case when p_demo_sent then coalesce(demo_sent_at, now()) else demo_sent_at end,
    presentation_at = coalesce(p_presentation_at, presentation_at),
    reserved_by = null, reserved_until = null, updated_at = now()
  where id = p_lead_id;
  insert into public.contact_events(lead_id, actor_id, kind, note, details)
  values(p_lead_id, auth.uid(), p_outcome, left(p_note, 2000),
    jsonb_build_object('tentativa', new_attempts, 'retorno', p_followup_at,
      'whatsapp_enviado', p_whatsapp_sent,
      'demo_aceita', p_demo_accepted and current_lead.demo_accepted_at is null,
      'demo_enviada', p_demo_sent and current_lead.demo_sent_at is null,
      'apresentacao', p_presentation_at));
end; $$;

create or replace function public.record_demo_progress(p_lead_id text, p_kind text, p_presentation_at timestamptz default null)
returns void language plpgsql security definer set search_path = public
as $$
declare current_lead public.leads; demo_url text;
begin
  if not public.is_active_user() then raise exception 'Acesso negado'; end if;
  select * into current_lead from public.leads where id = p_lead_id for update;
  if not found or (not public.is_manager() and not exists(
      select 1 from public.contact_events where lead_id = p_lead_id and actor_id = auth.uid() and kind in ('conversou','retorno')))
    then raise exception 'Acesso negado'; end if;
  if current_lead.contact_status in ('recusou','nao_contatar') then raise exception 'Lead encerrado'; end if;
  if p_kind = 'aceite' then
    if current_lead.demo_accepted_at is not null then return; end if;
    update public.leads set demo_accepted_at = coalesce(demo_accepted_at, now()), updated_at = now() where id = p_lead_id;
  elsif p_kind = 'enviado' then
    if current_lead.demo_sent_at is not null then return; end if;
    select value into demo_url from public.app_settings where key = 'demo_url';
    if current_lead.demo_accepted_at is null or nullif(demo_url,'') is null then raise exception 'Aceite e link público da demo são necessários'; end if;
    update public.leads set demo_sent_at = coalesce(demo_sent_at, now()), updated_at = now() where id = p_lead_id;
  elsif p_kind = 'agendado' then
    if p_presentation_at is null or p_presentation_at <= now() then raise exception 'Informe data futura'; end if;
    update public.leads set presentation_at = p_presentation_at, updated_at = now() where id = p_lead_id;
  else raise exception 'Etapa inválida'; end if;
  insert into public.contact_events(lead_id, actor_id, kind, details)
  values(p_lead_id, auth.uid(), 'demo_' || p_kind, jsonb_build_object('apresentacao', p_presentation_at));
end; $$;

create or replace function public.set_demo_url(p_url text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_manager() then raise exception 'Acesso negado'; end if;
  if p_url is not null and p_url <> '' and p_url !~ '^https://[^[:space:]]+$' then raise exception 'Use uma URL HTTPS'; end if;
  update public.app_settings set value = nullif(trim(p_url),''), updated_at = now() where key = 'demo_url';
end; $$;

create or replace function public.queue_overview()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_active_user() then raise exception 'Acesso negado'; end if;
  return jsonb_build_object(
    'novos', (select count(*) from public.leads where validation = 'validado' and contact_status = 'novo'
      and call_attempts = 0 and nullif(trim(phone),'') is not null
      and (reserved_until is null or reserved_until <= now())),
    'retornos', (select count(*) from public.leads where validation = 'validado' and call_attempts > 0
      and next_followup_at <= now() and contact_status not in ('recusou','nao_contatar')
      and nullif(trim(phone),'') is not null and (reserved_until is null or reserved_until <= now())),
    'minha_reserva', (select id from public.leads where reserved_by = auth.uid() and reserved_until > now() limit 1)
  );
end; $$;

create or replace function public.dashboard_stats(p_from timestamptz, p_to timestamptz, p_actor uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare chosen_actor uuid;
begin
  if not public.is_active_user() then raise exception 'Acesso negado'; end if;
  chosen_actor := case when public.is_manager() then p_actor else auth.uid() end;
  return jsonb_build_object(
    'sem_abordagem', (select count(*) from public.leads where validation = 'validado' and call_attempts = 0
      and contact_status = 'novo' and nullif(trim(phone),'') is not null),
    'sem_resposta', (select count(*) from public.contact_events where kind = 'sem_resposta'
      and created_at >= p_from and created_at < p_to and (chosen_actor is null or actor_id = chosen_actor)),
    'conversas', (select count(*) from public.contact_events where kind in ('conversou','retorno')
      and created_at >= p_from and created_at < p_to and (chosen_actor is null or actor_id = chosen_actor)),
    'demo_aceita', (select count(*) from public.contact_events where
      (kind = 'demo_aceite' or details->>'demo_aceita' = 'true')
      and created_at >= p_from and created_at < p_to and (chosen_actor is null or actor_id = chosen_actor)),
    'demo_enviada', (select count(*) from public.contact_events where
      (kind = 'demo_enviado' or details->>'demo_enviada' = 'true')
      and created_at >= p_from and created_at < p_to and (chosen_actor is null or actor_id = chosen_actor)),
    'apresentacoes', (select count(*) from public.contact_events where
      (kind = 'demo_agendado' or details->>'apresentacao' is not null)
      and created_at >= p_from and created_at < p_to and (chosen_actor is null or actor_id = chosen_actor)),
    'retornos_atrasados', (select count(*) from public.leads where validation = 'validado' and
      next_followup_at < now() and call_attempts > 0 and contact_status not in ('recusou','nao_contatar'))
  );
end; $$;

revoke all on function public.import_leads(jsonb), public.set_validation(text,text),
  public.claim_lead(text), public.release_lead(text,text),
  public.record_call(text,text,text,timestamptz,boolean,boolean,boolean,timestamptz),
  public.record_demo_progress(text,text,timestamptz), public.set_demo_url(text),
  public.queue_overview(), public.dashboard_stats(timestamptz,timestamptz,uuid) from public, anon;
grant execute on function public.import_leads(jsonb), public.set_validation(text,text),
  public.claim_lead(text), public.release_lead(text,text),
  public.record_call(text,text,text,timestamptz,boolean,boolean,boolean,timestamptz),
  public.record_demo_progress(text,text,timestamptz), public.set_demo_url(text),
  public.queue_overview(), public.dashboard_stats(timestamptz,timestamptz,uuid) to authenticated;
