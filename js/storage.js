(function () {
  "use strict";

  const KEY = "finasureErmAssessment";
  const VERSION = "2026.4";
  const object = (value) =>
    value && typeof value === "object" && !Array.isArray(value) ? value : {};

  const empty = () => ({
    version: VERSION,
    currentStep: 1,
    answers: {},
    comments: {},
    evidence: {},
    client: {
      firstName: "",
      lastName: "",
      company: "",
      sector: "",
      workforce: "",
      jobTitle: "",
      email: "",
      phone: "",
      scope: "",
      consent: false
    },
    results: {
      globalScore: null,
      percentage: null,
      dimensionScores: {},
      strengths: [],
      priorities: [],
      recommendations: []
    },
    selectedAction: "",
    booking: { minimumDelayDays: 7, bookingUrl: "", status: "" },
    syncKey: "",
    syncStatus: "local",
    syncError: "",
    syncedAt: "",
    remoteAssessmentId: "",
    remoteAccessToken: "",
    emailVerified: false,
    emailVerifiedAt: "",
    verifiedEmail: "",
    otpSentAt: "",
    reportEmailStatus: "",
    reportEmailMessage: "",
    questionnaireCompleted: false,
    clientFormCompleted: false,
    leadFormCompleted: false,
    startedAt: "",
    completedAt: "",
    updatedAt: ""
  });

  function migrateAssessmentData(raw) {
    const base = empty();
    const old = object(raw);
    const oldClient = { ...object(old.company), ...object(old.respondent) };
    return {
      ...base,
      ...old,
      version: VERSION,
      currentStep: Math.min(4, Math.max(1, Number(old.currentStep) || 1)),
      answers: { ...object(old.answers) },
      comments: { ...object(old.comments) },
      evidence: { ...object(old.evidence) },
      client: {
        ...base.client,
        ...object(old.client),
        firstName: String(old.client?.firstName ?? oldClient.firstName ?? ""),
        lastName: String(old.client?.lastName ?? oldClient.lastName ?? ""),
        company: String(old.client?.company ?? oldClient.companyName ?? ""),
        sector: String(old.client?.sector ?? oldClient.sector ?? ""),
        workforce: String(old.client?.workforce ?? oldClient.workforce ?? ""),
        jobTitle: String(old.client?.jobTitle ?? oldClient.role ?? ""),
        email: String(old.client?.email ?? oldClient.email ?? ""),
        phone: String(old.client?.phone ?? oldClient.phone ?? ""),
        scope: String(old.client?.scope ?? oldClient.scope ?? ""),
        consent: Boolean(old.client?.consent ?? oldClient.consent ?? false)
      },
      results: { ...base.results, ...object(old.results) },
      booking: { ...base.booking, ...object(old.booking) },
      selectedAction: String(old.selectedAction || ""),
      syncKey: String(old.syncKey || ""),
      syncStatus: String(old.syncStatus || "local"),
      syncError: String(old.syncError || ""),
      syncedAt: String(old.syncedAt || ""),
      remoteAssessmentId: String(old.remoteAssessmentId || ""),
      remoteAccessToken: String(old.remoteAccessToken || ""),
      emailVerified: Boolean(old.emailVerified),
      emailVerifiedAt: String(old.emailVerifiedAt || ""),
      verifiedEmail: String(old.verifiedEmail || ""),
      otpSentAt: String(old.otpSentAt || ""),
      reportEmailStatus: String(old.reportEmailStatus || ""),
      reportEmailMessage: String(old.reportEmailMessage || ""),
      questionnaireCompleted: Boolean(old.questionnaireCompleted || old.completedAt),
      clientFormCompleted: Boolean(old.clientFormCompleted),
      leadFormCompleted: Boolean(old.leadFormCompleted || old.clientFormCompleted),
      startedAt: String(old.startedAt || ""),
      completedAt: String(old.completedAt || ""),
      updatedAt: String(old.updatedAt || "")
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return migrateAssessmentData(raw ? JSON.parse(raw) : null);
    } catch (error) {
      console.warn("Stockage local indisponible ou invalide", error);
      return empty();
    }
  }

  function save(value) {
    try {
      const normalized = migrateAssessmentData(value);
      normalized.updatedAt = new Date().toISOString();
      localStorage.setItem(KEY, JSON.stringify(normalized));
      Object.assign(value, normalized);
      return true;
    } catch (error) {
      console.error("Échec de sauvegarde", error);
      return false;
    }
  }

  function clear() {
    try {
      localStorage.removeItem(KEY);
      return true;
    } catch (_) {
      return false;
    }
  }

  window.FinasureStorage = Object.freeze({
    KEY,
    VERSION,
    load,
    save,
    clear,
    empty,
    migrateAssessmentData
  });
})();
