begin;

create or replace function private.is_admin_editor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function private.is_admin_editor() from public;
grant execute on function private.is_admin_editor() to authenticated;

create or replace function public.admin_update_company(
  p_company_id uuid,
  p_name text,
  p_sector text default null,
  p_workforce text default null,
  p_scope text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company public.companies;
begin
  if not private.is_admin_editor() then
    raise exception 'Administrator role required' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_name, ''))) not between 2 and 200 then
    raise exception 'Invalid company name';
  end if;

  update public.companies
  set name = trim(p_name),
      sector = nullif(trim(coalesce(p_sector, '')), ''),
      workforce = nullif(trim(coalesce(p_workforce, '')), ''),
      scope = nullif(trim(coalesce(p_scope, '')), ''),
      updated_at = now()
  where id = p_company_id
  returning * into v_company;

  if not found then
    raise exception 'Company not found';
  end if;
  return to_jsonb(v_company);
end;
$$;

create or replace function public.admin_delete_company(p_company_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin_editor() then
    raise exception 'Administrator role required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.companies where id = p_company_id) then
    return false;
  end if;

  delete from public.assessments where company_id = p_company_id;
  delete from public.respondents where company_id = p_company_id;
  delete from public.activity_logs where company_id = p_company_id;
  delete from public.companies where id = p_company_id;
  return true;
end;
$$;

create or replace function public.admin_update_assessment(
  p_assessment_id uuid,
  p_status text,
  p_completed_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assessment public.assessments;
begin
  if not private.is_admin_editor() then
    raise exception 'Administrator role required' using errcode = '42501';
  end if;
  if p_status not in ('started', 'completed', 'archived', 'error') then
    raise exception 'Invalid assessment status';
  end if;

  update public.assessments
  set status = p_status,
      completed_at = p_completed_at,
      updated_at = now()
  where id = p_assessment_id
  returning * into v_assessment;

  if not found then
    raise exception 'Assessment not found';
  end if;
  return to_jsonb(v_assessment);
end;
$$;

create or replace function public.admin_delete_assessment(p_assessment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin_editor() then
    raise exception 'Administrator role required' using errcode = '42501';
  end if;
  delete from public.assessments where id = p_assessment_id;
  return found;
end;
$$;

revoke all on function public.admin_update_company(uuid,text,text,text,text) from public;
revoke all on function public.admin_delete_company(uuid) from public;
revoke all on function public.admin_update_assessment(uuid,text,timestamptz) from public;
revoke all on function public.admin_delete_assessment(uuid) from public;
grant execute on function public.admin_update_company(uuid,text,text,text,text) to authenticated;
grant execute on function public.admin_delete_company(uuid) to authenticated;
grant execute on function public.admin_update_assessment(uuid,text,timestamptz) to authenticated;
grant execute on function public.admin_delete_assessment(uuid) to authenticated;

commit;
