(function () {
  "use strict";

  const menu = document.querySelector(".menu-button");
  const nav = document.querySelector(".main-nav");
  const form = document.querySelector("#home-start-form");
  const state = window.FinasureStorage.load();

  menu?.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    menu.setAttribute("aria-expanded", String(open));
  });

  ["firstName", "lastName", "email"].forEach((name) => {
    const input = form.elements[name];
    input.value = String(state.client?.[name] || "");
  });

  function showFieldError(name, message) {
    const input = form.elements[name];
    const error = form.querySelector(`[data-error-for="${name}"]`);
    input.setAttribute("aria-invalid", String(Boolean(message)));
    error.textContent = message;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    const email = String(values.email || "").trim().toLowerCase();
    const errors = {
      firstName: String(values.firstName || "").trim().length >= 2 ? "" : "Saisissez votre prénom.",
      lastName: String(values.lastName || "").trim().length >= 2 ? "" : "Saisissez votre nom.",
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "" : "Saisissez une adresse e-mail valide."
    };

    Object.entries(errors).forEach(([name, message]) => showFieldError(name, message));
    const firstInvalid = Object.keys(errors).find((name) => errors[name]);
    if (firstInvalid) {
      form.elements[firstInvalid].focus();
      return;
    }

    state.client = {
      ...state.client,
      firstName: String(values.firstName).trim(),
      lastName: String(values.lastName).trim(),
      email
    };
    state.startedAt = state.startedAt || new Date().toISOString();

    if (!window.FinasureStorage.save(state)) {
      showFieldError("email", "Impossible d’enregistrer vos informations pour le moment.");
      return;
    }
    window.location.href = "questionnaire.html";
  });
})();
