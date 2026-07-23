(function () {
  "use strict";
  const db=()=>window.FinasureSupabase.client;
  const check=({data,error,count})=>{if(error)throw error;return {data:data||[],count};};
  async function dashboard(){
    const [companies,assessments,reports,appointments,dimensions]=await Promise.all([
      db().from("companies").select("*",{count:"exact",head:true}),
      db().from("assessments").select("id,global_score,global_level,completed_at,company_id,companies(name)").order("completed_at",{ascending:false}),
      db().from("reports").select("id,status,download_count,created_at"),
      db().from("appointments").select("id,status,appointment_date,created_at"),
      db().from("dimension_scores").select("dimension_name,score")
    ]);[companies,assessments,reports,appointments,dimensions].forEach(x=>{if(x.error)throw x.error;});
    return {companyCount:companies.count||0,assessments:assessments.data||[],reports:reports.data||[],appointments:appointments.data||[],dimensions:dimensions.data||[]};
  }
  async function companies(params){
    let q=db().from("companies").select("*,assessments(id,global_score,global_level,completed_at),respondents(id)",{count:"exact"});
    if(params.search)q=q.ilike("name",`%${params.search}%`);if(params.sector)q=q.eq("sector",params.sector);
    q=q.order("created_at",{ascending:false}).range(params.from,params.to);return check(await q);
  }
  async function company(id){return check(await db().from("companies").select("*,respondents(*),assessments(*,dimension_scores(*),reports(*),appointments(*))").eq("id",id).single()).data;}
  async function assessments(params){
    let q=db().from("assessments").select("*,companies(name,sector),respondents(first_name,last_name,email,email_verified,email_verified_at)",{count:"exact"});
    if(params.level)q=q.eq("global_level",params.level);if(params.fromDate)q=q.gte("completed_at",params.fromDate);if(params.toDate)q=q.lte("completed_at",`${params.toDate}T23:59:59`);
    q=q.order("completed_at",{ascending:false}).range(params.from,params.to);return check(await q);
  }
  async function assessment(id){return check(await db().from("assessments").select("*,companies(*),respondents(*),assessment_answers(*),dimension_scores(*),reports(*),appointments(*)").eq("id",id).single()).data;}
  async function reports(status){
    let q=db().from("reports").select("*,assessments(completed_at,global_score,global_level,companies(name),respondents(first_name,last_name,email,email_verified))");
    if(status==="sent")q=q.eq("status","sent");
    if(status==="pending")q=q.in("status",["pending","generating","generated"]);
    if(status==="failed")q=q.eq("status","failed");
    return check(await q.order("created_at",{ascending:false})).data;
  }
  async function appointments(){return check(await db().from("appointments").select("*,assessments(companies(name),respondents(first_name,last_name,email,phone,email_verified))").order("created_at",{ascending:false})).data;}
  async function activity(){return check(await db().from("activity_logs").select("*,companies(name),assessments(global_score)").order("created_at",{ascending:false}).limit(250)).data;}
  window.AdminApi=Object.freeze({dashboard,companies,company,assessments,assessment,reports,appointments,activity});
})();
