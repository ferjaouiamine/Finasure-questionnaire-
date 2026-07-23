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
  const deliveryStatus = document.querySelector("#report-delivery-status");
  const reportLoader = document.querySelector("#report-loader");
  const reportTitle = document.querySelector("#report-status-title");
  const reportMessage = document.querySelector("#report-status-message");
  const reportActions = document.querySelector("#report-status-actions");
  const retryReportButton = document.querySelector("#retry-report-email");
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
  function showVerifiedInterface() {
    form.hidden = true;
    document.querySelector(".otp-resend").hidden = true;
    document.querySelector(".otp-change-email").hidden = true;
    successBox.textContent = "Adresse email vérifiée avec succès.";
    successBox.hidden = false;
    deliveryStatus.hidden = false;
  }
  function setDeliveryState(title, message, options = {}) {
    reportTitle.textContent = title;
    reportMessage.textContent = message;
    reportLoader.hidden = !options.loading;
    reportActions.hidden = Boolean(options.loading);
    retryReportButton.hidden = !options.retry;
  }
  async function deliverReport(resend = false) {
    showVerifiedInterface();
    setDeliveryState(
      "Préparation de votre rapport...",
      "Nous générons votre PDF Finasure et préparons son envoi sécurisé.",
      { loading: true }
    );
    try {
      const result = await FinasureOtp.sendReport(state, { resend });
      state.reportEmailStatus = result.status || "sent";
      state.reportEmailMessage = result.message || "";
      FinasureStorage.save(state);
      if (result.status === "already_sent") {
        setDeliveryState(
          "Rapport déjà envoyé",
          "Votre rapport a déjà été envoyé à votre adresse email."
        );
      } else if (result.status === "processing") {
        setDeliveryState(
          "Rapport en cours de préparation",
          "La génération est déjà en cours. Patientez quelques instants puis actualisez cette page."
        );
      } else {
        setDeliveryState(
          "Votre rapport a été envoyé",
          "Votre rapport a été envoyé à votre adresse email."
        );
      }
    } catch (error) {
      state.reportEmailStatus = "failed";
      state.reportEmailMessage = error.message;
      FinasureStorage.save(state);
      const generationFailed = error.code === "pdf_generation_failed";
      setDeliveryState(
        generationFailed ? "PDF non généré" : "Envoi du rapport interrompu",
        generationFailed
          ? "Votre adresse email a été vérifiée, mais nous n’avons pas pu générer votre PDF. Vous pouvez consulter votre rapport en ligne."
          : "Votre rapport est prêt, mais l’envoi par email a rencontré un problème.",
        { retry: true }
      );
    }
  }
  document.querySelector("#otp-email").textContent = maskEmail(state.client.email);
  function adaptDigitSpacing() {
    const digitCount = Math.max(input.value.length, 1);
    const spacing = Math.max(0.08, Math.min(0.45, 3.2 / digitCount));
    input.style.setProperty("--otp-spacing", `${spacing}em`);
  }
  function normalizeMobileDigits(value) {
    return String(value || "")
      .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
      .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
      .replace(/\D/g, "");
  }
  input.addEventListener("input", () => {
    const normalized = normalizeMobileDigits(input.value);
    if (input.value !== normalized) input.value = normalized;
    errorBox.textContent = "";
    adaptDigitSpacing();
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
      await deliverReport(false);
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
  retryReportButton.addEventListener("click", () => deliverReport(true));

  async function restoreVerifiedState() {
    if (!state.emailVerified) return;
    if (!(await FinasureOtp.hasVerifiedAccess(state))) return;
    if (state.reportEmailStatus === "failed") {
      showVerifiedInterface();
      setDeliveryState(
        "Envoi du rapport interrompu",
        state.reportEmailMessage || "L’envoi par email a rencontré un problème.",
        { retry: true }
      );
      return;
    }
    await deliverReport(false);
  }
  startCountdown();
  adaptDigitSpacing();
  input.focus();
  restoreVerifiedState();
})();
