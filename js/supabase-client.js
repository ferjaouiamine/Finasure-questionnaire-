(function () {
  "use strict";

  const config = window.FINASURE_SUPABASE_CONFIG || {};
  const configured =
    /^https:\/\/.+\.supabase\.co\/?$/.test(config.url || "") &&
    typeof config.publishableKey === "string" &&
    !config.publishableKey.startsWith("COLLER_ICI_");

  let client = null;
  if (configured && window.supabase?.createClient) {
    client = window.supabase.createClient(config.url, config.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }

  window.FinasureSupabase = Object.freeze({
    client,
    configured,
    configurationMessage: configured
      ? ""
      : "Supabase n'est pas encore configuré. Les données restent enregistrées localement."
  });
})();
