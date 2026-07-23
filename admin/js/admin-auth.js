(function () {
  "use strict";
  const api = window.FinasureSupabase;

  async function login(email, password) {
    if (!api?.configured) throw new Error(api?.configurationMessage);
    const { data, error } = await api.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const { data: admin, error: adminError } = await api.client
      .from("admin_users").select("user_id,display_name").eq("user_id", data.user.id).maybeSingle();
    if (adminError || !admin) {
      await api.client.auth.signOut();
      throw new Error("Ce compte ne dispose pas d'un accès administrateur.");
    }
    return data;
  }

  async function guard() {
    if (!api?.configured) {
      location.replace("login.html?configuration=required");
      return null;
    }
    const { data: { session } } = await api.client.auth.getSession();
    if (!session) {
      location.replace(`login.html?next=${encodeURIComponent(location.pathname.split("/").pop())}`);
      return null;
    }
    const { data: admin } = await api.client.from("admin_users")
      .select("display_name").eq("user_id", session.user.id).maybeSingle();
    if (!admin) {
      await api.client.auth.signOut();
      location.replace("login.html?access=denied");
      return null;
    }
    return { session, admin };
  }

  async function logout() {
    await api?.client?.auth.signOut();
    location.replace("login.html");
  }

  window.AdminAuth = Object.freeze({ login, guard, logout });
})();
