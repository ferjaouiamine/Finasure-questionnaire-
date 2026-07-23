(function () {
  "use strict";

  const RESEND_DELAY_SECONDS = 60;

  function client() {
    const api = window.FinasureSupabase;
    if (!api?.configured || !api.client) {
      throw new Error("La vérification email est momentanément indisponible.");
    }
    return api.client;
  }

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  async function sendCode(email) {
    const normalized = normalizeEmail(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new Error("L’adresse email est invalide.");
    }
    const { error } = await client().auth.signInWithOtp({
      email: normalized,
      options: { shouldCreateUser: true }
    });
    if (error) throw error;
    return normalized;
  }

  async function verifyCode(email, token) {
    const code = String(token || "").trim();
    if (!/^\d+$/.test(code)) {
      throw new Error("Saisissez uniquement les chiffres du code reçu par email.");
    }
    const { data, error } = await client().auth.verifyOtp({
      email: normalizeEmail(email),
      token: code,
      type: "email"
    });
    if (!error && data.user) return data.user;

    // Le code peut avoir été consommé juste avant un échec d'enregistrement
    // en base. Dans ce cas, la session Supabase vérifiée reste valable.
    const { data: sessionData } = await client().auth.getUser();
    const sessionUser = sessionData?.user;
    if (
      sessionUser?.email_confirmed_at &&
      normalizeEmail(sessionUser.email) === normalizeEmail(email)
    ) {
      return sessionUser;
    }
    throw new Error("Le code est incorrect ou a expiré.");
  }

  async function markAssessmentVerified(state) {
    if (!state.remoteAssessmentId || !state.remoteAccessToken) {
      const result = await window.FinasureAssessmentSync.syncAssessment(state, {
        reportRequested: true
      });
      if (!result.synced) {
        throw new Error("Impossible d’enregistrer l’évaluation. Réessayez.");
      }
    }
    const { data, error } = await client().rpc("verify_assessment_email", {
      p_assessment_id: state.remoteAssessmentId,
      p_public_access_token: state.remoteAccessToken
    });
    if (error || data !== true) throw error || new Error("Vérification non enregistrée.");
    return true;
  }

  async function hasVerifiedAccess(state) {
    if (!state.remoteAssessmentId || !state.remoteAccessToken) return false;
    const { data: userData, error: userError } = await client().auth.getUser();
    if (userError || !userData.user) return false;
    if (normalizeEmail(userData.user.email) !== normalizeEmail(state.client?.email)) return false;
    const { data, error } = await client().rpc("is_assessment_email_verified", {
      p_assessment_id: state.remoteAssessmentId,
      p_public_access_token: state.remoteAccessToken
    });
    return !error && data === true;
  }

  async function sendReport(state, options) {
    if (!state.remoteAssessmentId) {
      throw new Error("L’évaluation associée au rapport est introuvable.");
    }
    const { data, error } = await client().functions.invoke("send-erm-report", {
      body: {
        assessment_id: state.remoteAssessmentId,
        resend: Boolean(options?.resend)
      }
    });
    if (error) {
      let details = null;
      try {
        details = await error.context?.json();
      } catch (_) {
        details = null;
      }
      const reportError = new Error(
        details?.message || "L’envoi du rapport a rencontré un problème."
      );
      reportError.code = details?.error || "report_send_failed";
      throw reportError;
    }
    return data;
  }

  window.FinasureOtp = Object.freeze({
    RESEND_DELAY_SECONDS,
    sendCode,
    verifyCode,
    markAssessmentVerified,
    hasVerifiedAccess,
    sendReport
  });
})();
