begin;

create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'admin' check (role in ('admin', 'viewer')),
  created_at timestamptz not null default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sector text,
  workforce text,
  scope text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists companies_name_unique on public.companies (lower(name));

create table if not exists public.respondents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  job_title text,
  email text not null,
  phone text,
  consent boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, email)
);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  respondent_id uuid not null references public.respondents(id) on delete restrict,
  idempotency_key text not null unique,
  public_access_token uuid not null default gen_random_uuid() unique,
  started_at timestamptz,
  completed_at timestamptz,
  global_score numeric(4,2) check (global_score between 1 and 5),
  global_level text,
  percentage integer check (percentage between 0 and 100),
  status text not null default 'completed' check (status in ('started', 'completed', 'archived', 'error')),
  source text not null default 'public-questionnaire',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assessment_answers (
  id bigint generated always as identity primary key,
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  question_id integer not null,
  question_text text not null,
  answer_code text not null check (answer_code in ('A', 'B', 'C', 'D', 'E')),
  answer_text text not null,
  score smallint not null check (score between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (assessment_id, question_id)
);

create table if not exists public.dimension_scores (
  id bigint generated always as identity primary key,
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  dimension_id text not null,
  dimension_name text not null,
  score numeric(4,2) not null check (score between 1 and 5),
  weight numeric(5,2) not null check (weight between 0 and 100),
  level text,
  priority_index numeric(8,3),
  created_at timestamptz not null default now(),
  unique (assessment_id, dimension_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null unique references public.assessments(id) on delete cascade,
  status text not null default 'not_requested' check (status in ('not_requested', 'requested', 'generated', 'sent', 'error')),
  requested_at timestamptz,
  generated_at timestamptz,
  sent_at timestamptz,
  downloaded_at timestamptz,
  error_message text,
  download_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  respondent_id uuid not null references public.respondents(id) on delete restrict,
  appointment_date date not null,
  appointment_time time not null,
  reason text not null,
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'completed', 'cancelled')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id bigint generated always as identity primary key,
  company_id uuid references public.companies(id) on delete cascade,
  respondent_id uuid references public.respondents(id) on delete set null,
  assessment_id uuid references public.assessments(id) on delete cascade,
  event_type text not null check (event_type in ('assessment_started', 'assessment_completed', 'report_requested', 'report_downloaded', 'appointment_requested', 'appointment_confirmed', 'report_generated', 'report_sent', 'error')),
  metadata jsonb not null default '{}'::jsonb,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists respondents_company_idx on public.respondents(company_id);
create index if not exists respondents_email_idx on public.respondents(lower(email));
create index if not exists assessments_company_idx on public.assessments(company_id, completed_at desc);
create index if not exists assessments_respondent_idx on public.assessments(respondent_id);
create index if not exists assessments_created_idx on public.assessments(created_at desc);
create index if not exists answers_assessment_idx on public.assessment_answers(assessment_id);
create index if not exists dimensions_assessment_idx on public.dimension_scores(assessment_id);
create index if not exists appointments_date_idx on public.appointments(appointment_date, appointment_time);
create index if not exists logs_created_idx on public.activity_logs(created_at desc);
create index if not exists logs_assessment_idx on public.activity_logs(assessment_id);

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid()) and role in ('admin', 'viewer')
  );
$$;

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;

alter table public.admin_users enable row level security;
alter table public.companies enable row level security;
alter table public.respondents enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_answers enable row level security;
alter table public.dimension_scores enable row level security;
alter table public.reports enable row level security;
alter table public.appointments enable row level security;
alter table public.activity_logs enable row level security;

create policy "admin users read self or admin" on public.admin_users for select to authenticated
using ((select auth.uid()) = user_id or (select private.is_admin()));

create policy "admins read companies" on public.companies for select to authenticated using ((select private.is_admin()));
create policy "admins update companies" on public.companies for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admins read respondents" on public.respondents for select to authenticated using ((select private.is_admin()));
create policy "admins read assessments" on public.assessments for select to authenticated using ((select private.is_admin()));
create policy "admins update assessments" on public.assessments for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admins read answers" on public.assessment_answers for select to authenticated using ((select private.is_admin()));
create policy "admins read dimension scores" on public.dimension_scores for select to authenticated using ((select private.is_admin()));
create policy "admins read reports" on public.reports for select to authenticated using ((select private.is_admin()));
create policy "admins update reports" on public.reports for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admins read appointments" on public.appointments for select to authenticated using ((select private.is_admin()));
create policy "admins update appointments" on public.appointments for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admins read activity logs" on public.activity_logs for select to authenticated using ((select private.is_admin()));

