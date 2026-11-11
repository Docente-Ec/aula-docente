const fmt = n => n === null ? "—" : n.toFixed(1).replace(".", ",");
const fmtNota = n => n === undefined ? "—" : String(Math.round(n * 100) / 100).replace(".", ",");
const estado = (p, min) => p === null ? "" :
  p >= min ? '<span class="tag">Aprobado</span>' : '<span class="tag w">En riesgo</span>';

const Notas = {
  actividades() { return Storage.leer("actividades", []); },
  guardarActs(l) { Storage.guardar("actividades", l); },
  mapa() { return Storage.leer("notas", {}); },       // { actividadId: { estudianteId: nota } }
  guardarMapa(m) { Storage.guardar("notas", m); },

  // Nota de un estudiante en una actividad (en unidades de la actividad, o undefined si no hay)
  notaDe(a, alumnoId, mapa) {
    if (a.tipo !== "tareas") return (mapa[a.id] || {})[alumnoId];
    const ratios = [];
    Tareas.deGrupo(a.cursoId, a.asigId, a.per).forEach(t => {
      const n = (t.notas || {})[alumnoId];
      if (n !== undefined) ratios.push(n / t.sobre);
    });
    return ratios.length ? ratios.reduce((x, r) => x + r, 0) / ratios.length * a.sobre : undefined;
  },

  // Promedio ponderado: solo cuenta las actividades que ya tienen nota
  promedio(alumnoId, acts, mapa, escala) {
    let suma = 0, pesos = 0;
    acts.forEach(a => {
      const n = this.notaDe(a, alumnoId, mapa);
      if (n === undefined) return;
      suma += (n / a.sobre) * a.peso;
      pesos += a.peso;
    });
    return pesos > 0 ? suma / pesos * escala : null;
  },

  // Actividades antiguas sin peso: reparto en partes iguales
  migrar() {
    const l = this.actividades(), grupos = {};
    l.forEach(a => (grupos[a.cursoId + a.asigId + a.per] ||= []).push(a));
    let cambio = false;
    Object.values(grupos).forEach(g => {
      if (g.some(a => a.peso === undefined)) {
        g.forEach(a => a.peso = Math.round(10000 / g.length) / 100);
        cambio = true;
      }
    });
    if (cambio) this.guardarActs(l);
  },

  // Crea la actividad "Tareas" del grupo si no existe
  asegurarActTareas(cursoId, asigId, per, cfg) {
    const l = this.actividades();
    const mismo = x => x.cursoId === cursoId && x.asigId === asigId && x.per === per;
    let a = l.find(x => x.tipo === "tareas" && mismo(x));
    if (!a) {
      const usado = l.filter(mismo).reduce((t, x) => t + (x.peso || 0), 0);
      a = { id: Storage.nuevoId(), cursoId, asigId, per, nombre: "Tareas",
            sobre: cfg.escalaMaxima, peso: Math.max(0, 100 - usado), tipo: "tareas" };
      l.push(a);
      this.guardarActs(l);
    }
    return a;
  },

  // Quita la actividad "Tareas" cuando ya no quedan tareas en el grupo
  quitarActTareasSiVacia(cursoId, asigId, per) {
    if (Tareas.deGrupo(cursoId, asigId, per).length) return;
    this.guardarActs(this.actividades().filter(x =>
      !(x.tipo === "tareas" && x.cursoId === cursoId && x.asigId === asigId && x.per === per)));
  },

  exportarCSV(s, cfg, acts) {
    const curso = Cursos.todos().find(c => c.id === s.curso);
    const asig = curso.asignaturas.find(a => a.id === s.asig);
    const mapa = this.mapa();
    const celda = v => { v = String(v ?? ""); return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
    const num = n => n == null ? "" : String(Math.round(n * 100) / 100).replace(".", ",");
    const filas = [["Curso", "Asignatura", "Período", "Estudiante",
      ...acts.map(a => `${a.nombre} (${a.peso}%, sobre ${a.sobre})`), "Promedio", "Estado"]];
    Estudiantes.deCurso(s.curso).forEach(al => {
      const p = this.promedio(al.id, acts, mapa, cfg.escalaMaxima);
      filas.push([curso.nombre, asig.nombre, cfg.periodos[s.per], al.nombre,
        ...acts.map(a => num(this.notaDe(a, al.id, mapa))), num(p),
        p === null ? "" : p >= cfg.notaMinima ? "Aprobado" : "En riesgo"]);
    });
    const csv = "\uFEFF" + filas.map(f => f.map(celda).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `notas-${curso.nombre}-${asig.nombre}-${cfg.periodos[s.per]}.csv`.replace(/[\\/:*?"<>|\s]+/g, "_");
    a.click();
    URL.revokeObjectURL(a.href);
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
    Notas.migrar();
    Tareas.migrar(cfg);

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
      const total = acts.reduce((t, a) => t + a.peso, 0);
      const w = el.querySelector("#nPesos");
      if (w) {
        const mal = Math.abs(total - 100) > 0.01;
        w.textContent = `Ponderación total: ${Math.round(total * 100) / 100} %` + (mal ? " (debería sumar 100 %)" : "");
        w.style.color = mal ? "var(--alerta-texto)" : "";
        w.style.fontWeight = mal ? "600" : "";
      }
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
      const restante = Math.max(0, 100 - acts.reduce((t, a) => t + a.peso, 0));

      el.innerHTML = cabecera + `
        <div class="card fila" style="flex-wrap:wrap">
          <input id="nNombre" placeholder="Nueva actividad (Ej: Lección 1)" maxlength="40">
          <span class="sub">sobre</span>
          <input id="nSobre" type="number" min="1" value="${cfg.escalaMaxima}" style="max-width:90px;flex:none" aria-label="Calificación sobre">
          <input id="nPeso" type="number" min="0" max="100" value="${restante}" style="max-width:90px;flex:none" aria-label="Ponderación en porcentaje">
          <span class="sub">%</span>
          <button class="btn" id="nAgregar">Agregar actividad</button>
          <button class="btn-sec" id="nExportar">Exportar a Excel (CSV)</button>
        </div>
        <p class="sub" id="nGeneral" style="margin-top:16px"></p>
        <p class="sub" id="nPesos" style="margin-top:4px"></p>
        <div class="card tabla-wrap" style="margin-top:8px">
          <table class="tabla">
            <thead><tr><th>Estudiante</th>
              ${acts.map(a => `<th class="c act">
                <div class="act-nombre">${esc(a.nombre)}</div>
                <div class="act-meta">
                  <input class="peso" type="number" min="0" max="100" step="1"
                    data-peso="${a.id}" value="${a.peso}" aria-label="Ponderación de ${esc(a.nombre)}">%
                  ${a.tipo === "tareas"
                    ? `<span>· automática</span>`
                    : `<span>· sobre ${a.sobre}</span>
                       <button class="x" data-del="${a.id}" aria-label="Eliminar ${esc(a.nombre)}">×</button>`}
                </div></th>`).join("")}
              <th class="c">Promedio</th><th>Estado</th></tr></thead>
            <tbody>
              ${alumnos.map(al => `<tr data-al="${al.id}"><td>${esc(al.nombre)}</td>
                ${acts.map(a => a.tipo === "tareas"
                  ? `<td class="c"><span class="auto">${fmtNota(Notas.notaDe(a, al.id, mapa))}</span></td>`
                  : `<td class="c"><input class="nota" type="number" min="0" max="${a.sobre}" step="0.01"
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
      else if (t.dataset.peso) {
        const l = Notas.actividades();
        const a = l.find(x => x.id === t.dataset.peso);
        const v = Number(t.value);
        if (t.value === "" || v < 0 || v > 100) {
          t.value = a.peso;
          alert("La ponderación debe estar entre 0 y 100.");
          return;
        }
        a.peso = v;
        Notas.guardarActs(l);
        resumen();
      }
    };

    el.onclick = e => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.id === "nAgregar") {
        const nombre = el.querySelector("#nNombre").value.trim();
        const sobre = Number(el.querySelector("#nSobre").value);
        const peso = Number(el.querySelector("#nPeso").value);
        if (!nombre || !(sobre > 0) || !(peso >= 0 && peso <= 100)) return;
        const l = Notas.actividades();
        l.push({ id: Storage.nuevoId(), cursoId: s.curso, asigId: s.asig, per: s.per, nombre, sobre, peso });
        Notas.guardarActs(l);
        pintar();
      } else if (b.id === "nExportar") {
        Notas.exportarCSV(s, cfg, actsActuales());
      } else if (b.dataset.del) {
        const act = Notas.actividades().find(a => a.id === b.dataset.del);
        if (!act || act.tipo === "tareas") return;
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