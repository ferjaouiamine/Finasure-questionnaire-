begin;

create table if not exists public.assessment_recommendations (
  id bigint generated always as identity primary key,
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  dimension_id text not null,
  dimension_name text not null,
  diagnostic text not null,
  short_term_actions text not null,
  medium_term_actions text not null,
  is_strength boolean not null default false,
  is_priority boolean not null default false,
  created_at timestamptz not null default now(),
  unique (assessment_id, dimension_id)
);

create index if not exists recommendations_assessment_idx
  on public.assessment_recommendations(assessment_id);

alter table public.assessment_recommendations enable row level security;
drop policy if exists "admins read assessment recommendations"
  on public.assessment_recommendations;
create policy "admins read assessment recommendations"
  on public.assessment_recommendations for select to authenticated
  using ((select private.is_admin()));
revoke all on public.assessment_recommendations from anon;
grant select on public.assessment_recommendations to authenticated;

alter table public.reports
  add column if not exists respondent_id uuid references public.respondents(id) on delete set null,
  add column if not exists recipient_email text,
  add column if not exists provider text,
  add column if not exists provider_message_id text,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists retry_count integer not null default 0;

update public.reports r
set respondent_id = a.respondent_id
from public.assessments a
where a.id = r.assessment_id and r.respondent_id is null;

alter table public.reports drop constraint if exists reports_status_check;

update public.reports
set status = case
  when status in ('not_requested', 'requested') then 'pending'
  when status = 'error' then 'failed'
  else status
end;

alter table public.reports add constraint reports_status_check
  check (status in ('pending', 'generating', 'generated', 'sent', 'failed'));

create or replace function private.normalize_report_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('not_requested', 'requested') then new.status := 'pending'; end if;
  if new.status = 'error' then new.status := 'failed'; end if;
  if new.respondent_id is null then
    select respondent_id into new.respondent_id
    from public.assessments where id = new.assessment_id;
  end if;
  return new;
end;
$$;

drop trigger if exists normalize_report_status_trigger on public.reports;
create trigger normalize_report_status_trigger
before insert or update on public.reports
for each row execute function private.normalize_report_status();

create or replace function public.save_assessment_recommendations(
  p_assessment_id uuid,
  p_public_access_token uuid,
  p_recommendations jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
begin
  if not exists (
    select 1 from public.assessments
    where id = p_assessment_id and public_access_token = p_public_access_token
  ) then
    raise exception 'Invalid assessment token';
  end if;
  if jsonb_typeof(p_recommendations) <> 'array'
     or jsonb_array_length(p_recommendations) <> 11 then
    raise exception 'Invalid recommendations payload';
  end if;
  for v_item in select value from jsonb_array_elements(p_recommendations) loop
    if nullif(v_item->>'dimension_id', '') is null
       or length(v_item->>'diagnostic') > 5000
       or length(v_item->>'short_term_actions') > 5000
       or length(v_item->>'medium_term_actions') > 5000 then
      raise exception 'Invalid recommendation';
    end if;
    insert into public.assessment_recommendations(
      assessment_id, dimension_id, dimension_name, diagnostic,
      short_term_actions, medium_term_actions, is_strength, is_priority
    ) values (
      p_assessment_id,
      v_item->>'dimension_id',
      v_item->>'dimension_name',
      coalesce(v_item->>'diagnostic', ''),
      coalesce(v_item->>'short_term_actions', ''),
      coalesce(v_item->>'medium_term_actions', ''),
      coalesce((v_item->>'is_strength')::boolean, false),
      coalesce((v_item->>'is_priority')::boolean, false)
    )
    on conflict (assessment_id, dimension_id) do update set
      dimension_name = excluded.dimension_name,
      diagnostic = excluded.diagnostic,
      short_term_actions = excluded.short_term_actions,
      medium_term_actions = excluded.medium_term_actions,
      is_strength = excluded.is_strength,
      is_priority = excluded.is_priority;
  end loop;
  return true;
end;
$$;

revoke all on function public.save_assessment_recommendations(uuid, uuid, jsonb) from public;
grant execute on function public.save_assessment_recommendations(uuid, uuid, jsonb)
  to anon, authenticated;

create or replace function public.record_report_download(
  p_assessment_id uuid,
  p_public_access_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_company uuid; v_respondent uuid;
begin
  select company_id, respondent_id into v_company, v_respondent
  from public.assessments
  where id = p_assessment_id and public_access_token = p_public_access_token;
  if v_company is null then return false; end if;
  update public.reports set
    status = case when status = 'sent' then 'sent' else 'generated' end,
    generated_at = coalesce(generated_at, now()),
    downloaded_at = now(),
    download_count = download_count + 1,
    updated_at = now()
  where assessment_id = p_assessment_id;
  insert into public.activity_logs(company_id, respondent_id, assessment_id, event_type)
  values(v_company, v_respondent, p_assessment_id, 'report_downloaded');
  return true;
end;
$$;

alter table public.activity_logs drop constraint if exists activity_logs_event_type_check;
alter table public.activity_logs add constraint activity_logs_event_type_check check (
  event_type in (
    'assessment_started', 'assessment_completed', 'report_requested',
    'report_downloaded', 'appointment_requested', 'appointment_confirmed',
    'report_generated', 'report_sent', 'report_failed',
    'email_verified', 'error'
  )
);

commit;
