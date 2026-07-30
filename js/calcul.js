(function () {
  "use strict";

  const maturity = window.FinasureMaturity;
  if (!maturity?.getMaturityLevel) {
    throw new Error("Configuration des niveaux de maturité absente.");
  }

  function getMaturityLevel(score) {
    return maturity.getMaturityLevel(score).label;
  }

  function calculate(data, answers) {
    if (!data?.questions?.length || !data?.dimensions?.length) {
      throw new Error("Données du questionnaire absentes.");
    }
    const valid = {};
    data.questions.forEach((question) => {
      const value = Number(answers[question.id]);
      if (!Number.isInteger(value) || value < 1 || value > 5) {
        throw new Error(`Réponse absente ou invalide pour la question ${question.id}.`);
      }
      valid[question.id] = value;
    });

    const dimensions = data.dimensions.map((dimension) => {
      const questions = data.questions.filter(
        (question) => question.dimensionId === dimension.id
      );
      if (!questions.length) throw new Error(`Aucune question pour ${dimension.name}.`);
      const score =
        questions.reduce((sum, question) => sum + valid[question.id], 0) /
        questions.length;
      return {
        ...dimension,
        score,
        displayScore: score.toFixed(2),
        level: getMaturityLevel(score),
        priorityIndex: (5 - score) * dimension.weight
      };
    });

    const weightSum = dimensions.reduce(
      (sum, dimension) => sum + dimension.weight,
      0
    );
    if (weightSum !== 100) {
      throw new Error(`Somme des pondérations invalide : ${weightSum} %.`);
    }
    const globalScore =
      dimensions.reduce(
        (sum, dimension) => sum + dimension.score * dimension.weight,
        0
      ) / weightSum;
    const ranked = (a, b) =>
      b.score - a.score || b.weight - a.weight || a.order - b.order;
    const priorityRank = (a, b) =>
      b.priorityIndex - a.priorityIndex ||
      b.weight - a.weight ||
      a.order - b.order;

    return {
      globalScore,
      displayGlobalScore: globalScore.toFixed(2),
      globalLevel: getMaturityLevel(globalScore),
      percentage: Math.round((globalScore / 5) * 100),
      dimensions,
      strengths: [...dimensions].sort(ranked).slice(0, 3),
      priorities: [...dimensions].sort(priorityRank).slice(0, 3)
    };
  }

  window.FinasureCalcul = Object.freeze({ getMaturityLevel, calculate });
})();
