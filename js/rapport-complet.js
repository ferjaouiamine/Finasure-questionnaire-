(async function () {
  "use strict";
  const APPOINTMENT_URL = "rendez-vous.html";
  const data = window.FINASURE_ERM_DATA;
  const state = FinasureStorage.load();
  const complete = data?.questions?.every((question) => Number(state.answers[question.id]) >= 1 && Number(state.answers[question.id]) <= 5);
  const client = state.client || {};
  const clientValid = state.leadFormCompleted && client.consent && client.company && client.sector && client.workforce && client.firstName && client.lastName && client.jobTitle && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email || "");

  if (!complete || !state.questionnaireCompleted) {
    location.href = "questionnaire.html";
    return;
  }
  if (!Number.isFinite(Number(state.results?.globalScore))) {
    location.href = "resultats.html";
    return;
  }
  if (!clientValid) {
    location.href = "demande-rapport.html";
    return;
  }
  const locallyVerified =
    state.emailVerified &&
    String(state.verifiedEmail).toLowerCase() === String(client.email).toLowerCase();
  if (!locallyVerified || !(await window.FinasureOtp.hasVerifiedAccess(state))) {
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
      "report-company": client.company,
      "report-name": `${client.firstName} ${client.lastName}`,
      "report-client-company": client.company,
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
    document.querySelector("#global-score").textContent = results.displayGlobalScore.replace(".", ",");
    document.querySelector("#global-level").textContent = results.globalLevel;
    document.querySelector("#global-percentage").textContent = `${results.percentage} %`;
    document.querySelector("#global-interpretation").textContent = interpretation(results.globalScore);
    results.strengths.forEach((dimension) => document.querySelector("#strengths").append(rankCard(dimension, false)));
    results.priorities.forEach((dimension) => document.querySelector("#priorities").append(rankCard(dimension, true)));
    results.dimensions.forEach(renderDimension);
    renderComments();
    if (!FinasureChart.renderRadar(document.querySelector("#radar-chart"), results.dimensions)) document.querySelector("#chart-fallback").hidden = false;
  }

  function interpretation(score) {
    if (score <= 1.8) return "Le dispositif nécessite une structuration progressive et une formalisation des pratiques essentielles.";
    if (score <= 2.6) return "Plusieurs pratiques sont engagées, mais leur application et leur coordination doivent être renforcées.";
    if (score <= 3.4) return "Le dispositif est structuré et globalement appliqué, avec des améliorations ciblées possibles.";
    if (score <= 4.2) return "La gestion des risques est bien intégrée et soutient efficacement les décisions.";
    return "Le dispositif est pleinement intégré, piloté et continuellement amélioré.";
  }

  function rankCard(dimension, priority) {
    const card = element("article", "rank-card");
    card.append(element("h3", null, dimension.name), element("p", null, `${dimension.displayScore.replace(".", ",")} / 5 · ${dimension.level}`));
    if (priority) card.append(element("small", null, `Poids ${dimension.weight} % · Indice ${dimension.priorityIndex.toFixed(2)}`), element("p", null, dimension.recommendations[dimension.level]?.shortTerm || "Recommandation non disponible."));
    else card.append(element("p", null, "Une base solide sur laquelle capitaliser pour renforcer le dispositif global."));
    return card;
  }

  function renderDimension(dimension) {
    const card = element("article", "dimension-card"), top = element("div", "dimension-top"), bar = element("div", "dimension-bar"), fill = element("i");
    top.append(element("h3", null, dimension.name), element("strong", "score-badge", `${dimension.displayScore.replace(".", ",")} / 5`));
    fill.style.width = `${dimension.score / 5 * 100}%`; bar.append(fill); card.append(top, element("p", null, `${dimension.level} · Poids ${dimension.weight} %`), bar); document.querySelector("#dimension-list").append(card);
    const recommendation = dimension.recommendations[dimension.level], item = element("article", "accordion"), button = element("button", "accordion-button"), panel = element("div", "accordion-panel"), icon = element("span", null, "+");
    button.type = "button"; button.id = `rec-button-${dimension.id}`; button.setAttribute("aria-expanded", "false"); button.setAttribute("aria-controls", `rec-panel-${dimension.id}`); button.append(element("span", null, `${dimension.name} — ${dimension.displayScore.replace(".", ",")} / 5`), icon);
    panel.id = `rec-panel-${dimension.id}`; panel.hidden = true; panel.setAttribute("role", "region"); panel.setAttribute("aria-labelledby", button.id);
    [["Diagnostic", recommendation?.diagnostic], ["Actions à court terme", recommendation?.shortTerm], ["Actions à moyen terme", recommendation?.mediumTerm]].forEach(([title, text]) => panel.append(element("h3", null, title), element("p", null, text || "Recommandation non disponible.")));
    button.addEventListener("click", () => { const open = panel.hidden; panel.hidden = !open; button.setAttribute("aria-expanded", String(open)); icon.textContent = open ? "−" : "+"; });
    item.append(button, panel); document.querySelector("#recommendations").append(item);
  }

  function renderComments() {
    const comments = Object.entries(state.comments).filter(([, value]) => String(value).trim());
    if (!comments.length) return;
    const container = document.querySelector("#comments-list");
    comments.forEach(([key, value]) => {
      const match = /^step-(\d+)$/.exec(key), article = element("article", "comment-result");
      const title = match ? `Étape ${match[1]} · ${data.stepNames?.[Number(match[1]) - 1] || "Commentaire"}` : `Commentaire ${key}`;
      article.append(element("h3", null, title), element("p", null, String(value))); container.append(article);
    });
    document.querySelector("#comments-section").hidden = false;
  }

  document.querySelector("#print-report-button").addEventListener("click", () => {
    window.FinasureAssessmentSync?.recordReportDownload(state);
    const panels = [...document.querySelectorAll(".accordion-panel")], states = panels.map((panel) => panel.hidden);
    panels.forEach((panel) => { panel.hidden = false; });
    const restore = () => panels.forEach((panel, index) => { panel.hidden = states[index]; });
    window.addEventListener("afterprint", restore, { once: true });
    window.print();
  });
  document.querySelector("#appointment-button").addEventListener("click", () => { location.href = APPOINTMENT_URL; });
})();
