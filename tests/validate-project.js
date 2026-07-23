const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.join(root, "js/questionnaire-data.js"), "utf8"),
  context
);
vm.runInContext(
  fs.readFileSync(path.join(root, "js/calcul.js"), "utf8"),
  context
);

const data = context.window.FINASURE_ERM_DATA;
if (data.questions.length !== 33) throw new Error("Le questionnaire ne contient pas 33 questions.");
if (data.dimensions.length !== 11) throw new Error("Le questionnaire ne contient pas 11 dimensions.");
for (const question of data.questions) {
  if (question.answers.length !== 5) throw new Error(`Question ${question.id}: nombre de réponses invalide.`);
  if (new Set(question.answers.map((answer) => answer.description)).size !== 5) {
    throw new Error(`Question ${question.id}: réponses dupliquées.`);
  }
  if (question.answers.map((answer) => answer.score).join(",") !== "1,2,3,4,5") {
    throw new Error(`Question ${question.id}: scores invalides.`);
  }
}

for (const value of [1, 3, 5]) {
  const answers = Object.fromEntries(data.questions.map((question) => [question.id, value]));
  const result = context.window.FinasureCalcul.calculate(data, answers);
  if (Math.abs(result.globalScore - value) > 0.0001) throw new Error("Régression du calcul global.");
  if (result.dimensions.length !== 11) throw new Error("Régression des dimensions.");
}

const requiredAdminPages = [
  "login.html", "index.html", "entreprises.html", "entreprise.html",
  "evaluations.html", "evaluation.html", "rapports.html", "rendez-vous.html",
  "historique.html", "parametres.html"
];
for (const page of requiredAdminPages) {
  const html = fs.readFileSync(path.join(root, "admin", page), "utf8");
  if (!html.includes("supabase-client.js")) throw new Error(`${page}: client Supabase absent.`);
}

const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/202607230001_initial_erm_admin.sql"),
  "utf8"
);
for (const table of [
  "companies", "respondents", "assessments", "assessment_answers",
  "dimension_scores", "reports", "appointments", "activity_logs"
]) {
  if (!migration.includes(`public.${table}`)) throw new Error(`Table SQL absente: ${table}`);
}
if ((migration.match(/enable row level security/g) || []).length < 9) {
  throw new Error("RLS incomplète.");
}

console.log("Validation réussie : données, calculs, pages admin et migration.");
