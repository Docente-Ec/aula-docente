const Auth = {
  html() {
    const ico = d => `<svg class="lg-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
    const mail = ico('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>');
    const lock = ico('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>');
    const ojo = ico('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>');
    const cap = ico('<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/>');
    const carpeta = ico('<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>');
    const cal = ico('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>');
    const cubo = `<svg width="34" height="34" viewBox="0 0 32 32"><path d="M16 2l12 7-12 7-12-7z" fill="#60a5fa"/><path d="M4 9l12 7v14L4 23z" fill="#1e56c8"/><path d="M28 9l-12 7v14l12-7z" fill="#f59e0b"/></svg>`;
    const aula = `<svg viewBox="0 0 520 340" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Pizarra, libros y manzana sobre un escritorio">
      <circle cx="440" cy="50" r="34" fill="#fbbf24" opacity=".9"/>
      <rect x="50" y="30" width="420" height="215" rx="10" fill="#14532d" stroke="#b45309" stroke-width="10"/>
      <text x="90" y="105" fill="#fff" font-size="34" font-family="Georgia, serif" font-style="italic">¡Hola, clase!</text>
      <path d="M90 140h160M90 170h120" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>
      <path d="M310 205l45-65 45 65z" fill="none" stroke="#fde68a" stroke-width="3" stroke-linejoin="round"/>
      <rect x="90" y="285" width="340" height="14" rx="4" fill="#f59e0b"/>
      <rect x="110" y="299" width="10" height="36" fill="#d97706"/><rect x="400" y="299" width="10" height="36" fill="#d97706"/>
      <rect x="130" y="262" width="100" height="23" rx="2" fill="#1e56c8"/>
      <rect x="136" y="241" width="88" height="21" rx="2" fill="#60a5fa"/>
      <rect x="132" y="222" width="94" height="19" rx="2" fill="#f59e0b"/>
      <rect x="250" y="277" width="62" height="8" fill="#fde047"/><path d="M312 277l14 4-14 4z" fill="#fcd9a8"/><rect x="242" y="277" width="8" height="8" fill="#f472b6"/>
      <circle cx="370" cy="265" r="20" fill="#dc2626"/><path d="M370 245c8-10 18-8 20-6-4 8-12 10-20 6z" fill="#16a34a"/>
    </svg>`;
    const campo = (id, etiqueta, tipo, ph, icono, auto, conOjo) => `
      <label class="lg-lbl" for="${id}">${etiqueta}</label>
      <div class="lg-campo">${icono}
        <input id="${id}" type="${tipo}" placeholder="${ph}" autocomplete="${auto}" ${conOjo ? 'class="con-ojo"' : ""}>
        ${conOjo ? `<button type="button" class="lg-ojo" data-ojo aria-label="Mostrar u ocultar contraseña">${ojo}</button>` : ""}
      </div>`;
    return `
      <section class="lg-izq">
        <div><h1>DocenteEC</h1><p class="lg-lema">Tu aula, organizada y al día</p></div>
        <div class="lg-arte">${aula}</div>
        <p class="lg-pie">Calificaciones, asistencia y planificaciones en un solo lugar.</p>
      </section>
      <section class="lg-der"><div class="lg-caja">
        <div class="lg-marca">${cubo}<span>Docente<b>EC</b></span></div>
        <h2>Bienvenido de nuevo</h2>
        <p class="lg-sub">Ingresa a tu cuenta para continuar gestionando tu aula</p>
        <form id="lgForm" novalidate>
          ${campo("lgCorreo", "Correo", "email", "tu@correo.com", mail, "email")}
          ${campo("lgClave", "Contraseña", "password", "Tu contraseña", lock, "current-password", true)}
          <div class="lg-fila"><label class="lg-rec"><input type="checkbox" id="lgRec"> Recordarme</label>
            <button type="button" class="lg-link" id="lgOlvido">¿Olvidaste tu contraseña?</button></div>
          <p class="lg-error" id="lgError" role="alert"></p>
          <button class="lg-entrar" type="submit">Entrar</button>
        </form>
        <div class="lg-feats">
          <div class="lg-feat"><span class="or">${cap}</span><b>Calificaciones</b><small>Promedios y reportes</small></div>
          <div class="lg-feat"><span class="az">${carpeta}</span><b>Planificaciones</b><small>Con tu formato</small></div>
          <div class="lg-feat"><span class="or">${cal}</span><b>Asistencia</b><small>Registro diario</small></div>
        </div>
      </div></section>`;
  },

  mostrar() {
    document.getElementById("login")?.remove();
    const el = document.createElement("div");
    el.id = "login";
    el.innerHTML = this.html();
    document.body.appendChild(el);
    document.body.classList.add("sin-sesion");
    this.enlazar(el);
  },

  enlazar(el) {
    el.addEventListener("click", e => {
      const o = e.target.closest("[data-ojo]");
      if (o) {
        const i = o.parentElement.querySelector("input");
        i.type = i.type === "password" ? "text" : "password";
        return;
      }
      if (e.target.closest("#lgOlvido"))
        el.querySelector("#lgError").textContent = "Para recuperar tu contraseña, contacta al administrador.";
    });

    el.querySelector("#lgForm").addEventListener("submit", async e => {
      e.preventDefault();
      const error = txt => { el.querySelector("#lgError").textContent = txt; };
      const correo = el.querySelector("#lgCorreo").value.trim();
      const clave = el.querySelector("#lgClave").value;
      if (!/^\S+@\S+\.\S+$/.test(correo)) return error("Escribe un correo válido.");
      if (!clave) return error("Escribe tu contraseña.");
      const btn = el.querySelector(".lg-entrar");
      btn.disabled = true; btn.textContent = "Entrando…"; error("");
      try {
        const s = await Nube.entrar(correo, clave, el.querySelector("#lgRec").checked);
        await Nube.prepararDatos(s);
        this.abrir();
      } catch (err) {
        Nube.quitarSesion();
        error(err.claro ? err.message : "No se pudo conectar. Revisa tu conexión e intenta de nuevo.");
        btn.disabled = false; btn.textContent = "Entrar";
      }
    });
  },

  // Ajusta el menú y el aviso según el rol
  interfaz() {
    const s = Nube.sesion();
    document.querySelector('#menu [data-modulo="usuarios"]')?.remove();
    document.getElementById("avisoLectura")?.remove();
    if (!s || s.rol !== "admin") return;
    const b = document.createElement("button");
    b.className = "nav"; b.dataset.modulo = "usuarios"; b.innerHTML = "<i></i>Usuarios";
    document.getElementById("menu").prepend(b);
    if (s.viendo) {
      const a = document.createElement("div");
      a.id = "avisoLectura";
      a.style.cssText = "margin:8px 12px;padding:8px 10px;border-radius:8px;background:#fef3c7;color:#92400e;font-size:13px";
      a.textContent = "Solo lectura · " + s.viendo.correo;
      document.querySelector(".side .logo").after(a);
    }
  },

  abrir() {
    document.getElementById("login")?.remove();
    document.body.classList.remove("sin-sesion");
    this.interfaz();
    const admin = Nube.sesion().rol === "admin";
    if (admin && location.hash !== "#usuarios") location.hash = "usuarios";
    else rutear();
  },

  async salir() {
    if (!(await Nube.cerrar())) return;
    document.getElementById("vista").innerHTML = "";
    this.interfaz();
    this.mostrar();
  },

  async iniciar() {
    const s = Nube.sesion();
    if (!s) { if (!document.getElementById("login")) this.mostrar(); return; }
    try { await Nube.iniciar(); }
    catch (e) {
      if (e.message === "sesión vencida") { Nube.quitarSesion(); this.mostrar(); return; }
    }
    this.interfaz();
    if (s.rol === "admin" && !location.hash) location.hash = "usuarios";
    else rutear();
  }
};

localStorage.removeItem("docenteec-sesion");     // sesión de la versión de prueba
sessionStorage.removeItem("docenteec-sesion");
if (!Nube.sesion()) Auth.mostrar();

window.addEventListener("load", () => {
  const pie = document.querySelector(".side-foot");
  if (pie) {
    const b = document.createElement("button");
    b.className = "btn-sec";
    b.textContent = "Cerrar sesión";
    b.onclick = () => Auth.salir();
    pie.appendChild(b);
  }
  Auth.iniciar();
});