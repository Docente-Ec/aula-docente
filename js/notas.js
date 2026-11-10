const fmt = n => n === null ? "—" : n.toFixed(1).replace(".", ",");
const estado = (p, min) => p === null ? "" :
  p >= min ? '<span class="tag">Aprobado</span>' : '<span class="tag w">En riesgo</span>';

const Notas = {
  actividades() { return Storage.leer("actividades", []); },
  guardarActs(l) { Storage.guardar("actividades", l); },
  mapa() { return Storage.leer("notas", {}); },       // { actividadId: { estudianteId: nota } }
  guardarMapa(m) { Storage.guardar("notas", m); },
  // Cada actividad se convierte a la escala y todas pesan igual
  promedio(alumnoId, acts, mapa, escala) {
    const v = acts.map(a => {
      const n = (mapa[a.id] || {})[alumnoId];
      return n === undefined ? null : n / a.sobre;
    }).filter(x => x !== null);
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length * escala : null;
  }
};

Modulos.notas = {
  sel: {},
  render(el) {
    const cfg = Config.obtener();
    const cursos = Cursos.todos();
    const s = this.sel;
    if (!cursos.length) {
      el.innerHTML = `<h1>Calificaciones</h1><p class="sub">Primero crea un curso y sus asignaturas.</p>`;
      return;
    }

    const actsActuales = () => Notas.actividades()
      .filter(a => a.cursoId === s.curso && a.asigId === s.asig && a.per === s.per);

    const resumen = () => {
      const acts = actsActuales(), mapa = Notas.mapa();
      let suma = 0, n = 0;
      el.querySelectorAll("tr[data-al]").forEach(tr => {
        const p = Notas.promedio(tr.dataset.al, acts, mapa, cfg.escalaMaxima);
        tr.querySelector(".prom").textContent = fmt(p);
        tr.querySelector(".est").innerHTML = estado(p, cfg.notaMinima);
        if (p !== null) { suma += p; n++; }
      });
      const g = el.querySelector("#nGeneral");
      if (g) g.textContent = "Promedio del curso: " + fmt(n ? suma / n : null);
    };

    const pintar = () => {
      if (!cursos.some(c => c.id === s.curso)) { s.curso = cursos[0].id; s.asig = null; }
      const curso = cursos.find(c => c.id === s.curso);
      if (!curso.asignaturas.some(a => a.id === s.asig)) s.asig = curso.asignaturas[0]?.id || null;
      if (!(s.per >= 0 && s.per < cfg.periodos.length)) s.per = 0;

      const cabecera = `
        <h1>Calificaciones</h1>
        <p class="sub">Escala sobre ${cfg.escalaMaxima} · se aprueba con ${cfg.notaMinima}</p>
        <div class="fila" style="flex-wrap:wrap">
          <select id="nCurso">${cursos.map(c => `<option value="${c.id}" ${c.id === s.curso ? "selected" : ""}>${esc(c.nombre)}</option>`).join("")}</select>
          <select id="nAsig">${curso.asignaturas.map(a => `<option value="${a.id}" ${a.id === s.asig ? "selected" : ""}>${esc(a.nombre)}</option>`).join("")}</select>
          <select id="nPer">${cfg.periodos.map((p, i) => `<option value="${i}" ${i === s.per ? "selected" : ""}>${esc(p)}</option>`).join("")}</select>
        </div>`;

      if (!s.asig) {
        el.innerHTML = cabecera + `<p class="sub" style="margin-top:20px">Este curso no tiene asignaturas. Agrégalas en el módulo Cursos.</p>`;
        return;
      }

      const alumnos = Estudiantes.deCurso(s.curso);
      const acts = actsActuales(), mapa = Notas.mapa();
      el.innerHTML = cabecera + `
        <div class="card fila">
          <input id="nNombre" placeholder="Nueva actividad (Ej: Lección 1)" maxlength="40">
          <input id="nSobre" type="number" min="1" value="${cfg.escalaMaxima}" style="max-width:100px;flex:none" aria-label="Calificación sobre">
          <button class="btn" id="nAgregar">Agregar actividad</button>
        </div>
        <p class="sub" id="nGeneral" style="margin-top:16px"></p>
        <div class="card tabla-wrap" style="margin-top:8px">
          <table class="tabla">
            <thead><tr><th>Estudiante</th>
              ${acts.map(a => `<th class="c">${esc(a.nombre)}<div class="mut">sobre ${a.sobre}
                <button class="x" data-del="${a.id}" aria-label="Eliminar ${esc(a.nombre)}">×</button></div></th>`).join("")}
              <th class="c">Promedio</th><th>Estado</th></tr></thead>
            <tbody>
              ${alumnos.map(al => `<tr data-al="${al.id}"><td>${esc(al.nombre)}</td>
                ${acts.map(a => `<td class="c"><input class="nota" type="number" min="0" max="${a.sobre}" step="0.01"
                  data-act="${a.id}" value="${(mapa[a.id] || {})[al.id] ?? ""}"></td>`).join("")}
                <td class="c"><b class="prom"></b></td><td class="est"></td></tr>`).join("")
                || `<tr><td class="sub">No hay estudiantes en este curso.</td></tr>`}
            </tbody>
          </table>
        </div>`;
      resumen();
    };
    pintar();

    el.onchange = e => {
      const t = e.target;
      if (t.id === "nCurso") { s.curso = t.value; s.asig = null; pintar(); }
      else if (t.id === "nAsig") { s.asig = t.value; pintar(); }
      else if (t.id === "nPer") { s.per = Number(t.value); pintar(); }
      else if (t.classList.contains("nota")) {
        const act = t.dataset.act, al = t.closest("tr").dataset.al;
        const mapa = Notas.mapa();
        const v = t.value === "" ? null : Number(t.value);
        const sobre = Number(t.max);
        if (v !== null && (v < 0 || v > sobre)) {
          t.value = (mapa[act] || {})[al] ?? "";
          alert(`La nota debe estar entre 0 y ${sobre}.`);
          return;
        }
        mapa[act] = mapa[act] || {};
        if (v === null) delete mapa[act][al]; else mapa[act][al] = v;
        Notas.guardarMapa(mapa);
        resumen();
      }
    };

    el.onclick = e => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.id === "nAgregar") {
        const nombre = el.querySelector("#nNombre").value.trim();
        const sobre = Number(el.querySelector("#nSobre").value);
        if (!nombre || !(sobre > 0)) return;
        const l = Notas.actividades();
        l.push({ id: Storage.nuevoId(), cursoId: s.curso, asigId: s.asig, per: s.per, nombre, sobre });
        Notas.guardarActs(l);
        pintar();
      } else if (b.dataset.del) {
        if (!confirm("¿Eliminar esta actividad y sus notas?")) return;
        Notas.guardarActs(Notas.actividades().filter(a => a.id !== b.dataset.del));
        const m = Notas.mapa(); delete m[b.dataset.del]; Notas.guardarMapa(m);
        pintar();
      }
    };

    el.onkeydown = e => {
      if (e.key === "Enter" && e.target.id === "nNombre") el.querySelector("#nAgregar").click();
    };
  }
};