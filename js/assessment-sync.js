(function () {
  "use strict";

  function uuid() {
    return crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function getQuestions() {
    return Array.isArray(window.FINASURE_ERM_DATA?.questions)
      ? window.FINASURE_ERM_DATA.questions
      : [];
  }

  function ensureSyncKey(state) {
    if (!state.syncKey) {
      state.syncKey = uuid();
      window.FinasureStorage?.save(state);
    }
    return state.syncKey;
  }

  function buildPayload(state, options) {
    const questions = getQuestions();
    const calculated = window.FinasureCalcul?.calculate(
      window.FINASURE_ERM_DATA,
      state.answers
    );
    const results = calculated || state.results || {};
    const client = state.client || {};
    const dimensions = Array.isArray(results.dimensions)
      ? results.dimensions
      : window.FINASURE_ERM_DATA?.dimensions || [];

    return {
      idempotency_key: ensureSyncKey(state),
      started_at: state.startedAt || null,
      completed_at: state.completedAt || new Date().toISOString(),
      company: {
        name: client.company,
        sector: client.sector,
        workforce: client.workforce,
        scope: client.scope
      },
      respondent: {
        first_name: client.firstName,
        last_name: client.lastName,
        job_title: client.jobTitle,
        email: client.email,
        phone: client.phone,
        consent: Boolean(client.consent)
      },
      results: {
        global_score: results.globalScore,
        percentage: results.percentage,
        global_level: results.globalLevel || "",
      },
      answers: questions.map((question, index) => ({
        question_id: Number(question.id ?? index + 1),
        question_text: question.text || "",
        answer_code: question.answers?.[
          Number(state.answers?.[question.id ?? index + 1]) - 1
        ]?.code || "",
        score: Number(state.answers?.[question.id ?? index + 1]),
        answer_text:
          question.answers?.[
            Number(state.answers?.[question.id ?? index + 1]) - 1
          ]?.description || "",
        comment: state.comments?.[`step-${Math.floor(index / 9) + 1}`] || ""
      })),
      dimensions: dimensions.map((item) => ({
        dimension_id: item.id,
        dimension_name: item.name,
        score: Number(item.score || 0),
        weight: Number(item.weight || 0),
        level: item.level || "",
        priority_index: Number(item.priorityIndex || 0)
      })),
      report_requested: Boolean(options?.reportRequested)
    };
  }

  async function syncAssessment(state, options) {
    const api = window.FinasureSupabase;
    if (!api?.configured || !api.client) {
      state.syncStatus = "local";
      window.FinasureStorage?.save(state);
      return { synced: false, reason: "not-configured" };
    }

    try {
      state.syncStatus = "syncing";
      window.FinasureStorage?.save(state);
      const { data, error } = await api.client.rpc(
        "submit_assessment",
        { p_payload: buildPayload(state, options) }
      );
      if (error) throw error;
      state.remoteAssessmentId = data.assessment_id;
      state.remoteAccessToken = data.public_access_token;
      state.syncStatus = "synced";
      state.syncedAt = new Date().toISOString();
      window.FinasureStorage?.save(state);
      return { synced: true, data };
    } catch (error) {
      console.error("Synchronisation Supabase différée", error);
      state.syncStatus = "pending";
      state.syncError = "La synchronisation sera retentée ultérieurement.";
      window.FinasureStorage?.save(state);
      return { synced: false, reason: "request-failed" };
    }
  }

  async function recordReportDownload(state) {
    const api = window.FinasureSupabase;
    if (!api?.configured || !state.remoteAssessmentId || !state.remoteAccessToken) return;
    await api.client.rpc("record_report_download", {
      p_assessment_id: state.remoteAssessmentId,
      p_public_access_token: state.remoteAccessToken
    });
  }

  async function syncAppointment(state, appointment) {
    const api = window.FinasureSupabase;
    if (!api?.configured) return { synced: false };
    if (!state.remoteAssessmentId) await syncAssessment(state, { reportRequested: true });
    if (!state.remoteAssessmentId) return { synced: false };

    const { error } = await api.client.rpc("request_appointment", {
      p_assessment_id: state.remoteAssessmentId,
      p_public_access_token: state.remoteAccessToken,
      p_date: appointment.date,
      p_time: appointment.time,
      p_reason: appointment.reason
    });
    if (error) {
      console.error("Synchronisation du rendez-vous différée", error);
      return { synced: false };
    }
    return { synced: true };
  }

  window.FinasureAssessmentSync = Object.freeze({
    syncAssessment,
    syncAppointment,
    recordReportDownload
  });
})();
