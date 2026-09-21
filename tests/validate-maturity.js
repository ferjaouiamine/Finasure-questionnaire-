const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const maturity = require("../supabase/functions/_shared/maturity.js");

const expected = [
  [1, "Émergent"], [1.49, "Émergent"],
  [1.5, "En progression"], [2, "En progression"], [2.49, "En progression"],
  [2.5, "Établi"], [3, "Établi"], [3.49, "Établi"],
  [3.5, "Avancé"], [4, "Avancé"], [4.49, "Avancé"],
  [4.5, "Aspirationnel"], [5, "Aspirationnel"]
];

for (const [score, label] of expected) {
  assert.equal(maturity.getMaturityLevel(score).label, label, `Seuil incorrect pour ${score}`);
}
for (const invalid of [0, 0.99, -1, 5.01, null, undefined, NaN, ""]) {
  assert.throws(() => maturity.getMaturityLevel(invalid), RangeError);
}

assert.equal(maturity.MATURITY_LEVELS.length, 5);
assert.deepEqual(
  maturity.MATURITY_LEVELS.map((level) => level.colorGroup),
  ["red", "red", "orange", "green", "green"]
);
for (const level of maturity.MATURITY_INTERPRETATION_GRID) {
  for (const field of [
    "label", "scoreRange", "interpretation", "observedSituation",
    "recommendedPriority", "textColor", "backgroundColor", "borderColor"
  ]) {
    assert.ok(level[field], `${level.label}: champ ${field} absent`);
    assert.ok(!/undefined|null|NaN/.test(String(level[field])), `${level.label}: valeur invalide`);
  }
}

const pdfSource = fs.readFileSync(
  path.resolve(__dirname, "../supabase/functions/send-erm-report/pdf.ts"),
  "utf8"
);
assert.match(pdfSource, /FinasureMaturity/);
assert.match(pdfSource, /Grille d.interprétation des niveaux de maturité/);
console.log("Validation réussie : seuils, couleurs et grille de maturité.");
