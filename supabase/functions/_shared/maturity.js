(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinasureMaturity = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MATURITY_LEVELS = [
    {
      key: "emergent",
      label: "Émergent",
      min: 1,
      maxInclusive: 1.499999,
      scoreRange: "0 à 12 %",
      textColor: "#B42318",
      backgroundColor: "#FEE4E2",
      borderColor: "#FDA29B",
      colorGroup: "red",
      interpretation: "Le dispositif est peu structuré ou principalement informel.",
      observedSituation: "Les pratiques reposent principalement sur des initiatives individuelles, avec peu de formalisation, de coordination et de pilotage.",
      recommendedPriority: "Action immédiate et structuration des fondamentaux."
    },
    {
      key: "progressing",
      label: "En progression",
      min: 1.5,
      maxInclusive: 2.499999,
      scoreRange: "13 à 37 %",
      textColor: "#B42318",
      backgroundColor: "#FEE4E2",
      borderColor: "#FDA29B",
      colorGroup: "red",
      interpretation: "Les premières pratiques sont mises en place, mais elles restent partielles, irrégulières ou limitées à certains périmètres.",
      observedSituation: "Des processus existent, mais ils ne sont pas encore appliqués de manière homogène dans toute l’organisation.",
      recommendedPriority: "Accélération de la structuration et harmonisation des pratiques."
    },
    {
      key: "established",
      label: "Établi",
      min: 2.5,
      maxInclusive: 3.499999,
      scoreRange: "38 à 62 %",
      textColor: "#B54708",
      backgroundColor: "#FEF0C7",
      borderColor: "#FEC84B",
      colorGroup: "orange",
      interpretation: "Le dispositif est structuré et appliqué sur les principaux périmètres de l’organisation.",
      observedSituation: "Les rôles, processus et outils sont définis, mais leur intégration dans les décisions et le pilotage peut encore être renforcée.",
      recommendedPriority: "Consolidation, intégration et amélioration du pilotage."
    },
    {
      key: "advanced",
      label: "Avancé",
      min: 3.5,
      maxInclusive: 4.499999,
      scoreRange: "63 à 87 %",
      textColor: "#027A48",
      backgroundColor: "#D1FADF",
      borderColor: "#6CE9A6",
      colorGroup: "green",
      interpretation: "Le dispositif est intégré aux mécanismes de pilotage et aux prises de décision.",
      observedSituation: "Les risques sont régulièrement examinés, suivis et pris en compte dans les arbitrages opérationnels et stratégiques.",
      recommendedPriority: "Maintien de la performance et optimisation continue."
    },
    {
      key: "aspirational",
      label: "Aspirationnel",
      min: 4.5,
      maxInclusive: 5,
      scoreRange: "88 à 100 %",
      textColor: "#027A48",
      backgroundColor: "#D1FADF",
      borderColor: "#6CE9A6",
      colorGroup: "green",
      interpretation: "Le dispositif est dynamique, anticipatif et inscrit dans une logique d’amélioration continue.",
      observedSituation: "L’organisation exploite les données, les scénarios et les signaux émergents pour anticiper les évolutions et renforcer sa résilience.",
      recommendedPriority: "Excellence, innovation et anticipation des risques émergents."
    }
  ].map(Object.freeze);

  function getMaturityLevel(score) {
    if (score === null || score === undefined || String(score).trim() === "") {
      throw new RangeError("Score invalide : valeur attendue entre 1 et 5.");
    }
    const value = Number(score);
    if (!Number.isFinite(value) || value < 1 || value > 5) {
      throw new RangeError("Score invalide : valeur attendue entre 1 et 5.");
    }
    const level = MATURITY_LEVELS.find((item) => {
      const aboveMinimum =
        item.min !== undefined ? value >= item.min : value > item.minExclusive;
      return aboveMinimum && value <= item.maxInclusive;
    });
    if (!level) throw new RangeError("Niveau de maturité introuvable.");
    return Object.freeze({ ...level, score: value });
  }

  return Object.freeze({
    MATURITY_LEVELS: Object.freeze(MATURITY_LEVELS),
    MATURITY_INTERPRETATION_GRID: Object.freeze(MATURITY_LEVELS),
    getMaturityLevel
  });
});
