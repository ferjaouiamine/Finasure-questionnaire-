-- Données exclusivement destinées à un environnement de démonstration.
-- Suppression possible avec: delete from companies where is_demo = true cascade;
-- DONNÉES FICTIVES UNIQUEMENT. NE PAS EXÉCUTER EN PRODUCTION.
-- Fichier volontairement séparé du seed automatique.
do $$
declare
  company_names text[] := array['Atlas Courtage','Nova Industrie','Medica Plus','Tech Horizon','Groupe Carthage','Logis Afrique','Énergie Durable','Finance Conseil','Retail Connect','Agro Valeur'];
  sectors text[] := array['Assurance','Industrie','Santé','Technologies','Services','Logistique','Énergie','Finance','Commerce','Agroalimentaire'];
  levels text[] := array['Émergent','En progression','Établi','Avancé','Aspirationnel'];
  c uuid; r uuid; a uuid; i int; j int; score numeric; d record;
begin
  for i in 1..10 loop
    insert into public.companies(name,sector,workforce,is_demo) values(company_names[i],sectors[i],case when i<4 then '11 à 49' when i<8 then '50 à 249' else '250 à 999' end,true) returning id into c;
    insert into public.respondents(company_id,first_name,last_name,job_title,email,phone,consent,is_demo) values(c,'Contact',i::text,'Responsable risques','demo'||i||'@example.test','+216 20 000 '||lpad(i::text,3,'0'),true,true) returning id into r;
    for j in 1..2 loop
      score := round((1 + random()*4)::numeric,2);
      insert into public.assessments(company_id,respondent_id,idempotency_key,started_at,completed_at,global_score,global_level,percentage,status,is_demo)
      values(c,r,'demo-'||i||'-'||j,now()-make_interval(days => i*20+j*5),now()-make_interval(days => i*20+j*5),score,levels[least(5,greatest(1,ceil(score)::int))],round(score/5*100),'completed',true) returning id into a;
      for d in select * from (values ('strategie','Stratégie',8),('gouvernance','Gouvernance',12),('culture','Culture',8),('identification','Identification des risques',10),('analyse','Analyse et évaluation',10),('traitement','Traitement des risques',10),('revue','Revue et révision',7),('reporting','Information et reporting',7),('continuite','Continuité d’activité',12),('crise','Gestion de crise',10),('resilience','Résilience organisationnelle',6)) x(id,name,weight) loop
        insert into public.dimension_scores(assessment_id,dimension_id,dimension_name,score,weight,level,priority_index) values(a,d.id,d.name,greatest(1,least(5,score+(random()-.5))),d.weight,levels[least(5,greatest(1,ceil(score)::int))],(5-score)*d.weight);
      end loop;
      insert into public.reports(assessment_id,status,requested_at) values(a,case when (i+j)%3=0 then 'requested' else 'not_requested' end,case when (i+j)%3=0 then now() else null end);
      insert into public.activity_logs(company_id,respondent_id,assessment_id,event_type,is_demo) values(c,r,a,'assessment_completed',true);
      if (i+j)%4=0 then insert into public.appointments(assessment_id,respondent_id,appointment_date,appointment_time,reason,status,is_demo) values(a,r,current_date+(i+j),time '10:00','Présentation du diagnostic','requested',true); end if;
    end loop;
  end loop;
end $$;
