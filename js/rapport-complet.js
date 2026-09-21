(async function () {
  "use strict";
  const APPOINTMENT_URL = "rendez-vous.html";
  const data = window.FINASURE_ERM_DATA;
  const maturity = window.FinasureMaturity;
  const state = FinasureStorage.load();
  const complete = data?.questions?.every((question) => Number(state.answers[question.id]) >= 1 && Number(state.answers[question.id]) <= 5);
  const client = state.client || {};
  const clientValid = state.leadFormCompleted && client.company && client.sector && client.workforce && client.firstName && client.lastName && client.jobTitle && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email || "");

  if (!complete || !state.questionnaireCompleted) {
    location.href = "questionnaire.html";
    return;
  }
  if (!Number.isFinite(Number(state.results?.globalScore))) {
    location.href = "resultats.html";
    return;
  }
  if (!clientValid) {
    location.href = "resultats.html";
    return;
  }
  const locallyVerified =
    state.emailVerified &&
    String(state.verifiedEmail).toLowerCase() === String(client.email).toLowerCase();
  const otpBypassForTesting =
    window.FINASURE_SUPABASE_CONFIG?.otpBypassForTesting === true;
  if (!otpBypassForTesting &&
      (!locallyVerified || !(await window.FinasureOtp.hasVerifiedAccess(state)))) {
    location.replace("verification-email.html");
    return;
  }

  let results;
  try {
    results = FinasureCalcul.calculate(data, state.answers);
    if (state.syncStatus !== "synced") {
      window.FinasureAssessmentSync?.syncAssessment(state, {
        reportRequested: true
      });
    }
    renderClient();
    renderResults();
  } catch (error) {
    const box = document.querySelector("#report-error");
    box.textContent = error.message;
    box.hidden = false;
    return;
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderClient() {
    const values = {
      "report-company": client.company || "Entreprise non renseignée",
      "report-name": `${client.firstName} ${client.lastName}`,
      "report-client-company": client.company || "Non renseignée",
      "report-sector": client.sector,
      "report-workforce": client.workforce,
      "report-job": client.jobTitle,
      "report-email": client.email,
      "report-phone": client.phone || "Non renseigné"
    };
    Object.entries(values).forEach(([id, value]) => { document.getElementById(id).textContent = String(value || ""); });
    document.querySelector("#report-date").textContent = new Date(state.completedAt).toLocaleDateString("fr-FR");
  }

  function renderResults() {
    const globalLevel = maturity.getMaturityLevel(results.globalScore);
    const globalResult = document.querySelector(".global-result");
    globalResult?.style.setProperty("--level-text", globalLevel.textColor);
    globalResult?.style.setProperty("--level-bg", globalLevel.backgroundColor);
    globalResult?.style.setProperty("--level-border", globalLevel.borderColor);
    document.querySelector("#global-score").textContent = results.displayGlobalScore.replace(".", ",");
    const globalLevelElement = document.querySelector("#global-level");
    if (globalLevel.key === "aspirational") {
      const scaleLink = element("a", "maturity-scale-link");
      scaleLink.href = "#maturity-scale-title";
      scaleLink.setAttribute("aria-label", "Aspirationnel — voir l’échelle de maturité");
      scaleLink.append("Aspirationnel ", element("sup", null, "*"));
      globalLevelElement.replaceChildren(scaleLink);
    } else {
      globalLevelElement.textContent = globalLevel.label;
    }
    document.querySelector("#global-interpretation").textContent = interpretation(results.globalScore);
    document.querySelector("#score-card-summary").textContent = interpretation(results.globalScore);
    document.querySelector("#global-next-step").textContent = globalLevel.nextStep;
    document.querySelector("#score-progress-bar").style.width = `${results.percentage}%`;
    renderMaturityScale(globalLevel);
    results.strengths.forEach((dimension) => document.querySelector("#strengths").append(rankCard(dimension, false)));
    results.priorities.forEach((dimension) => document.querySelector("#priorities").append(rankCard(dimension, true)));
    results.dimensions.forEach(renderDimension);
    renderMaturityGrid();
    if (!FinasureChart.renderRadar(document.querySelector("#radar-chart"), results.dimensions)) document.querySelector("#chart-fallback").hidden = false;
  }

  function interpretation(score) {
    return maturity.getMaturityLevel(score).interpretation;
  }

  function renderMaturityScale(level) {
    const score = Number(results.globalScore);
    const position = Math.min(100, Math.max(0, ((score - 1) / 4) * 100));
    const marker = document.querySelector("#maturity-scale-marker");
    marker.style.left = `${position}%`;
    marker.style.setProperty("--marker-color", level.textColor);
    document.querySelector("#maturity-scale-score").textContent = `${score.toFixed(2).replace(".", ",")} / 5`;
    document.querySelector(`[data-level="${level.key}"]`)?.classList.add("is-current");
    document.querySelector("#maturity-scale-summary").textContent = `Votre score de ${score.toFixed(2).replace(".", ",")} sur 5 vous situe au niveau ${level.label}.`;
  }

  function rankCard(dimension, priority) {
    const card = element("div", `rank-card${priority ? " is-priority" : " is-strength"}`);
    const level = maturity.getMaturityLevel(dimension.score);
    card.style.setProperty("--level-text", level.textColor);
    card.style.setProperty("--level-bg", level.backgroundColor);
    card.style.setProperty("--level-border", level.borderColor);
    card.append(
      element("h3", null, dimension.name),
      element("p", "rank-maturity-badge", `${dimension.displayScore.replace(".", ",")} / 5 · ${level.label}`)
    );
    if (priority) card.append(element("small", null, `Poids ${dimension.weight} % · Indice ${dimension.priorityIndex.toFixed(2)}`), element("p", null, dimension.recommendations[dimension.level]?.shortTerm || "Recommandation non disponible."));
    else card.append(element("p", null, "Une base solide sur laquelle capitaliser pour renforcer le dispositif global."));
    return card;
  }

  function renderDimension(dimension) {
    const level = maturity.getMaturityLevel(dimension.score);
    const card = element("article", "dimension-card maturity-card");
    const top = element("div", "dimension-top");
    const meta = element("div", "dimension-maturity-meta");
    const bar = element("div", "dimension-bar maturity-bar");
    const fill = element("i");
    card.style.setProperty("--level-text", level.textColor);
    card.style.setProperty("--level-bg", level.backgroundColor);
    card.style.setProperty("--level-border", level.borderColor);
    card.dataset.maturity = level.key;
    top.append(
      element("h3", null, dimension.name),
      element("strong", "score-badge maturity-score", `${dimension.displayScore.replace(".", ",")} / 5`)
    );
    meta.append(
      element("strong", "level-badge maturity-level-badge", level.label),
      element("span", null, `${Math.round((dimension.score / 5) * 100)} %`),
      element("span", null, `Poids ${dimension.weight} %`)
    );
    fill.style.width = `${(dimension.score / 5) * 100}%`;
    bar.append(fill);
    card.append(top, meta, bar);
    document.querySelector("#dimension-list").append(card);
    const recommendation = dimension.recommendations[dimension.level], item = element("article", "accordion"), button = element("button", "accordion-button"), panel = element("div", "accordion-panel"), icon = element("span", null, "+");
    button.type = "button"; button.id = `rec-button-${dimension.id}`; button.setAttribute("aria-expanded", "false"); button.setAttribute("aria-controls", `rec-panel-${dimension.id}`); button.append(element("span", null, `${dimension.name} — ${dimension.displayScore.replace(".", ",")} / 5`), icon);
    panel.id = `rec-panel-${dimension.id}`; panel.hidden = true; panel.setAttribute("role", "region"); panel.setAttribute("aria-labelledby", button.id);
    [["Diagnostic", recommendation?.diagnostic], ["Actions à court terme", recommendation?.shortTerm], ["Actions à moyen terme", recommendation?.mediumTerm]].forEach(([title, text]) => panel.append(element("h3", null, title), element("p", null, text || "Recommandation non disponible.")));
    button.addEventListener("click", () => { const open = panel.hidden; panel.hidden = !open; button.setAttribute("aria-expanded", String(open)); icon.textContent = open ? "−" : "+"; });
    item.append(button, panel); document.querySelector("#recommendations").append(item);
  }

  function renderMaturityGrid() {
    const container = document.querySelector("#maturity-grid");
    maturity.MATURITY_INTERPRETATION_GRID.forEach((level) => {
      const row = element("article", "maturity-grid-row");
      row.style.setProperty("--level-text", level.textColor);
      row.style.setProperty("--level-bg", level.backgroundColor);
      row.style.setProperty("--level-border", level.borderColor);
      const heading = element("div", "maturity-grid-heading");
      heading.append(
        element("span", "maturity-grid-dot"),
        element("strong", null, level.label),
        element("small", null, level.scoreRange)
      );
      row.append(
        heading,
        gridField("Interprétation", level.interpretation),
        gridField("Situation généralement observée", level.observedSituation),
        gridField("Priorité recommandée", level.recommendedPriority)
      );
      container.append(row);
    });
  }

  function gridField(label, value) {
    const field = element("div", "maturity-grid-field");
    field.append(element("strong", null, label), element("p", null, value));
    return field;
  }

  let requestInProgress = false;
  const requestButton = document.querySelector("#request-personalized-report-button");
  requestButton.addEventListener("click", async () => {
    if (requestInProgress) return;
    requestInProgress = true;
    requestButton.disabled = true;
    const label = requestButton.querySelector("span");
    const originalLabel = label.textContent;
    label.textContent = "Envoi de votre demande…";
    const errorBox = document.querySelector("#report-error");
    errorBox.hidden = true;

    try {
      const response = await window.FinasureReportRequest.request(state);
      state.personalizedReportRequested = true;
      state.personalizedReportRequestedAt = new Date().toISOString();
      state.personalizedReportNotificationSent = Boolean(response.notification_sent);
      window.FinasureStorage.save(state);
      location.href = "demande-rapport-confirmee.html";
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      requestInProgress = false;
      requestButton.disabled = false;
      label.textContent = originalLabel;
      errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
  document.querySelector("#appointment-button").addEventListener("click", () => { location.href = APPOINTMENT_URL; });
})();
