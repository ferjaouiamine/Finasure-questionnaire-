(function () {
  "use strict";

  const calendarData = window.FinasureCalendarData;
  const questionnaireData = window.FINASURE_ERM_DATA;
  const state = FinasureStorage.load();
  const form = document.querySelector("#appointment-form");
  const grid = document.querySelector("#calendar-grid");
  const slotsList = document.querySelector("#slots-list");
  const minimumDate = calendarData.getMinimumBookingDate();
  let displayedMonth = new Date(minimumDate.getFullYear(), minimumDate.getMonth(), 1);
  let selectedDate = null;
  let selectedSlot = "";

  const assessmentComplete = questionnaireData?.questions?.every((question) => {
    const answer = Number(state.answers[question.id]);
    return answer >= 1 && answer <= 5;
  });
  if (!assessmentComplete || !state.questionnaireCompleted) {
    location.href = "questionnaire.html";
    return;
  }
  if (!state.leadFormCompleted || !state.client?.consent) {
    location.href = "demande-rapport.html";
    return;
  }

  function createElement(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function formatLongDate(date) {
    return date.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  }

  function renderCalendar() {
    const year = displayedMonth.getFullYear();
    const month = displayedMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const leadingEmptyCells = (firstDay.getDay() + 6) % 7;
    const fullDates = calendarData.getFullyBookedDates();
    const fragment = document.createDocumentFragment();

    document.querySelector("#calendar-title").textContent = displayedMonth.toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric"
    });
    document.querySelector("#previous-month").disabled =
      year === minimumDate.getFullYear() && month <= minimumDate.getMonth();

    for (let index = 0; index < leadingEmptyCells; index += 1) {
      const empty = createElement("span", "calendar-empty");
      empty.setAttribute("aria-hidden", "true");
      fragment.append(empty);
    }

    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      const date = new Date(year, month, day);
      const dateKey = calendarData.toDateKey(date);
      const isFull = fullDates.includes(dateKey) && calendarData.isBookableDay(date);
      const availableSlots = calendarData.getAvailableSlots(date);
      const button = createElement("button", "calendar-day", String(day));
      button.type = "button";
      button.setAttribute("role", "gridcell");
      button.dataset.date = dateKey;

      if (isFull) {
        button.classList.add("is-full");
        button.disabled = true;
        button.setAttribute("aria-label", `${formatLongDate(date)} — complet`);
      } else if (!availableSlots.length) {
        button.classList.add("is-unavailable");
        button.disabled = true;
        button.setAttribute("aria-label", `${formatLongDate(date)} — indisponible`);
      } else {
        button.classList.add("is-available");
        button.setAttribute("aria-label", `${formatLongDate(date)} — ${availableSlots.length} créneaux disponibles`);
        if (selectedDate && calendarData.toDateKey(selectedDate) === dateKey) {
          button.classList.add("is-selected");
          button.setAttribute("aria-selected", "true");
        }
        button.addEventListener("click", () => selectDate(date));
      }
      fragment.append(button);
    }
    grid.replaceChildren(fragment);
  }

  function selectDate(date) {
    selectedDate = new Date(date);
    selectedSlot = "";
    document.querySelector("#selected-date").textContent = formatLongDate(selectedDate);
    document.querySelector("#appointment-selection").textContent = "Choisissez maintenant un horaire";
    renderCalendar();
    renderSlots();
  }

  function renderSlots() {
    const slots = selectedDate ? calendarData.getAvailableSlots(selectedDate) : [];
    if (!slots.length) {
      slotsList.replaceChildren(createElement("p", "slots-placeholder", "Aucun créneau disponible pour cette date."));
      return;
    }
    const fragment = document.createDocumentFragment();
    slots.forEach((slot) => {
      const wrapper = createElement("div", "slot-option");
      const input = createElement("input");
      const label = createElement("label", null, slot.replace(":", "h"));
      input.type = "radio";
      input.name = "appointmentSlot";
      input.id = `slot-${slot.replace(":", "-")}`;
      input.value = slot;
      label.htmlFor = input.id;
      input.addEventListener("change", () => {
        selectedSlot = slot;
        document.querySelector("#appointment-selection").textContent = `${formatLongDate(selectedDate)} à ${slot.replace(":", "h")}`;
        document.querySelector("#error-slot").textContent = "";
      });
      wrapper.append(input, label);
      fragment.append(wrapper);
    });
    slotsList.replaceChildren(fragment);
  }

  function prefillForm() {
    const client = state.client || {};
    ["firstName", "lastName", "company", "email", "phone"].forEach((name) => {
      if (form.elements[name]) form.elements[name].value = String(client[name] || "");
    });
  }

  function clearErrors() {
    form.querySelectorAll("[aria-invalid]").forEach((field) => field.removeAttribute("aria-invalid"));
    form.querySelectorAll(".field-error").forEach((node) => { node.textContent = ""; });
    document.querySelector("#appointment-success").hidden = true;
  }

  function addError(name, text, invalidFields) {
    const field = form.elements[name];
    field?.setAttribute("aria-invalid", "true");
    const message = document.querySelector(`#error-${name}`);
    if (message) message.textContent = text;
    if (field) invalidFields.push(field);
  }

  document.querySelector("#previous-month").addEventListener("click", () => {
    displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() - 1, 1);
    renderCalendar();
  });
  document.querySelector("#next-month").addEventListener("click", () => {
    displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 1);
    renderCalendar();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors();
    const values = Object.fromEntries(new FormData(form).entries());
    values.email = String(values.email || "").trim();
    form.elements.email.value = values.email;
    const invalid = [];

    if (String(values.firstName || "").trim().length < 2) addError("firstName", "Saisissez au moins 2 caractères.", invalid);
    if (String(values.lastName || "").trim().length < 2) addError("lastName", "Saisissez au moins 2 caractères.", invalid);
    if (!String(values.company || "").trim()) addError("company", "L’entreprise est obligatoire.", invalid);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) addError("email", "Saisissez une adresse e-mail valide.", invalid);
    const phone = String(values.phone || "").trim();
    if (!/^[+()\d\s.-]+$/.test(phone) || phone.replace(/\D/g, "").length < 7) addError("phone", "Saisissez un numéro de téléphone valide.", invalid);
    if (!String(values.reason || "").trim()) addError("reason", "Précisez le motif du rendez-vous.", invalid);
    const slotValid = Boolean(selectedDate && selectedSlot && calendarData.getAvailableSlots(selectedDate).includes(selectedSlot));
    if (!slotValid) {
      document.querySelector("#error-slot").textContent = "Sélectionnez une date et un créneau disponibles.";
      if (!invalid.length) document.querySelector("#calendar-title").scrollIntoView({ behavior: "smooth", block: "center" });
    }

    if (invalid.length || !slotValid) {
      invalid[0]?.focus();
      return;
    }

    state.client = {
      ...state.client,
      firstName: String(values.firstName).trim(),
      lastName: String(values.lastName).trim(),
      company: String(values.company).trim(),
      email: values.email,
      phone
    };
    state.booking = {
      ...state.booking,
      minimumDelayDays: calendarData.config.minimumDelayDays,
      status: "demo-requested",
      appointment: {
        date: calendarData.toDateKey(selectedDate),
        time: selectedSlot,
        reason: String(values.reason).trim(),
        requestedAt: new Date().toISOString()
      }
    };

    if (!FinasureStorage.save(state)) {
      const box = document.querySelector("#appointment-error");
      box.textContent = "Impossible d’enregistrer votre demande pour le moment.";
      box.hidden = false;
      return;
    }
    await window.FinasureAssessmentSync?.syncAppointment(
      state,
      state.booking.appointment
    );
    const success = document.querySelector("#appointment-success");
    success.hidden = false;
    success.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  prefillForm();
  renderCalendar();
})();
