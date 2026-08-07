(function () {
  "use strict";

  const clean = (value) => {
    if (value === null || value === undefined) return "";
    if (["string", "number", "boolean"].includes(typeof value)) return value;
    return "";
  };
  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : "";

  function questionDimensions() {
    const dimensions = new Map(
      (window.FINASURE_ERM_DATA?.dimensions || []).map((item) => [String(item.id), clean(item.name)])
    );
    return new Map(
      (window.FINASURE_ERM_DATA?.questions || []).map((question) => [
        Number(question.id), dimensions.get(String(question.dimensionId)) || ""
      ])
    );
  }

  function evaluationDate(value) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "" : parsed;
  }

  function buildSheets(assessment) {
    const dimensions = Array.isArray(assessment?.dimension_scores)
      ? [...assessment.dimension_scores].sort((a, b) => Number(a.id || 0) - Number(b.id || 0)) : [];
    const answers = Array.isArray(assessment?.assessment_answers)
      ? [...assessment.assessment_answers].sort((a, b) => Number(a.question_id) - Number(b.question_id)) : [];
    const respondent = assessment?.respondents || {};
    const company = assessment?.companies || {};
    const dimensionByQuestion = questionDimensions();
    return {
      Synthese: [
        ["Synthèse de l’évaluation ERM", ""],
        ["Entreprise", clean(company.name)],
        ["Répondant", `${clean(respondent.last_name)} ${clean(respondent.first_name)}`.trim()],
        ["Email", clean(respondent.email)],
        ["Date de l’évaluation", evaluationDate(assessment?.completed_at)],
        ["Score global", number(assessment?.global_score)],
        ["Niveau de maturité", clean(assessment?.global_level)],
        ["Statut", clean(assessment?.status)],
        [], ["Dimension", "Score", "Niveau"],
        ...dimensions.map((item) => [clean(item.dimension_name), number(item.score), clean(item.level)])
      ],
      Reponses: [
        ["N°", "Dimension", "Question", "Réponse sélectionnée", "Score", "Commentaire"],
        ...answers.map((item) => [
          number(item.question_id), dimensionByQuestion.get(Number(item.question_id)) || "",
          clean(item.question_text), clean(item.answer_text), number(item.score), clean(item.comment)
        ])
      ],
      Scores: [
        ["Dimension", "Score obtenu", "Score maximum", "Pourcentage", "Niveau de maturité"],
        ...dimensions.map((item) => {
          const obtained = number(item.score);
          return [clean(item.dimension_name), obtained, 5,
            typeof obtained === "number" ? obtained / 5 : "", clean(item.level)];
        })
      ]
    };
  }

  function applyLayout(sheet, name) {
    const widths = { Synthese: [30, 34, 22], Reponses: [7, 26, 65, 75, 10, 45], Scores: [32, 16, 17, 16, 24] };
    sheet["!cols"] = widths[name].map((wch) => ({ wch }));
    sheet["!autofilter"] = name === "Synthese"
      ? { ref: `A10:C${Math.max(10, Number(sheet["!ref"]?.match(/\d+$/)?.[0] || 10))}` }
      : { ref: sheet["!ref"] || "A1:A1" };
    if (name === "Synthese" && sheet.B5) sheet.B5.z = "dd/mm/yyyy";
    if (name === "Scores" && sheet["!ref"]) {
      const range = XLSX.utils.decode_range(sheet["!ref"]);
      for (let row = 1; row <= range.e.r; row += 1) {
        const cell = sheet[XLSX.utils.encode_cell({ r: row, c: 3 })];
        if (cell) cell.z = "0.00%";
      }
    }
  }

  function filename(assessment) {
    const company = String(assessment?.companies?.name || "Entreprise")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toUpperCase() || "ENTREPRISE";
    const parsed = new Date(assessment?.completed_at);
    const date = Number.isNaN(parsed.getTime()) ? new Date().toISOString().slice(0, 10) : parsed.toISOString().slice(0, 10);
    return `Evaluation_ERM_${company}_${date}.xlsx`;
  }

  async function exportAssessment(assessment) {
    if (!window.XLSX) throw new Error("La bibliothèque SheetJS est indisponible.");
    const workbook = XLSX.utils.book_new();
    Object.entries(buildSheets(assessment)).forEach(([name, rows]) => {
      const sheet = XLSX.utils.aoa_to_sheet(rows, { cellDates: true });
      applyLayout(sheet, name);
      XLSX.utils.book_append_sheet(workbook, sheet, name);
    });
    XLSX.writeFile(workbook, filename(assessment), { compression: true, cellDates: true });
  }

  window.AdminExcel = Object.freeze({ buildSheets, filename, exportAssessment });
})();
