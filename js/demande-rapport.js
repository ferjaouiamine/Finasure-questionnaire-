(function () {
  "use strict";
  const data = window.FINASURE_ERM_DATA;
  const state = FinasureStorage.load();
  const form = document.querySelector("#lead-form");
  const complete = data?.questions?.every((question) => Number(state.answers[question.id]) >= 1 && Number(state.answers[question.id]) <= 5);

  if (!complete || !state.questionnaireCompleted || !Number.isFinite(Number(state.results?.globalScore))) {
    location.href = complete ? "resultats.html" : "questionnaire.html";
    return;
  }

  ["company", "sector", "workforce", "firstName", "lastName", "jobTitle", "email", "phone"].forEach((name) => {
    if (form.elements[name]) form.elements[name].value = String(state.client?.[name] || "");
  });
  form.elements.consent.checked = Boolean(state.client?.consent);

  function clearErrors() {
    form.querySelectorAll("[aria-invalid]").forEach((field) => field.removeAttribute("aria-invalid"));
    form.querySelectorAll(".field-error").forEach((node) => { node.textContent = ""; });
  }

  function addError(name, text, invalidFields) {
    const field = form.elements[name];
    field?.setAttribute("aria-invalid", "true");
    const message = document.querySelector(`#error-${name}`);
    if (message) message.textContent = text;
    if (field) invalidFields.push(field);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors();
    const values = Object.fromEntries(new FormData(form).entries());
    const invalid = [];
    values.email = String(values.email || "").trim();
    form.elements.email.value = values.email;

    if (!String(values.company || "").trim()) addError("company", "Le nom de l’entreprise est obligatoire.", invalid);
    if (!String(values.sector || "").trim()) addError("sector", "Sélectionnez un secteur d’activité.", invalid);
    if (!String(values.workforce || "").trim()) addError("workforce", "Sélectionnez un effectif.", invalid);
    if (String(values.firstName || "").trim().length < 2) addError("firstName", "Saisissez au moins 2 caractères.", invalid);
    if (String(values.lastName || "").trim().length < 2) addError("lastName", "Saisissez au moins 2 caractères.", invalid);
    if (!String(values.jobTitle || "").trim()) addError("jobTitle", "La fonction est obligatoire.", invalid);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) addError("email", "Saisissez une adresse e-mail valide.", invalid);
    const phone = String(values.phone || "").trim();
    if (phone && (!/^[+()\d\s.-]+$/.test(phone) || phone.replace(/\D/g, "").length < 7)) addError("phone", "Saisissez un numéro de téléphone valide.", invalid);
    if (!form.elements.consent.checked) addError("consent", "Votre consentement est obligatoire.", invalid);

    if (invalid.length) {
      invalid[0].focus();
      return;
    }

    const previousEmail = String(state.client?.email || "").trim().toLowerCase();
    state.client = {
      ...state.client,
      company: String(values.company).trim(),
      sector: String(values.sector).trim(),
      workforce: String(values.workforce).trim(),
      firstName: String(values.firstName).trim(),
      lastName: String(values.lastName).trim(),
      jobTitle: String(values.jobTitle).trim(),
      email: values.email,
      phone,
      consent: true
    };
    state.leadFormCompleted = true;
    state.clientFormCompleted = true;
    if (previousEmail !== values.email.toLowerCase()) {
      state.emailVerified = false;
      state.emailVerifiedAt = "";
      state.verifiedEmail = "";
      if (state.remoteAssessmentId) {
        state.syncKey = "";
        state.syncStatus = "local";
        state.remoteAssessmentId = "";
        state.remoteAccessToken = "";
      }
    }

    if (!FinasureStorage.save(state)) {
      const box = document.querySelector("#lead-page-error");
      box.textContent = "Impossible d’enregistrer vos informations pour le moment.";
      box.hidden = false;
      return;
    }
    const submitButton = form.querySelector('[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Enregistrement…";
    }
    try {
      await window.FinasureAssessmentSync?.syncAssessment(state, {
        reportRequested: true
      });
      await window.FinasureOtp.sendCode(state.client.email);
      state.otpSentAt = new Date().toISOString();
      state.emailVerified = false;
      FinasureStorage.save(state);
      location.href = "verification-email.html";
    } catch (error) {
      const box = document.querySelector("#lead-page-error");
      box.textContent = error.message || "Impossible d’envoyer le code de vérification.";
      box.hidden = false;
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Accéder à mon rapport complet →";
      }
    }
  });
})();
