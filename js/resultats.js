(function () {
  "use strict";
  const data = window.FINASURE_ERM_DATA;
  const state = FinasureStorage.load();
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

    document.querySelector("#result-date").textContent = new Date(state.completedAt).toLocaleDateString("fr-FR");
    document.querySelector("#global-score").textContent = results.displayGlobalScore.replace(".", ",");
    document.querySelector("#global-level").textContent = results.globalLevel;
    document.querySelector("#global-percentage").textContent = `${results.percentage} %`;
    document.querySelector("#global-interpretation").textContent = interpretation(results.globalScore);

    if (!FinasureChart.renderRadar(document.querySelector("#radar-chart"), results.dimensions)) {
      document.querySelector("#chart-fallback").hidden = false;
    }
  } catch (error) {
    const box = document.querySelector("#results-error");
    box.textContent = error.message;
    box.hidden = false;
  }

  function interpretation(score) {
    if (score <= 1.8) return "Votre dispositif nécessite une structuration progressive de ses pratiques essentielles.";
    if (score <= 2.6) return "Plusieurs pratiques sont engagées, mais leur application doit encore être renforcée.";
    if (score <= 3.4) return "Votre dispositif est structuré et dispose de possibilités d’amélioration ciblées.";
    if (score <= 4.2) return "La gestion des risques est bien intégrée et soutient efficacement les décisions.";
    return "Votre dispositif est pleinement intégré, piloté et continuellement amélioré.";
  }
})();
