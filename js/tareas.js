const Tareas = {
  todas() { return Storage.leer("tareas", []); },
  guardar(l) { Storage.guardar("tareas", l); },
  deGrupo(cursoId, asigId, per) {
    return this.todas().filter(t => t.cursoId === cursoId && t.asigId === asigId && t.per === per);
  },

  // Completa datos de tareas antiguas y asegura la actividad "Tareas" de cada grupo
  migrar(cfg) {
    const l = this.todas();
    const acts = Notas.actividades();
    let cambio = false;
    l.forEach(t => {
      if (t.per === undefined) { t.per = acts.find(a => a.id === t.actId)?.per ?? 0; cambio = true; }
      if (t.sobre === undefined) { t.sobre = cfg.escalaMaxima; cambio = true; }
      if (!t.notas) { t.notas = {}; cambio = true; }
    });
    if (cambio) this.guardar(l);
    const vistos = new Set();
    l.forEach(t => {
      const k = t.cursoId + "|" + t.asigId + "|" + t.per;
      if (!vistos.has(k)) { vistos.add(k); Notas.asegurarActTareas(t.cursoId, t.asigId, t.per, cfg); }
    });
  }
};

const hoyISO = () => new Date().toLocaleDateString("en-CA");   // AAAA-MM-DD en hora local
const fechaCorta = iso => iso ? iso.split("-").reverse().join("/") : "Sin fecha";

