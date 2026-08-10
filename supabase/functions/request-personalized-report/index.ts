import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
});
const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!)
);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("FINASURE_FROM_EMAIL");
  const contactEmail = Deno.env.get("FINASURE_CONTACT_EMAIL") || "contact@finasure-solutions.com";
  if (!supabaseUrl || !serviceKey || !resendKey || !fromEmail) {
    return json({ error: "server_configuration_missing" }, 500);
  }

  let body: { assessment_id?: string; public_access_token?: string };
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: "invalid_json" }, 400);
  }
  if (!uuidPattern.test(body.assessment_id || "") || !uuidPattern.test(body.public_access_token || "")) {
    return json({ error: "invalid_request" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: assessment, error: assessmentError } = await admin
    .from("assessments")
    .select(`
      id, completed_at, global_score, global_level, company_id, respondent_id,
      companies(name), respondents(first_name,last_name,email),
      reports(id,personalized_status,personalized_requested_at,notification_sent_at)
    `)
    .eq("id", body.assessment_id)
    .eq("public_access_token", body.public_access_token)
    .single();

  if (assessmentError || !assessment) return json({ error: "assessment_access_denied" }, 403);
  const report = Array.isArray(assessment.reports) ? assessment.reports[0] : assessment.reports;
  if (!report) return json({ error: "report_record_missing" }, 409);

  const requestedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await admin
    .from("reports")
    .update({
      personalized_status: "pending",
      personalized_requested_at: requestedAt,
      notification_error: null,
      updated_at: requestedAt,
    })
    .eq("id", report.id)
    .is("personalized_status", null)
    .select("id")
    .maybeSingle();
  if (claimError) return json({ error: "request_persistence_failed" }, 500);
  if (!claimed) {
    return json({
      recorded: true,
      duplicate: true,
      notification_sent: Boolean(report.notification_sent_at),
      message: "Votre demande de rapport personnalisé est déjà enregistrée.",
    });
  }

  await admin.from("activity_logs").insert({
    company_id: assessment.company_id,
    respondent_id: assessment.respondent_id,
    assessment_id: assessment.id,
    event_type: "personalized_report_requested",
    metadata: { source: "full_report_page" },
  });

  const company = Array.isArray(assessment.companies) ? assessment.companies[0] : assessment.companies;
  const respondent = Array.isArray(assessment.respondents) ? assessment.respondents[0] : assessment.respondents;
  const completedDate = assessment.completed_at
    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Casablanca" }).format(new Date(assessment.completed_at))
    : "Non renseignée";
  const emailHtml = `
    <h1>Nouvelle demande de rapport personnalisé Finasure ERM</h1>
    <p>Une entreprise souhaite recevoir son rapport complet gratuit en PDF.</p>
    <ul>
      <li><strong>Entreprise :</strong> ${escapeHtml(company?.name || "Non renseignée")}</li>
      <li><strong>Répondant :</strong> ${escapeHtml(`${respondent?.first_name || ""} ${respondent?.last_name || ""}`.trim() || "Non renseigné")}</li>
      <li><strong>Email :</strong> ${escapeHtml(respondent?.email || "Non renseigné")}</li>
      <li><strong>Score global :</strong> ${escapeHtml(assessment.global_score)} / 5</li>
      <li><strong>Niveau :</strong> ${escapeHtml(assessment.global_level || "Non renseigné")}</li>
      <li><strong>Diagnostic terminé le :</strong> ${escapeHtml(completedDate)}</li>
      <li><strong>Identifiant :</strong> ${escapeHtml(assessment.id)}</li>
    </ul>
    <p>Le rapport doit être préparé et envoyé dans un délai maximum de 48 heures.</p>`;

  let notificationSent = false;
  let notificationError = "";
  try {
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `personalized-report-${assessment.id}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [contactEmail],
        subject: "Nouvelle demande de rapport personnalisé Finasure ERM",
        html: emailHtml,
      }),
    });
    if (!resendResponse.ok) {
      const responseText = await resendResponse.text();
      throw new Error(`Resend ${resendResponse.status}: ${responseText}`);
    }
    notificationSent = true;
    await admin.from("reports").update({ notification_sent_at: new Date().toISOString(), notification_error: null }).eq("id", report.id);
  } catch (error) {
    notificationError = String(error instanceof Error ? error.message : error).slice(0, 1500);
    console.error("Personalized report notification failed", notificationError);
    await admin.from("reports").update({ notification_error: notificationError }).eq("id", report.id);
    await admin.from("activity_logs").insert({
      company_id: assessment.company_id,
      respondent_id: assessment.respondent_id,
      assessment_id: assessment.id,
      event_type: "personalized_report_notification_failed",
      metadata: { error: notificationError },
    });
  }

  return json({
    recorded: true,
    notification_sent: notificationSent,
    message: "Votre demande de rapport personnalisé a bien été enregistrée.",
  });
});
