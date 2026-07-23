begin;

alter table public.respondents
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null,
  add column if not exists email_verified boolean not null default false,
  add column if not exists email_verified_at timestamptz;

create index if not exists respondents_verified_idx
  on public.respondents(email_verified, email_verified_at desc);

create or replace function public.verify_assessment_email(
  p_assessment_id uuid,
  p_public_access_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user uuid := (select auth.uid());
  v_auth_email text;
  v_respondent_id uuid;
  v_company_id uuid;
  v_respondent_email text;
begin
  if v_auth_user is null then
    raise exception 'Authenticated OTP session required';
  end if;

  select lower(email) into v_auth_email
  from auth.users
  where id = v_auth_user and email_confirmed_at is not null;

  select a.respondent_id, a.company_id, lower(r.email)
  into v_respondent_id, v_company_id, v_respondent_email
  from public.assessments a
  join public.respondents r on r.id = a.respondent_id
  where a.id = p_assessment_id
    and a.public_access_token = p_public_access_token;

  if v_auth_email is null
     or v_respondent_id is null
     or v_auth_email <> v_respondent_email then
    raise exception 'Email verification does not match this assessment';
  end if;

  update public.respondents
  set auth_user_id = v_auth_user,
      email_verified = true,
      email_verified_at = coalesce(email_verified_at, now()),
      updated_at = now()
  where id = v_respondent_id;

  insert into public.activity_logs(
    company_id, respondent_id, assessment_id, event_type, metadata
  )
  values (
    v_company_id, v_respondent_id, p_assessment_id,
    'email_verified', jsonb_build_object('auth_user_id', v_auth_user)
  );

  return true;
end;
$$;

create or replace function public.is_assessment_email_verified(
  p_assessment_id uuid,
  p_public_access_token uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.assessments a
    join public.respondents r on r.id = a.respondent_id
    where a.id = p_assessment_id
      and a.public_access_token = p_public_access_token
      and r.email_verified = true
      and r.auth_user_id = (select auth.uid())
  );
$$;

alter table public.activity_logs
  drop constraint if exists activity_logs_event_type_check;
alter table public.activity_logs
  add constraint activity_logs_event_type_check check (
    event_type in (
      'assessment_started', 'assessment_completed', 'report_requested',
      'report_downloaded', 'appointment_requested', 'appointment_confirmed',
      'report_generated', 'report_sent', 'email_verified', 'error'
    )
  );

revoke all on function public.verify_assessment_email(uuid, uuid) from public;
revoke all on function public.is_assessment_email_verified(uuid, uuid) from public;
grant execute on function public.verify_assessment_email(uuid, uuid) to authenticated;
grant execute on function public.is_assessment_email_verified(uuid, uuid) to authenticated;

commit;
