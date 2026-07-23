(function () {
  "use strict";
  const state = FinasureStorage.load();
  const form = document.querySelector("#otp-form");
  const input = document.querySelector("#otp-code");
  const errorBox = document.querySelector("#otp-error");
  const successBox = document.querySelector("#otp-success");
  const submitButton = document.querySelector("#otp-submit");
  const resendButton = document.querySelector("#otp-resend");
  const countdown = document.querySelector("#otp-countdown");
  let timer;

  if (!state.questionnaireCompleted || !state.leadFormCompleted || !state.client?.email) {
    location.replace("demande-rapport.html");
    return;
  }
  function maskEmail(email) {
    const [name, domain] = String(email).split("@");
    const visible = name.slice(0, Math.min(2, name.length));
    return `${visible}${"•".repeat(Math.max(3, name.length - visible.length))}@${domain}`;
  }
  function secondsUntilResend() {
    const sentAt = new Date(state.otpSentAt || 0).getTime();
    return Math.max(0, Math.ceil((sentAt + FinasureOtp.RESEND_DELAY_SECONDS * 1000 - Date.now()) / 1000));
  }
  function startCountdown() {
    clearInterval(timer);
    const render = () => {
      const seconds = secondsUntilResend();
      resendButton.disabled = seconds > 0;
      countdown.textContent = seconds > 0 ? `Nouveau code disponible dans ${seconds} s` : "Vous pouvez demander un nouveau code.";
      if (!seconds) clearInterval(timer);
    };
    render();
    timer = setInterval(render, 1000);
  }
  document.querySelector("#otp-email").textContent = maskEmail(state.client.email);
  input.addEventListener("beforeinput", (event) => {
    if (event.data !== null && !/^\d+$/.test(event.data)) event.preventDefault();
  });
  input.addEventListener("paste", (event) => {
    const pasted = event.clipboardData?.getData("text") || "";
    if (!/^\d+$/.test(pasted)) {
      event.preventDefault();
      errorBox.textContent = "Le code doit contenir uniquement des chiffres.";
    }
  });
  input.addEventListener("input", () => {
    errorBox.textContent = "";
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.textContent = "";
    successBox.hidden = true;
    submitButton.disabled = true;
    submitButton.textContent = "Vérification en cours…";
    try {
      const user = await FinasureOtp.verifyCode(state.client.email, input.value);
      if (String(user.email).toLowerCase() !== String(state.client.email).toLowerCase()) throw new Error("L’adresse vérifiée ne correspond pas à votre demande.");
      await FinasureOtp.markAssessmentVerified(state);
      state.emailVerified = true;
      state.emailVerifiedAt = new Date().toISOString();
      state.verifiedEmail = String(user.email).toLowerCase();
      FinasureStorage.save(state);
      successBox.textContent = "Adresse vérifiée. Ouverture de votre rapport…";
      successBox.hidden = false;
      setTimeout(() => location.replace("rapport-complet.html"), 500);
    } catch (error) {
      errorBox.textContent = error.message || "Le code est incorrect ou a expiré.";
      input.focus();
      input.select();
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Vérifier et accéder au rapport";
    }
  });
  resendButton.addEventListener("click", async () => {
    if (secondsUntilResend() > 0) return;
    errorBox.textContent = "";
    resendButton.disabled = true;
    try {
      await FinasureOtp.sendCode(state.client.email);
      state.otpSentAt = new Date().toISOString();
      FinasureStorage.save(state);
      successBox.textContent = "Un nouveau code vient de vous être envoyé.";
      successBox.hidden = false;
      startCountdown();
    } catch (error) {
      errorBox.textContent = error.message || "Impossible de renvoyer le code.";
      resendButton.disabled = false;
    }
  });
  startCountdown();
  input.focus();
})();
