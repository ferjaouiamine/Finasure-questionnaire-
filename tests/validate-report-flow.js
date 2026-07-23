const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const storage = new Map();
let assessmentPayload;
let recommendationPayload;
const context = {
  console,
  crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000001" },
  localStorage: {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key)
  },
  window: {}
};
context.window = context;
context.FinasureSupabase = {
  configured: true,
  client: {
    async rpc(name, args) {
      if (name === "submit_assessment") {
        assessmentPayload = args.p_payload;
        return {
          data: {
            assessment_id: "11111111-1111-4111-8111-111111111111",
            public_access_token: "22222222-2222-4222-8222-222222222222"
          },
          error: null
        };
      }
      if (name === "save_assessment_recommendations") {
        recommendationPayload = args.p_recommendations;
        return { data: true, error: null };
      }
      throw new Error(`RPC inattendue: ${name}`);
    }
  }
};
vm.createContext(context);
for (const file of ["questionnaire-data.js", "storage.js", "calcul.js", "assessment-sync.js"]) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, `../js/${file}`), "utf8"), context);
}

(async () => {
  const data = context.FINASURE_ERM_DATA;
  const state = context.FinasureStorage.empty();
  state.answers = Object.fromEntries(data.questions.map((question) => [question.id, 3]));
  state.client = {
    firstName: "Test", lastName: "Finasure", company: "Entreprise Test",
    sector: "Services", workforce: "11 à 49", jobTitle: "Risk manager",
    email: "test@example.com", phone: "", scope: "", consent: true
  };
  state.questionnaireCompleted = true;
  state.completedAt = new Date().toISOString();
  const result = await context.FinasureAssessmentSync.syncAssessment(state, {
    reportRequested: true
  });
  if (!result.synced) throw new Error("Synchronisation de test échouée.");
  if (assessmentPayload.answers.length !== 33) throw new Error("Réponses incomplètes.");
  if (assessmentPayload.dimensions.length !== 11) throw new Error("Dimensions incomplètes.");
  if (recommendationPayload.length !== 11) throw new Error("Recommandations incomplètes.");
  if (recommendationPayload.filter((item) => item.is_strength).length !== 3) throw new Error("Forces incorrectes.");
  if (recommendationPayload.filter((item) => item.is_priority).length !== 3) throw new Error("Priorités incorrectes.");

  const edge = fs.readFileSync(
    path.resolve(__dirname, "../supabase/functions/send-erm-report/index.ts"),
    "utf8"
  );
  for (const required of [
    "auth.getUser", "respondent.auth_user_id !== userData.user.id",
    'report.status === "sent" && !body.resend',
    '"Idempotency-Key"', '"assessment_access_denied"'
  ]) {
    if (!edge.includes(required)) throw new Error(`Contrôle backend absent: ${required}`);
  }
  console.log("Contrat rapport validé : données réelles, ownership et idempotence.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
