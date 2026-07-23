begin;

-- Une même identité Supabase peut répondre à plusieurs évaluations
-- (par exemple pour plusieurs entreprises ou plusieurs campagnes).
alter table public.respondents
  drop constraint if exists respondents_auth_user_id_key;

create index if not exists respondents_auth_user_id_idx
  on public.respondents(auth_user_id);

commit;
