const Asistencia = {
  todo() { return Storage.leer("asistencia", {}); },   // { "cursoId|asigId|AAAA-MM-DD": { estudianteId: "P"|"A"|"J"|"F" } }
  guardar(o) { Storage.guardar("asistencia", o); }
};

const ESTADOS = [["P", "Presente"], ["A", "Atraso"], ["J", "Justificada"], ["F", "Falta"]];

Modulos.asistencia = {
  sel: {},
  render(el) {
    const cursos = Cursos.todos();
    const s = this.sel;
    if (!cursos.length) {
      el.innerHTML = `<h1>Asistencia</h1><p class="sub">Primero crea un curso y sus asignaturas.</p>`;
      return;
    }
    if (!s.fecha) s.fecha = hoyISO();

    const pintar = () => {
      if (!cursos.some(c => c.id === s.curso)) { s.curso = cursos[0].id; s.asig = null; }
      const curso = cursos.find(c => c.id === s.curso);
      if (!curso.asignaturas.some(a => a.id === s.asig)) s.asig = curso.asignaturas[0]?.id || null;

      const cabecera = `
        <h1>Asistencia</h1>
        <p class="sub">Registro diario por curso y asignatura.</p>
        <div class="fila" style="flex-wrap:wrap">
          <select id="aCurso">${cursos.map(c => `<option value="${c.id}" ${c.id === s.curso ? "selected" : ""}>${esc(c.nombre)}</option>`).join("")}</select>
          <select id="aAsig">${curso.asignaturas.map(a => `<option value="${a.id}" ${a.id === s.asig ? "selected" : ""}>${esc(a.nombre)}</option>`).join("")}</select>
          <input id="aFecha" type="date" value="${s.fecha}" style="flex:none" aria-label="Fecha">
          <button class="btn-sec" id="aHoy">Hoy</button>
        </div>`;

      if (!s.asig) {
        el.innerHTML = cabecera + `<p class="sub" style="margin-top:20px">Este curso no tiene asignaturas. Agrégalas en el módulo Cursos.</p>`;
        return;
      }

      const alumnos = Estudiantes.deCurso(s.curso);
      const todo = Asistencia.todo();
      const prefijo = `${s.curso}|${s.asig}|`;
      const dia = todo[prefijo + s.fecha] || {};
      const fechas = Object.keys(todo).filter(k => k.startsWith(prefijo)).map(k => k.slice(prefijo.length));
      const marcados = alumnos.filter(a => dia[a.id]).length;

      // Totales por estudiante sobre todos los días registrados
      const resumen = alumnos.map(a => {
        const c = { P: 0, A: 0, J: 0, F: 0 };
        fechas.forEach(f => { const v = (todo[prefijo + f] || {})[a.id]; if (v) c[v]++; });
        const dias = c.P + c.A + c.J + c.F;
        const pct = dias ? (c.P + c.A + c.J) / dias * 100 : null;
        return `<tr><td>${esc(a.nombre)}</td><td class="c">${c.P}</td><td class="c">${c.A}</td>
          <td class="c">${c.J}</td><td class="c">${c.F}</td><td class="c">${dias}</td>
          <td class="c"><b>${pct === null ? "—" : fmt(pct) + " %"}</b></td></tr>`;
      }).join("");

      el.innerHTML = cabecera + `
        <div class="fila" style="flex-wrap:wrap;justify-content:space-between">
          <span class="sub">${fechaCorta(s.fecha)} · registrados: ${marcados}/${alumnos.length}</span>
          <button class="btn-sec" id="aTodos">Marcar todos presentes</button>
        </div>
        <div class="card tabla-wrap">
          <table class="tabla">
            <thead><tr><th>Estudiante</th><th class="der">Asistencia del día</th></tr></thead>
            <tbody>
              ${alumnos.map(a => `<tr><td>${esc(a.nombre)}</td><td class="der" style="white-space:normal">
                <div class="seg">${ESTADOS.map(([c, n]) =>
                  `<button class="${dia[a.id] === c ? "on-" + c : ""}" data-al="${a.id}" data-e="${c}" aria-pressed="${dia[a.id] === c}">${n}</button>`).join("")}</div>
                </td></tr>`).join("")
                || `<tr><td colspan="2" class="sub">No hay estudiantes en este curso.</td></tr>`}
            </tbody>
          </table>
        </div>

        <h2 style="margin:28px 0 4px;font-size:18px">Resumen · ${fechas.length} día(s) registrado(s)</h2>
        <p class="sub" style="margin:0 0 8px">% de asistencia = (presentes + atrasos + justificadas) ÷ días registrados.</p>
        <div class="card tabla-wrap" style="margin-top:8px">
          <table class="tabla">
            <thead><tr><th>Estudiante</th><th class="c" title="Presentes">P</th><th class="c" title="Atrasos">A</th>
              <th class="c" title="Justificadas">J</th><th class="c" title="Faltas">F</th><th class="c">Días</th><th class="c">% asistencia</th></tr></thead>
            <tbody>${resumen || `<tr><td colspan="7" class="sub">Sin estudiantes.</td></tr>`}</tbody>
          </table>
        </div>`;
    };

    // Redibuja sin perder la posición de la página
    const repintar = () => { const y = window.scrollY; pintar(); window.scrollTo(0, y); };
    pintar();

    const guardarDia = (marcas) => {
      const todo = Asistencia.todo();
      const k = `${s.curso}|${s.asig}|${s.fecha}`;
      if (Object.keys(marcas).length) todo[k] = marcas; else delete todo[k];
      Asistencia.guardar(todo);
    };

    el.onchange = e => {
      const t = e.target;
      if (t.id === "aCurso") { s.curso = t.value; s.asig = null; pintar(); }
      else if (t.id === "aAsig") { s.asig = t.value; pintar(); }
      else if (t.id === "aFecha" && t.value) { s.fecha = t.value; pintar(); }
    };

    el.onclick = e => {
      const b = e.target.closest("button");
      if (!b) return;
      const k = `${s.curso}|${s.asig}|${s.fecha}`;
      const marcas = { ...(Asistencia.todo()[k] || {}) };

      if (b.id === "aHoy") { s.fecha = hoyISO(); pintar(); }
      else if (b.id === "aTodos") {
        Estudiantes.deCurso(s.curso).forEach(a => marcas[a.id] = "P");
        guardarDia(marcas);
        repintar();
      }
      else if (b.dataset.e) {
        if (marcas[b.dataset.al] === b.dataset.e) delete marcas[b.dataset.al];
        else marcas[b.dataset.al] = b.dataset.e;
        guardarDia(marcas);
        repintar();
      }
    };
  }
};