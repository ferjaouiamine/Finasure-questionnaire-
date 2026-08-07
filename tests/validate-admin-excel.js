const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

let written;
const context = { console, Date, Map, Object, String, Number, Array };
context.window = context;
context.XLSX = {
  utils: {
    book_new: () => ({ SheetNames: [], Sheets: {} }),
    aoa_to_sheet: (rows) => ({ rows, "!ref": `A1:F${rows.length}` }),
    book_append_sheet: (book, sheet, name) => {
      book.SheetNames.push(name);
      book.Sheets[name] = sheet;
    },
    decode_range: () => ({ s: { r: 0, c: 0 }, e: { r: 11, c: 4 } }),
    encode_cell: ({ r, c }) => `${String.fromCharCode(65 + c)}${r + 1}`
  },
  writeFile: (book, filename) => { written = { book, filename }; }
};
vm.createContext(context);
for (const file of ["js/questionnaire-data.js", "admin/js/admin-excel.js"]) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, `../${file}`), "utf8"), context);
}

function assessment(company, date, answerOffset = 0) {
  return {
    id: `assessment-${company}`,
    completed_at: date,
    global_score: 3.25,
    global_level: "Établi",
    status: "completed",
    companies: { name: company },
    respondents: { first_name: "Alice", last_name: "Martin", email: "alice@example.com" },
    assessment_answers: context.FINASURE_ERM_DATA.questions.map((question, index) => ({
      question_id: question.id,
      question_text: question.text,
      answer_text: question.answers[(index + answerOffset) % 5].description,
      score: question.answers[(index + answerOffset) % 5].score,
      comment: index === 0 ? "Preuve disponible" : null
    })),
    dimension_scores: context.FINASURE_ERM_DATA.dimensions.map((dimension, index) => ({
      dimension_name: dimension.name,
      score: 2.5 + index / 10,
      level: "Établi"
    }))
  };
}

(async () => {
  const first = assessment("Finasure Conseil", "2026-08-07T10:00:00Z");
  const sheets = context.AdminExcel.buildSheets(first);
  assert.deepEqual(Object.keys(sheets), ["Synthese", "Reponses", "Scores"]);
  assert.equal(sheets.Reponses.length, 34);
  assert.equal(sheets.Scores.length, 12);
  assert.equal(sheets.Reponses[1][2], first.assessment_answers[0].question_text);
  assert.equal(sheets.Reponses[1][3], first.assessment_answers[0].answer_text);
  assert.equal(sheets.Reponses[1][5], "Preuve disponible");
  assert.ok(sheets.Reponses.flat().every((value) => !/undefined|null|\[object Object\]/.test(String(value))));
  assert.equal(context.AdminExcel.filename(first), "Evaluation_ERM_FINASURE_CONSEIL_2026-08-07.xlsx");

  await context.AdminExcel.exportAssessment(first);
  assert.deepEqual(written.book.SheetNames, ["Synthese", "Reponses", "Scores"]);
  assert.equal(written.filename, "Evaluation_ERM_FINASURE_CONSEIL_2026-08-07.xlsx");

  const second = assessment("Entreprise Deux", "2026-08-08T10:00:00Z", 1);
  const secondSheets = context.AdminExcel.buildSheets(second);
  assert.notEqual(secondSheets.Reponses[1][3], sheets.Reponses[1][3]);
  assert.equal(secondSheets.Synthese[1][1], "Entreprise Deux");
  assert.equal(context.AdminExcel.filename(second), "Evaluation_ERM_ENTREPRISE_DEUX_2026-08-08.xlsx");
  console.log("Validation réussie : export Excel admin, 3 feuilles et 2 évaluations.");
})();
