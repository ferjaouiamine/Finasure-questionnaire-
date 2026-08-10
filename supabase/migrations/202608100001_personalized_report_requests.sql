begin;

alter table public.reports
  add column if not exists personalized_status text,
  add column if not exists personalized_requested_at timestamptz,
  add column if not exists personalized_processed_at timestamptz,
  add column if not exists personalized_sent_at timestamptz,
  add column if not exists notification_sent_at timestamptz,
  add column if not exists notification_error text;

alter table public.reports
  drop constraint if exists reports_personalized_status_check;
alter table public.reports
  add constraint reports_personalized_status_check check (
    personalized_status is null or personalized_status in (
      'pending', 'in_progress', 'completed', 'sent'
    )
  );

create index if not exists reports_personalized_status_idx
  on public.reports(personalized_status, personalized_requested_at desc)
  where personalized_status is not null;

alter table public.activity_logs drop constraint if exists activity_logs_event_type_check;
alter table public.activity_logs add constraint activity_logs_event_type_check check (
  event_type in (
    'assessment_started', 'assessment_completed', 'report_requested',
    'report_downloaded', 'appointment_requested', 'appointment_confirmed',
    'report_generated', 'report_sent', 'report_failed',
    'email_verified', 'error', 'personalized_report_requested',
    'personalized_report_notification_failed'
  )
);

commit;
