const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const context = { console, Date, Object, String, Number, Array, setTimeout };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../admin/js/admin-word.js"), "utf8"), context);
const assessment = {
  completed_at: "2026-09-22T10:00:00Z", global_score: 3.41, global_level: "Établi",
  companies: { name: "Finasure Conseil" },
  respondents: { first_name: "Alice", last_name: "Martin" },
  dimension_scores: Array.from({length:11}, (_,i) => ({id:i+1, dimension_name:"Dimension "+(i+1), score:3, level:"Établi"})),
  assessment_answers: Array.from({length:22}, (_,i) => ({question_id:i+1, question_text:"Question "+(i+1), answer_text:"Partiellement", score:2, comment:""}))
};
const html = context.AdminWord.buildDocument(assessment);
assert.match(html, /Rapport d’évaluation de maturité ERM/);
assert.match(html, /3,41 \/ 5/);
assert.match(html, /Dimension 11/);
assert.match(html, /Question 22/);
assert.equal(context.AdminWord.filename(assessment), "Rapport_ERM_FINASURE_CONSEIL_2026-09-22.doc");
console.log("Validation réussie : export Word administrateur.");