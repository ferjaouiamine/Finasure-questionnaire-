begin;

-- Adapte la validation serveur au questionnaire ERM V2 : 22 affirmations, 3 choix.
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
  if v_key is null or jsonb_array_length(coalesce(p_payload->'answers', '[]'::jsonb)) <> 22 then
    raise exception 'Invalid assessment payload';
  end if;
  if length(v_key) > 100
     or length(trim(p_payload->'company'->>'name')) not between 2 and 200
     or length(trim(p_payload->'respondent'->>'first_name')) not between 2 and 100
     or length(trim(p_payload->'respondent'->>'last_name')) not between 2 and 100
     or lower(trim(p_payload->'respondent'->>'email')) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     or coalesce((p_payload->'respondent'->>'consent')::boolean, false) is not true
     or (select count(distinct (value->>'question_id')::integer) from jsonb_array_elements(p_payload->'answers')) <> 22
     or exists (
       select 1 from jsonb_array_elements(p_payload->'answers')
       where (value->>'question_id')::integer not between 1 and 22
          or (value->>'score')::integer not between 1 and 3
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

commit;
