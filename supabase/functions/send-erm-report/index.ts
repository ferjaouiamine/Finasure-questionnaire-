import { createClient } from "npm:@supabase/supabase-js@2";
import { generateReportPdf, ReportData } from "./pdf.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!)
  );
const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
};
const filePart = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "Entreprise";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("FINASURE_FROM_EMAIL");
  if (!supabaseUrl || !anonKey || !serviceKey || !resendKey || !fromEmail) {
    return json({ error: "server_configuration_missing" }, 500);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "authentication_required" }, 401);
  const jwt = authorization.slice(7);
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(jwt);
  if (userError || !userData.user?.email) return json({ error: "invalid_session" }, 401);

  let body: { assessment_id?: string; resend?: boolean };
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: "invalid_json" }, 400);
  }
  if (!/^[0-9a-f-]{36}$/i.test(body.assessment_id || "")) {
    return json({ error: "invalid_assessment_id" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: assessment, error: assessmentError } = await admin
    .from("assessments")
    .select(`
      id, completed_at, global_score, global_level, percentage, company_id, respondent_id,
      companies(name),
      respondents(first_name,last_name,email,auth_user_id,email_verified,email_verified_at),
      dimension_scores(id,dimension_id,dimension_name,score,weight,level,priority_index),
      assessment_recommendations(dimension_id,dimension_name,diagnostic,short_term_actions,medium_term_actions,is_strength,is_priority),
      reports(id,status,retry_count,generated_at,sent_at)
    `)
    .eq("id", body.assessment_id)
    .single();
  if (assessmentError || !assessment) return json({ error: "assessment_not_found" }, 404);

  const respondent = Array.isArray(assessment.respondents)
    ? assessment.respondents[0]
    : assessment.respondents;
  const company = Array.isArray(assessment.companies)
    ? assessment.companies[0]
    : assessment.companies;
  const report = Array.isArray(assessment.reports) ? assessment.reports[0] : assessment.reports;
  const verifiedEmail = userData.user.email.trim().toLowerCase();
  if (
    !respondent?.email_verified ||
    respondent.auth_user_id !== userData.user.id ||
    String(respondent.email).trim().toLowerCase() !== verifiedEmail
  ) {
    return json({ error: "assessment_access_denied" }, 403);
  }
  if (!report) return json({ error: "report_record_missing" }, 409);
  if (report.status === "sent" && !body.resend) {
    return json({
      status: "already_sent",
      message: "Votre rapport a déjà été envoyé à votre adresse email.",
      sent_at: report.sent_at,
    });
  }
  if (report.status === "generating") {
    return json({ status: "processing", message: "Votre rapport est déjà en cours de préparation." }, 202);
  }
  if ((assessment.dimension_scores || []).length !== 11 ||
      (assessment.assessment_recommendations || []).length !== 11) {
    return json({ error: "report_data_incomplete" }, 422);
  }

  const allowedStatuses = body.resend
    ? ["sent", "failed", "generated", "pending"]
    : ["pending", "failed", "generated"];
  const { data: claimed, error: claimError } = await admin
    .from("reports")
    .update({
      status: "generating",
      respondent_id: assessment.respondent_id,
      recipient_email: verifiedEmail,
      last_attempt_at: new Date().toISOString(),
      retry_count: Number(report.retry_count || 0) + 1,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", report.id)
    .in("status", allowedStatuses)
    .select("id,retry_count")
    .maybeSingle();
  if (claimError) return json({ error: "report_claim_failed" }, 500);
  if (!claimed) return json({ status: "processing" }, 202);

  let phase = "generation";
  try {
    const dimensions = [...assessment.dimension_scores].sort((a, b) => a.id - b.id);
    const reportData: ReportData = {
      company,
      respondent,
      assessment: {
        completed_at: assessment.completed_at,
        global_score: Number(assessment.global_score),
        global_level: assessment.global_level,
        percentage: Number(assessment.percentage),
      },
      dimensions,
      recommendations: assessment.assessment_recommendations,
    };
    const pdf = await generateReportPdf(reportData, Deno.env.get("FINASURE_LOGO_URL"));
    const date = new Date(assessment.completed_at).toISOString().slice(0, 10);
    const filename = `Rapport_ERM_${filePart(company.name)}_${date}.pdf`;
    await admin.from("reports").update({
      status: "generated",
      generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", report.id);
    await admin.from("activity_logs").insert({
      company_id: assessment.company_id,
      respondent_id: assessment.respondent_id,
      assessment_id: assessment.id,
      event_type: "report_generated",
      metadata: { filename },
    });

    phase = "email";
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": body.resend
          ? `erm-${assessment.id}-retry-${claimed.retry_count}`
          : `erm-${assessment.id}-automatic`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [verifiedEmail],
        subject: "Votre rapport de maturité ERM Finasure",
        html: `<p>Bonjour ${escapeHtml(respondent.first_name)},</p>
          <p>Votre adresse email a bien été vérifiée.</p>
          <p>Vous trouverez en pièce jointe votre rapport d’évaluation de maturité ERM.</p>
          <p>Ce document reprend votre score global, vos résultats par dimension, vos principaux points forts ainsi que les recommandations issues de votre évaluation.</p>
          <p>Nous restons à votre disposition pour vous accompagner dans l’amélioration de votre dispositif de gestion des risques.</p>
          <p>Bien cordialement,<br>L’équipe Finasure</p>`,
        attachments: [{ filename, content: bytesToBase64(pdf) }],
        tags: [{ name: "assessment_id", value: assessment.id.replaceAll("-", "_") }],
      }),
    });
    const emailResult = await emailResponse.json();
    if (!emailResponse.ok) throw new Error(emailResult?.message || "Email provider rejected the request");

    const sentAt = new Date().toISOString();
    await admin.from("reports").update({
      status: "sent",
      sent_at: sentAt,
      recipient_email: verifiedEmail,
      provider: "resend",
      provider_message_id: emailResult.id,
      error_message: null,
      updated_at: sentAt,
    }).eq("id", report.id);
    await admin.from("activity_logs").insert({
      company_id: assessment.company_id,
      respondent_id: assessment.respondent_id,
      assessment_id: assessment.id,
      event_type: "report_sent",
      metadata: { provider: "resend", provider_message_id: emailResult.id },
    });
    return json({
      status: "sent",
      message: "Votre rapport a été envoyé à votre adresse email.",
      sent_at: sentAt,
    });
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error).slice(0, 1000);
    await admin.from("reports").update({
      status: "failed",
      error_message: message,
      updated_at: new Date().toISOString(),
    }).eq("id", report.id);
    await admin.from("activity_logs").insert({
      company_id: assessment.company_id,
      respondent_id: assessment.respondent_id,
      assessment_id: assessment.id,
      event_type: "report_failed",
      metadata: { phase, message },
    });
    return json({
      error: phase === "generation" ? "pdf_generation_failed" : "email_send_failed",
      phase,
      message: phase === "generation"
        ? "Votre adresse email a été vérifiée, mais nous n’avons pas pu générer votre PDF. Vous pouvez consulter votre rapport en ligne."
        : "Votre rapport est prêt, mais l’envoi par email a rencontré un problème.",
    }, 502);
  }
});
