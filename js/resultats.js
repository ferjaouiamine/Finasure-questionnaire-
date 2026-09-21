(function () {
  "use strict";
  const data = window.FINASURE_ERM_DATA;
  const state = FinasureStorage.load();
  const form = document.querySelector("#complement-form");
  const complete = data?.questions?.every((question) => {
    const answer = Number(state.answers[question.id]);
    return answer >= 1 && answer <= 5;
  });

  if (!complete || !state.questionnaireCompleted) {
    sessionStorage.setItem("finasureNotice", "Certaines réponses sont manquantes. Veuillez terminer le questionnaire.");
    location.href = "questionnaire.html";
    return;
  }

  try {
    const results = FinasureCalcul.calculate(data, state.answers);
    state.results = {
      globalScore: results.globalScore,
      percentage: results.percentage,
      dimensionScores: Object.fromEntries(results.dimensions.map((dimension) => [dimension.id, dimension.score])),
      strengths: results.strengths.map((dimension) => dimension.id),
      priorities: results.priorities.map((dimension) => dimension.id),
      recommendations: results.dimensions.map((dimension) => dimension.id)
    };
    FinasureStorage.save(state);
  } catch (error) {
    showPageError(error.message);
    form.hidden = true;
    return;
  }

  form.elements.company.value = state.client?.company || "";
  form.elements.sector.value = state.client?.sector || "";
  form.elements.workforce.value = state.client?.workforce || "";
  form.elements.jobTitle.value = state.client?.jobTitle || "";
  form.elements.phone.value = state.client?.phone || "";
  form.elements.consent.checked = Boolean(state.client?.consent);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    clearErrors();
    const values = Object.fromEntries(new FormData(form));
    const company = String(values.company || "").trim();
    const sector = String(values.sector || "").trim();
    const workforce = String(values.workforce || "").trim();
    const jobTitle = String(values.jobTitle || "").trim();
    const phone = String(values.phone || "").trim();
    let firstInvalid = null;

    if (!company) firstInvalid = addError("company", "Indiquez le nom de l’entreprise.", firstInvalid);
    if (!sector) firstInvalid = addError("sector", "Sélectionnez un secteur d’activité.", firstInvalid);
    if (!workforce) firstInvalid = addError("workforce", "Sélectionnez l’effectif de l’entreprise.", firstInvalid);
    if (!jobTitle) firstInvalid = addError("jobTitle", "Indiquez votre fonction.", firstInvalid);
    if (!phone || !/^[+()\d\s.-]+$/.test(phone) || phone.replace(/\D/g, "").length < 7) firstInvalid = addError("phone", "Saisissez un numéro de téléphone valide.", firstInvalid);
    if (!form.elements.consent.checked) firstInvalid = addError("consent", "Votre consentement est nécessaire pour générer le rapport.", firstInvalid);
    if (firstInvalid) { firstInvalid.focus(); return; }

    state.client = { ...state.client, company, sector, workforce, jobTitle, phone, consent: true };
    state.leadFormCompleted = true;
    state.clientFormCompleted = true;
    if (!FinasureStorage.save(state)) {
      showPageError("Les informations n’ont pas pu être enregistrées. Veuillez réessayer.");
      return;
    }
    location.href = "rapport-complet.html";
  });

  function addError(name, message, currentInvalid) {
    const field = form.elements[name];
    field.setAttribute("aria-invalid", "true");
    document.querySelector(`#error-${name}`).textContent = message;
    return currentInvalid || field;
  }
  function clearErrors() {
    form.querySelectorAll("[aria-invalid]").forEach((field) => field.removeAttribute("aria-invalid"));
    form.querySelectorAll(".field-error").forEach((error) => { error.textContent = ""; });
  }
  function showPageError(message) {
    const box = document.querySelector("#results-error");
    box.textContent = message;
    box.hidden = false;
  }
})();
