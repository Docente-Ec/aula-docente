Modulos.usuarios = {
  async render(el) {
    const s = Nube.sesion();
    if (!s || s.rol !== "admin") {
      el.innerHTML = `<h1>Usuarios</h1><p class="sub">Solo para administradores.</p>`;
      return;
    }
    el.innerHTML = `<h1>Usuarios</h1><p class="sub">Cargando…</p>`;
    let docentes, cuenta = {};
    try {
      docentes = (await Nube.rest("perfiles?select=id,correo,rol&order=correo.asc")).filter(p => p.rol === "docente");
      (await Nube.rest("datos?select=user_id,clave,valor&clave=in.(cursos,estudiantes)")).forEach(f => {
        (cuenta[f.user_id] ||= {})[f.clave] = Array.isArray(f.valor) ? f.valor.length : 0;
      });
    } catch {
      if (location.hash === "#usuarios") el.innerHTML = `<h1>Usuarios</h1><p class="sub">No se pudo cargar la lista. Revisa tu conexión.</p>`;
      return;
    }
    if (location.hash !== "#usuarios") return;
    const actual = Nube.sesion().viendo;
    el.innerHTML = `
      <h1>Usuarios</h1>
      <p class="sub">Elige un docente para ver sus datos en modo solo lectura.</p>
      <div class="card tabla-wrap"><table class="tabla">
        <thead><tr><th>Docente</th><th class="c">Cursos</th><th class="c">Estudiantes</th><th></th></tr></thead>
        <tbody>${docentes.map(d => `<tr data-id="${d.id}" data-correo="${esc(d.correo)}">
          <td>${esc(d.correo)}${actual && actual.id === d.id ? ' <span class="tag">Viendo</span>' : ""}</td>
          <td class="c">${(cuenta[d.id] || {}).cursos || 0}</td>
          <td class="c">${(cuenta[d.id] || {}).estudiantes || 0}</td>
          <td class="der"><button class="btn-sec" data-ver>Ver datos</button></td></tr>`).join("")
          || `<tr><td colspan="4" class="sub">No hay docentes registrados.</td></tr>`}
        </tbody></table></div>`;

    el.onclick = async e => {
      const b = e.target.closest("[data-ver]");
      if (!b) return;
      const tr = b.closest("tr");
      b.disabled = true; b.textContent = "Cargando…";
      try {
        await Nube.ver({ id: tr.dataset.id, correo: tr.dataset.correo });
        Auth.interfaz();
        if (location.hash === "#panel") rutear(); else location.hash = "panel";
      } catch {
        b.disabled = false; b.textContent = "Ver datos";
        alert("No se pudieron cargar los datos.");
      }
    };
  }
};