Modulos.tareas = {
  sel: {},
  abierta: null,    // tarea con la tabla de notas desplegada
  editando: null,   // tarea en modo edición

  render(el) {
    const cfg = Config.obtener();
    const cursos = Cursos.todos();
    const s = this.sel;
    if (!cursos.length) {
      el.innerHTML = `<h1>Tareas</h1><p class="sub">Primero crea un curso y sus asignaturas.</p>`;
      return;
    }
    Notas.migrar();
    Tareas.migrar(cfg);

    const pintar = () => {
      if (!cursos.some(c => c.id === s.curso)) { s.curso = cursos[0].id; s.asig = null; }
      const curso = cursos.find(c => c.id === s.curso);
      if (!curso.asignaturas.some(a => a.id === s.asig)) s.asig = curso.asignaturas[0]?.id || null;
      if (!(s.per >= 0 && s.per < cfg.periodos.length)) s.per = 0;

      const cabecera = `
        <h1>Tareas</h1>
        <p class="sub">Todas las tareas de un período forman una sola actividad en Calificaciones.</p>
        <div class="fila" style="flex-wrap:wrap">
          <select id="tCurso">${cursos.map(c => `<option value="${c.id}" ${c.id === s.curso ? "selected" : ""}>${esc(c.nombre)}</option>`).join("")}</select>
          <select id="tAsig">${curso.asignaturas.map(a => `<option value="${a.id}" ${a.id === s.asig ? "selected" : ""}>${esc(a.nombre)}</option>`).join("")}</select>
          <select id="tPer">${cfg.periodos.map((p, i) => `<option value="${i}" ${i === s.per ? "selected" : ""}>${esc(p)}</option>`).join("")}</select>
        </div>`;

      if (!s.asig) {
        el.innerHTML = cabecera + `<p class="sub" style="margin-top:20px">Este curso no tiene asignaturas. Agrégalas en el módulo Cursos.</p>`;
        return;
      }

      const alumnos = Estudiantes.deCurso(s.curso);
      const hoy = hoyISO();
      const lista = Tareas.deGrupo(s.curso, s.asig, s.per)
        .sort((a, b) => (a.fecha || "9999").localeCompare(b.fecha || "9999"));
      const act = Notas.actividades().find(a => a.tipo === "tareas" && a.cursoId === s.curso && a.asigId === s.asig && a.per === s.per);

      const aviso = lista.length && act ? `
        <div class="card fila" style="flex-wrap:wrap;justify-content:space-between">
          <span class="sub">Estas tareas alimentan la actividad «Tareas» de Calificaciones (${act.peso} %, promedio simple).</span>
          <button class="btn-sec" id="tIr">Ir a Calificaciones</button>
        </div>` : "";

      const tarjeta = t => {
        if (this.editando === t.id) {
          return `<div class="card tarea" data-id="${t.id}"><div class="form" style="max-width:none;margin-top:0">
            <label>Título<input data-f="titulo" value="${esc(t.titulo)}" maxlength="80"></label>
            <label>Calificada sobre<input data-f="sobre" type="number" min="1" value="${t.sobre}"></label>
            <label>Fecha de entrega<input data-f="fecha" type="date" value="${t.fecha}"></label>
            <label>Descripción<input data-f="descripcion" value="${esc(t.descripcion)}" maxlength="200"></label>
            <div class="fila" style="margin:0">
              <button class="btn" data-acc="guardar">Guardar</button>
              <button class="btn-sec" data-acc="cancelar">Cancelar</button>
            </div></div></div>`;
        }
        const conNota = alumnos.filter(a => t.notas[a.id] !== undefined).length;
        const completa = alumnos.length > 0 && conNota === alumnos.length;
        const etiqueta = completa ? '<span class="tag">Calificada</span>'
          : t.fecha && t.fecha < hoy ? '<span class="tag w">Por calificar</span>'
          : '<span class="tag gris">Pendiente</span>';
        const abierta = this.abierta === t.id;
        return `<div class="card tarea" data-id="${t.id}">
          <div class="cab">
            <div>
              <h2>${esc(t.titulo)}</h2>
              <div class="mut">Entrega: ${fechaCorta(t.fecha)} · sobre ${t.sobre} · <span class="cuenta">${conNota}/${alumnos.length} con nota</span></div>
              ${t.descripcion ? `<div class="mut">${esc(t.descripcion)}</div>` : ""}
            </div>
            <div class="acc">${etiqueta}
              <button class="btn" data-acc="calificar">${abierta ? "Cerrar" : "Calificar"}</button>
              <button class="btn-sec" data-acc="editar">Editar</button>
              <button class="btn-sec" data-acc="borrar">Eliminar</button>
            </div>
          </div>
          ${abierta ? `<div class="tabla-wrap" style="border-top:1px solid var(--borde)">
            <table class="tabla">
              <thead><tr><th>Estudiante</th><th class="c">Nota (sobre ${t.sobre})</th></tr></thead>
              <tbody>
                ${alumnos.map(a => `<tr><td>${esc(a.nombre)}</td><td class="c">
                  <input class="nota tnota" type="number" min="0" max="${t.sobre}" step="0.01"
                    data-al="${a.id}" value="${t.notas[a.id] ?? ""}"></td></tr>`).join("")
                  || `<tr><td class="sub">No hay estudiantes en este curso.</td></tr>`}
              </tbody>
            </table></div>` : ""}
        </div>`;
      };

      el.innerHTML = cabecera + `
        <div class="card fila" style="flex-wrap:wrap">
          <input id="tTitulo" placeholder="Nueva tarea (Ej: Taller de fracciones)" maxlength="80">
          <span class="sub">sobre</span>
          <input id="tSobre" type="number" min="1" value="${cfg.escalaMaxima}" style="max-width:90px;flex:none" aria-label="Calificada sobre">
          <input id="tFecha" type="date" style="flex:none" aria-label="Fecha de entrega">
          <input id="tDesc" placeholder="Descripción (opcional)" maxlength="200">
          <button class="btn" id="tAgregar">Agregar tarea</button>
        </div>
        ${aviso}
        ${lista.map(tarjeta).join("") || '<p class="sub" style="margin-top:20px">Aún no hay tareas en este período.</p>'}`;
    };

    // Redibuja sin perder la posición de la página
    const repintar = () => { const y = window.scrollY; pintar(); window.scrollTo(0, y); };
    pintar();

    el.onchange = e => {
      const t = e.target;
      if (t.id === "tCurso") { s.curso = t.value; s.asig = null; this.abierta = this.editando = null; pintar(); }
      else if (t.id === "tAsig") { s.asig = t.value; this.abierta = this.editando = null; pintar(); }
      else if (t.id === "tPer") { s.per = Number(t.value); this.abierta = this.editando = null; pintar(); }
      else if (t.classList.contains("tnota")) {
        const card = t.closest("[data-id]");
        const l = Tareas.todas();
        const tarea = l.find(x => x.id === card.dataset.id);
        const v = t.value === "" ? null : Number(t.value);
        if (v !== null && (v < 0 || v > tarea.sobre)) {
          t.value = tarea.notas[t.dataset.al] ?? "";
          alert(`La nota debe estar entre 0 y ${tarea.sobre}.`);
          return;
        }
        if (v === null) delete tarea.notas[t.dataset.al]; else tarea.notas[t.dataset.al] = v;
        Tareas.guardar(l);
        const alumnos = Estudiantes.deCurso(s.curso);
        const n = alumnos.filter(a => tarea.notas[a.id] !== undefined).length;
        card.querySelector(".cuenta").textContent = `${n}/${alumnos.length} con nota`;
      }
    };

    el.onclick = e => {
      const b = e.target.closest("button");
      if (!b) return;
      const l = Tareas.todas();

      if (b.id === "tAgregar") {
        const titulo = el.querySelector("#tTitulo").value.trim();
        const sobre = Number(el.querySelector("#tSobre").value);
        if (!titulo || !(sobre > 0)) return;
        l.push({
          id: Storage.nuevoId(), cursoId: s.curso, asigId: s.asig, per: s.per, titulo, sobre,
          fecha: el.querySelector("#tFecha").value,
          descripcion: el.querySelector("#tDesc").value.trim(),
          notas: {}
        });
        Tareas.guardar(l);
        Notas.asegurarActTareas(s.curso, s.asig, s.per, cfg);
        pintar();
        return;
      }
      if (b.id === "tIr") {
        Object.assign(Modulos.notas.sel, { curso: s.curso, asig: s.asig, per: s.per });
        location.hash = "notas";
        return;
      }

      const card = b.closest("[data-id]");
      const t = card && l.find(x => x.id === card.dataset.id);
      if (!t) return;
      const acc = b.dataset.acc;

      if (acc === "calificar") { this.abierta = this.abierta === t.id ? null : t.id; repintar(); }
      else if (acc === "editar") { this.editando = t.id; repintar(); }
      else if (acc === "cancelar") { this.editando = null; repintar(); }
      else if (acc === "guardar") {
        const campo = f => card.querySelector(`[data-f="${f}"]`).value.trim();
        const sobre = Number(campo("sobre"));
        if (!campo("titulo") || !(sobre > 0)) return;
        if (Object.values(t.notas).some(n => n > sobre)) {
          alert("Hay notas mayores que el nuevo valor de 'sobre'. Corrígelas primero.");
          return;
        }
        t.titulo = campo("titulo"); t.sobre = sobre; t.fecha = campo("fecha"); t.descripcion = campo("descripcion");
        Tareas.guardar(l);
        this.editando = null;
        repintar();
      }
      else if (acc === "borrar") {
        if (!confirm(`¿Eliminar la tarea "${t.titulo}" y sus notas?`)) return;
        Tareas.guardar(l.filter(x => x.id !== t.id));
        Notas.quitarActTareasSiVacia(t.cursoId, t.asigId, t.per);
        repintar();
      }
    };

    el.onkeydown = e => {
      if (e.key === "Enter" && e.target.id === "tTitulo") el.querySelector("#tAgregar").click();
    };
  }
};