revoke all on public.admin_users, public.companies, public.respondents, public.assessments, public.assessment_answers, public.dimension_scores, public.reports, public.appointments, public.activity_logs from anon;
grant select on public.admin_users, public.companies, public.respondents, public.assessments, public.assessment_answers, public.dimension_scores, public.reports, public.appointments, public.activity_logs to authenticated;
grant update on public.companies, public.assessments, public.reports, public.appointments to authenticated;

create or replace function public.submit_assessment(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_respondent_id uuid;
  v_assessment_id uuid;
  v_token uuid;
  v_answer jsonb;
  v_dimension jsonb;
  v_key text := nullif(trim(p_payload->>'idempotency_key'), '');
begin
  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or jsonb_typeof(p_payload->'answers') <> 'array'
     or jsonb_typeof(p_payload->'dimensions') <> 'array' then
    raise exception 'Invalid assessment payload';
  end if;
  if v_key is null or jsonb_array_length(coalesce(p_payload->'answers', '[]'::jsonb)) <> 33 then
    raise exception 'Invalid assessment payload';
  end if;
  if length(v_key) > 100
     or length(trim(p_payload->'company'->>'name')) not between 2 and 200
     or length(trim(p_payload->'respondent'->>'first_name')) not between 2 and 100
     or length(trim(p_payload->'respondent'->>'last_name')) not between 2 and 100
     or lower(trim(p_payload->'respondent'->>'email')) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     or coalesce((p_payload->'respondent'->>'consent')::boolean, false) is not true
     or (select count(distinct (value->>'question_id')::integer) from jsonb_array_elements(p_payload->'answers')) <> 33
     or exists (
       select 1 from jsonb_array_elements(p_payload->'answers')
       where (value->>'question_id')::integer not between 1 and 33
          or (value->>'score')::integer not between 1 and 5
          or value->>'answer_code' not in ('A','B','C','D','E')
          or length(value->>'question_text') > 1000
          or length(value->>'answer_text') > 2000
     )
     or jsonb_array_length(p_payload->'dimensions') <> 11 then
    raise exception 'Company and respondent are required';
  end if;

  select id, public_access_token into v_assessment_id, v_token
  from public.assessments where idempotency_key = v_key;
  if v_assessment_id is not null then
    return jsonb_build_object('assessment_id', v_assessment_id, 'public_access_token', v_token, 'duplicate', true);
  end if;

  select id into v_company_id from public.companies where lower(name) = lower(trim(p_payload->'company'->>'name')) limit 1;
  if v_company_id is null then
    insert into public.companies(name, sector, workforce, scope)
    values (trim(p_payload->'company'->>'name'), p_payload->'company'->>'sector', p_payload->'company'->>'workforce', p_payload->'company'->>'scope')
    returning id into v_company_id;
  else
    update public.companies set
      sector = coalesce(nullif(p_payload->'company'->>'sector', ''), sector),
      workforce = coalesce(nullif(p_payload->'company'->>'workforce', ''), workforce),
      scope = coalesce(nullif(p_payload->'company'->>'scope', ''), scope),
      updated_at = now()
    where id = v_company_id;
  end if;

  select id into v_respondent_id from public.respondents
  where company_id = v_company_id and lower(email) = lower(trim(p_payload->'respondent'->>'email')) limit 1;
  if v_respondent_id is null then
    insert into public.respondents(company_id, first_name, last_name, job_title, email, phone, consent)
    values (v_company_id, trim(p_payload->'respondent'->>'first_name'), trim(p_payload->'respondent'->>'last_name'), p_payload->'respondent'->>'job_title', lower(trim(p_payload->'respondent'->>'email')), p_payload->'respondent'->>'phone', coalesce((p_payload->'respondent'->>'consent')::boolean, false))
    returning id into v_respondent_id;
  else
    update public.respondents set first_name=trim(p_payload->'respondent'->>'first_name'), last_name=trim(p_payload->'respondent'->>'last_name'), job_title=p_payload->'respondent'->>'job_title', phone=p_payload->'respondent'->>'phone', consent=coalesce((p_payload->'respondent'->>'consent')::boolean, consent), updated_at=now() where id=v_respondent_id;
  end if;

  insert into public.assessments(company_id, respondent_id, idempotency_key, started_at, completed_at, global_score, global_level, percentage, status)
  values (v_company_id, v_respondent_id, v_key, nullif(p_payload->>'started_at','')::timestamptz, coalesce(nullif(p_payload->>'completed_at','')::timestamptz, now()), (p_payload->'results'->>'global_score')::numeric, p_payload->'results'->>'global_level', (p_payload->'results'->>'percentage')::integer, 'completed')
  returning id, public_access_token into v_assessment_id, v_token;

  for v_answer in select value from jsonb_array_elements(p_payload->'answers') loop
    insert into public.assessment_answers(assessment_id, question_id, question_text, answer_code, answer_text, score, comment)
    values (v_assessment_id, (v_answer->>'question_id')::integer, v_answer->>'question_text', v_answer->>'answer_code', v_answer->>'answer_text', (v_answer->>'score')::smallint, nullif(v_answer->>'comment',''));
  end loop;
  for v_dimension in select value from jsonb_array_elements(p_payload->'dimensions') loop
    insert into public.dimension_scores(assessment_id, dimension_id, dimension_name, score, weight, level, priority_index)
    values (v_assessment_id, v_dimension->>'dimension_id', v_dimension->>'dimension_name', (v_dimension->>'score')::numeric, (v_dimension->>'weight')::numeric, v_dimension->>'level', (v_dimension->>'priority_index')::numeric);
  end loop;
  insert into public.reports(assessment_id, status, requested_at)
  values (v_assessment_id, case when coalesce((p_payload->>'report_requested')::boolean,false) then 'requested' else 'not_requested' end, case when coalesce((p_payload->>'report_requested')::boolean,false) then now() else null end);
  insert into public.activity_logs(company_id, respondent_id, assessment_id, event_type)
  values (v_company_id, v_respondent_id, v_assessment_id, 'assessment_completed');
  if coalesce((p_payload->>'report_requested')::boolean,false) then
    insert into public.activity_logs(company_id, respondent_id, assessment_id, event_type) values (v_company_id, v_respondent_id, v_assessment_id, 'report_requested');
  end if;
  return jsonb_build_object('assessment_id', v_assessment_id, 'public_access_token', v_token, 'duplicate', false);
end;
$$;

create or replace function public.record_report_download(p_assessment_id uuid, p_public_access_token uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_company uuid; v_respondent uuid;
begin
  select company_id, respondent_id into v_company, v_respondent from public.assessments where id=p_assessment_id and public_access_token=p_public_access_token;
  if v_company is null then return false; end if;
  update public.reports set status='generated', generated_at=coalesce(generated_at,now()), downloaded_at=now(), download_count=download_count+1, updated_at=now() where assessment_id=p_assessment_id;
  insert into public.activity_logs(company_id,respondent_id,assessment_id,event_type) values(v_company,v_respondent,p_assessment_id,'report_downloaded');
  return true;
end; $$;

create or replace function public.request_appointment(p_assessment_id uuid, p_public_access_token uuid, p_date date, p_time time, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_company uuid; v_respondent uuid; v_id uuid;
begin
  select company_id, respondent_id into v_company, v_respondent from public.assessments where id=p_assessment_id and public_access_token=p_public_access_token;
  if v_company is null then raise exception 'Invalid assessment token'; end if;
  insert into public.appointments(assessment_id,respondent_id,appointment_date,appointment_time,reason,status)
  values(p_assessment_id,v_respondent,p_date,p_time,p_reason,'requested') returning id into v_id;
  insert into public.activity_logs(company_id,respondent_id,assessment_id,event_type,metadata) values(v_company,v_respondent,p_assessment_id,'appointment_requested',jsonb_build_object('appointment_id',v_id));
  return v_id;
end; $$;

revoke all on function public.submit_assessment(jsonb) from public;
revoke all on function public.record_report_download(uuid,uuid) from public;
revoke all on function public.request_appointment(uuid,uuid,date,time,text) from public;
grant execute on function public.submit_assessment(jsonb) to anon, authenticated;
grant execute on function public.record_report_download(uuid,uuid) to anon, authenticated;
grant execute on function public.request_appointment(uuid,uuid,date,time,text) to anon, authenticated;

commit;
