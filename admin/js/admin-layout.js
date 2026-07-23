(function () {
  "use strict";
  const items = [
    ["dashboard","index.html","Tableau de bord","⌂"],
    ["companies","entreprises.html","Entreprises","◇"],
    ["assessments","evaluations.html","Évaluations","✓"],
    ["reports","rapports.html","Rapports","▤"],
    ["appointments","rendez-vous.html","Rendez-vous","◫"],
    ["activity","historique.html","Historique","↻"],
    ["settings","parametres.html","Paramètres","⚙"]
  ];
  function mount(active, title, user) {
    const shell = document.querySelector("#admin-shell");
    shell.innerHTML = `<div class="sidebar-overlay"></div><aside class="admin-sidebar"><a class="admin-brand" href="index.html"><img src="../assets/logo-finasure.png" alt="Finasure"><span>ADMINISTRATION</span></a><nav class="admin-nav">${items.map(([key,url,label,icon])=>`<a href="${url}" class="${key===active?"active":""}"><span aria-hidden="true">${icon}</span>${label}</a>`).join("")}</nav></aside><div class="admin-main"><header class="admin-header"><div style="display:flex;align-items:center;gap:12px"><button class="menu-toggle" aria-label="Ouvrir le menu">☰</button><h1>${title}</h1></div><div class="admin-user"><span>${user.admin.display_name || user.session.user.email}</span><button id="logout" class="btn btn-light">Déconnexion</button></div></header><main id="admin-content" class="admin-content"></main></div>`;
    shell.querySelector(".menu-toggle").onclick=()=>document.body.classList.toggle("sidebar-open");
    shell.querySelector(".sidebar-overlay").onclick=()=>document.body.classList.remove("sidebar-open");
    shell.querySelector("#logout").onclick=()=>AdminAuth.logout();
    return shell.querySelector("#admin-content");
  }
  window.AdminLayout=Object.freeze({mount});
})();
