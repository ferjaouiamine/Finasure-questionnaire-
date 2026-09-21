(function () {
  "use strict";

  const GENERIC_ERROR = "La demande n’a pas pu être enregistrée pour le moment. Veuillez réessayer.";

  async function request(state) {
    const api = window.FinasureSupabase;
    if (!api?.configured || !api.client) throw new Error(GENERIC_ERROR);

    if (!state.remoteAssessmentId || !state.remoteAccessToken) {
      const synchronization = await window.FinasureAssessmentSync?.syncAssessment(state, {
        reportRequested: true
      });
      if (!synchronization?.synced) throw new Error(GENERIC_ERROR);
    }

    // La notification interne est en pause : la demande est enregistrée par
    // une fonction SQL sécurisée, sans dépendre du CORS d'une Edge Function.
    const { data, error } = await api.client.rpc("request_personalized_report", {
      p_assessment_id: state.remoteAssessmentId,
      p_public_access_token: state.remoteAccessToken
    });

    if (error || !data?.recorded) {
      console.error("Demande de rapport personnalisé refusée", error || data);
      throw new Error(GENERIC_ERROR);
    }
    return data;
  }

  window.FinasureReportRequest = Object.freeze({ request });
})();
