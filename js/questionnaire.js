(function () {
  "use strict";

  const data = window.FINASURE_ERM_DATA;
  const state = FinasureStorage.load();
  const list = document.querySelector("#questions-list");
  const form = document.querySelector("#questions-form");
  const message = document.querySelector("#validation-message");
  const previous = document.querySelector("#previous-button");
  const next = document.querySelector("#next-button");
  const totalQuestions = data?.questions?.length || 0;

  if (!data?.questions || totalQuestions !== 33 || data.steps.length !== 4) {
    showError("Les données du questionnaire sont absentes ou incomplètes.");
    return;
  }

  let step = Math.min(3, Math.max(0, state.currentStep - 1));
  const notice = sessionStorage.getItem("finasureNotice");
  if (notice) {
    sessionStorage.removeItem("finasureNotice");
    showError(notice);
  }
  state.startedAt = state.startedAt || new Date().toISOString();

  function createElement(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function persist() {
    if (!FinasureStorage.save(state)) {
      showError("Impossible d’enregistrer vos réponses pour le moment.");
    }
  }

  function dimensionName(id) {
    return data.dimensions.find((item) => item.id === id)?.name || "Dimension non définie";
  }

  function createQuestionCard(question) {
    const card = createElement("article", "question-card");
    card.dataset.question = String(question.id);

    const meta = createElement(
      "p",
      "question-meta",
      `Question ${question.id} · ${dimensionName(question.dimensionId)}`
    );
    const title = createElement("h2", "question-title", question.text);
    title.id = `question-${question.id}`;

    const group = createElement("fieldset", "answer-grid");
    const legend = createElement(
      "legend",
      "sr-only",
      `Choisissez une réponse pour la question ${question.id}`
    );
    group.append(legend);

    question.answers.forEach((answer) => {
      const wrapper = createElement("div", "answer-option");
      const input = createElement("input");
      const label = createElement("label");
      const description = createElement(
        "span",
        "answer-description",
        answer.description
      );

      input.type = "radio";
      input.name = `question-${question.id}`;
      input.id = `q${question.id}-${answer.code}`;
      input.value = String(answer.score);
      input.checked = Number(state.answers[question.id]) === answer.score;
      label.htmlFor = input.id;
      label.append(description);
      wrapper.append(input, label);
      group.append(wrapper);
    });

    card.append(meta, title, group);
    return card;
  }

  function createStepComment() {
    const commentKey = `step-${step + 1}`;
    const section = createElement("section", "step-comment");
    const label = createElement(
      "label",
      "step-comment-label",
      "Commentaire ou élément de preuve pour cette étape"
    );
    const textarea = createElement("textarea", "comment-area step-comment-area");

    textarea.id = `comment-step-${step + 1}`;
    textarea.name = commentKey;
    textarea.rows = 5;
    textarea.placeholder =
      "Ajoutez ici un commentaire, une précision ou un élément de preuve concernant cette étape…";
    textarea.value = String(state.comments[commentKey] || "");
    label.htmlFor = textarea.id;

    textarea.addEventListener("input", () => {
      state.comments[commentKey] = textarea.value;
      persist();
    });

    section.append(label, textarea);
    return section;
  }

  function render() {
    const [start, end] = data.steps[step];
    const questions = data.questions.filter(
      (question) => question.id >= start && question.id <= end
    );

    document.querySelector("#step-label").textContent = `Étape ${step + 1}`;
    document.querySelector("#question-range").textContent =
      data.stepNames?.[step] || "Étape en cours";

    const indicator = document.querySelector("#step-indicator");
    indicator.replaceChildren(
      ...data.steps.map((_, index) => {
        const item = createElement(
          "li",
          index === step ? "active" : "",
          String(index + 1)
        );
        if (index === step) item.setAttribute("aria-current", "step");
        item.title = data.stepNames?.[index] || `Étape ${index + 1}`;
        return item;
      })
    );

    const fragment = document.createDocumentFragment();
    questions.forEach((question) => fragment.append(createQuestionCard(question)));
    fragment.append(createStepComment());
    list.replaceChildren(fragment);

    previous.hidden = step === 0;
    next.textContent = step === 3 ? "Voir mes résultats →" : "Suivant →";
    state.currentStep = step + 1;
    persist();
    updateProgress();
    message.hidden = true;
  }

  function updateProgress() {
    const completed = data.questions.filter((question) => {
      const answer = Number(state.answers[question.id]);
      return answer >= 1 && answer <= 5;
    }).length;
    const percent = Math.round((completed / totalQuestions) * 100);

    document.querySelector("#progress-percent").textContent = `${percent} %`;
    document.querySelector("#progress-bar").style.width = `${percent}%`;
    document
      .querySelector(".progress-track")
      .setAttribute("aria-valuenow", String(completed));
  }

  function showError(text) {
    const box = document.querySelector("#app-error");
    box.textContent = text;
    box.hidden = false;
  }

  form.addEventListener("change", (event) => {
    if (!event.target.matches('input[type="radio"]')) return;
    const id = event.target.name.replace("question-", "");
    state.answers[id] = Number(event.target.value);
    event.target.closest(".question-card").classList.remove("unanswered");
    persist();
    updateProgress();
  });

  previous.addEventListener("click", () => {
    if (step > 0) {
      step -= 1;
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const [start, end] = data.steps[step];
    const missing = [];

    for (let id = start; id <= end; id += 1) {
      if (!state.answers[id]) missing.push(id);
    }

    document.querySelectorAll(".question-card").forEach((card) => {
      card.classList.toggle(
        "unanswered",
        missing.includes(Number(card.dataset.question))
      );
    });

    if (missing.length) {
      message.hidden = false;
      document
        .querySelector(`[data-question="${missing[0]}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (step < 3) {
      step += 1;
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    try {
      state.results = FinasureCalcul.calculate(data, state.answers);
      state.questionnaireCompleted = true;
      state.completedAt = new Date().toISOString();
      persist();
      location.href = "resultats.html";
    } catch (error) {
      showError(error.message);
    }
  });

  render();
})();
