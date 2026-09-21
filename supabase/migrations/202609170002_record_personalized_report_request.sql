begin;

-- Enregistre la demande sans exposer la table reports au navigateur.
create or replace function public.request_personalized_report(
  p_assessment_id uuid,
  p_public_access_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assessment public.assessments%rowtype;
  v_report public.reports%rowtype;
  v_requested_at timestamptz := now();
  v_is_new boolean := false;
begin
  select * into v_assessment
  from public.assessments
  where id = p_assessment_id
    and public_access_token = p_public_access_token;

  if not found then
    return jsonb_build_object('recorded', false, 'error', 'assessment_access_denied');
  end if;

  select * into v_report
  from public.reports
  where assessment_id = v_assessment.id
  for update;

  if not found then
    return jsonb_build_object('recorded', false, 'error', 'report_record_missing');
  end if;

  if v_report.personalized_status is null then
    update public.reports
    set personalized_status = 'pending',
        personalized_requested_at = v_requested_at,
        notification_error = null,
        updated_at = v_requested_at
    where id = v_report.id;
    v_is_new := true;

    insert into public.activity_logs(
      company_id, respondent_id, assessment_id, event_type, metadata
    ) values (
      v_assessment.company_id,
      v_assessment.respondent_id,
      v_assessment.id,
      'personalized_report_requested',
      jsonb_build_object('source', 'full_report_page')
    );
  end if;

  return jsonb_build_object(
    'recorded', true,
    'duplicate', not v_is_new,
    'notification_sent', v_report.notification_sent_at is not null,
    'notification_pending', v_report.notification_sent_at is null
  );
end;
$$;

revoke all on function public.request_personalized_report(uuid, uuid) from public;
grant execute on function public.request_personalized_report(uuid, uuid) to anon, authenticated;

commit;
