const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

let received;
const context = {
  window: {
    FinasureSupabase: {
      configured: true,
      client: {
        auth: {
          async verifyOtp(payload) {
            received = payload;
            return { data: { user: { email: payload.email } }, error: null };
          }
        }
      }
    }
  }
};
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.resolve(__dirname, "../js/otp-auth.js"), "utf8"),
  context
);

(async () => {
  const example = "74343665";
  await context.window.FinasureOtp.verifyCode("test@example.com", example);
  if (received.token !== example) {
    throw new Error(`Token OTP modifié : ${received.token}`);
  }
  if (received.type !== "email") {
    throw new Error("Type verifyOtp incorrect.");
  }
  console.log(`OTP transmis sans modification : ${received.token}`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
