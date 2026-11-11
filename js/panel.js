Modulos.panel = {
  per: 0,
  exp: { curso: null, asig: "" },

  // Datos del reporte: un grupo por asignatura que tenga actividades en el período
  datos(cursoId, asigId, per, cfg) {
    const curso = Cursos.todos().find(c => c.id === cursoId);
    const mapa = Notas.mapa(), acts = Notas.actividades();
    const alumnos = Estudiantes.deCurso(cursoId);
    const grupos = [];
    curso.asignaturas.filter(a => !asigId || a.id === asigId).forEach(a => {
      const g = acts.filter(x => x.cursoId === cursoId && x.asigId === a.id && x.per === per);
      if (!g.length) return;
      grupos.push({
        asig: a, acts: g,
        filas: alumnos.map(al => ({
          nombre: al.nombre,
          notas: g.map(x => Notas.notaDe(x, al.id, mapa)),
          prom: Notas.promedio(al.id, g, mapa, cfg.escalaMaxima)
        }))
      });
    });
    return { curso, periodo: cfg.periodos[per], grupos };
  },

  bajar(blob, nombre) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nombre.replace(/[\\/:*?"<>|\s]+/g, "_");
    a.click();
    URL.revokeObjectURL(a.href);
  },

  // Excel editable: un libro con una hoja por asignatura, notas como números
  excel(d, cfg) {
    const x = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const t = (v, st) => `<Cell${st ? ` ss:StyleID="${st}"` : ""}><Data ss:Type="String">${x(v)}</Data></Cell>`;
    const n = v => v == null ? "<Cell/>" : `<Cell><Data ss:Type="Number">${Math.round(v * 100) / 100}</Data></Cell>`;
    const fila = (...c) => `<Row>${c.join("")}</Row>`;
    const usados = new Set();
    const hojas = d.grupos.map(g => {
      const base = g.asig.nombre.replace(/[\\/?*\[\]:]/g, " ").trim().slice(0, 28) || "Hoja";
      let nombre = base, i = 2;
      while (usados.has(nombre.toLowerCase())) nombre = base + " " + i++;
      usados.add(nombre.toLowerCase());
      const filas = [
        fila(t("Curso", "h"), t(d.curso.nombre)),
        fila(t("Asignatura", "h"), t(g.asig.nombre)),
        fila(t("Período", "h"), t(d.periodo)),
        "<Row/>",
        fila(t("Estudiante", "h"),
          ...g.acts.map(a => t(`${a.nombre} (${a.peso}%, sobre ${a.sobre})`, "h")),
          t("Promedio", "h"), t("Estado", "h")),
        ...g.filas.map(f => fila(t(f.nombre), ...f.notas.map(v => n(v)), n(f.prom),
          t(f.prom === null ? "" : f.prom >= cfg.notaMinima ? "Aprobado" : "En riesgo")))
      ];
      return { nombre, filas };
    });
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="h"><Font ss:Bold="1"/></Style></Styles>
${hojas.map(h => `<Worksheet ss:Name="${x(h.nombre)}"><Table>${h.filas.join("")}</Table></Worksheet>`).join("")}
</Workbook>`;
    this.bajar(new Blob([xml], { type: "application/vnd.ms-excel" }),
      `calificaciones-${d.curso.nombre}-${d.periodo}.xls`);
  },

  // PDF: abre el cuadro de impresión (elige "Guardar como PDF")
  pdf(d, cfg) {
    const maxActs = Math.max(...d.grupos.map(g => g.acts.length));
    const tabla = g => `
      <div class="g"><h2>${esc(g.asig.nombre)}</h2>
      <table><thead><tr><th>#</th><th>Estudiante</th>
        ${g.acts.map(a => `<th>${esc(a.nombre)}<br><small>${a.peso}% · sobre ${a.sobre}</small></th>`).join("")}
        <th>Promedio</th><th>Estado</th></tr></thead>
      <tbody>${g.filas.map((f, i) => `<tr><td>${i + 1}</td><td>${esc(f.nombre)}</td>
        ${f.notas.map(v => `<td class="c">${fmtNota(v)}</td>`).join("")}
        <td class="c"><b>${fmt(f.prom)}</b></td>
        <td>${f.prom === null ? "" : f.prom >= cfg.notaMinima ? "Aprobado" : "En riesgo"}</td></tr>`).join("")}
      </tbody></table></div>`;
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
      <title>Calificaciones ${esc(d.curso.nombre)} ${esc(d.periodo)}</title>
      <style>
        @page { size: A4 ${maxActs > 5 ? "landscape" : "portrait"}; margin: 14mm; }
        body { font-family: Arial, sans-serif; font-size: 12px; color: #000; }
        h1 { font-size: 18px; margin: 0 0 4px; } h2 { font-size: 14px; margin: 16px 0 6px; }
        p { margin: 2px 0; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #888; padding: 4px 6px; text-align: left; }
        th { background: #eee; } .c { text-align: center; } small { font-weight: normal; }
        tr { page-break-inside: avoid; } .g + .g { page-break-before: always; }
      </style></head><body>
      <h1>Reporte de calificaciones</h1>
      <p>${esc([cfg.institucion, "Año lectivo " + cfg.anioLectivo, cfg.docente].filter(Boolean).join(" · "))}</p>
      <p><b>Curso:</b> ${esc(d.curso.nombre)} &nbsp; <b>Período:</b> ${esc(d.periodo)}
         &nbsp; <b>Escala:</b> sobre ${cfg.escalaMaxima} (aprueba con ${cfg.notaMinima})</p>
      ${d.grupos.map(tabla).join("")}
      </body></html>`;
    const f = document.createElement("iframe");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(f);
    const doc = f.contentWindow.document;
    doc.open(); doc.write(html); doc.close();
    f.contentWindow.onafterprint = () => f.remove();
    setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); }, 300);
    setTimeout(() => f.remove(), 120000);
  },

  render(el) {
    const cfg = Config.obtener();
    const cursos = Cursos.todos();
    if (!cursos.length) {
      el.innerHTML = `<h1>Panel</h1><p class="sub">Bienvenido. Empieza creando tu primer curso.</p>
        <a class="btn" href="#cursos">Crear un curso</a>`;
      return;
    }
    Notas.migrar();
    Tareas.migrar(cfg);

    const pintar = () => {
      if (!(this.per >= 0 && this.per < cfg.periodos.length)) this.per = 0;
      if (!cursos.some(c => c.id === this.exp.curso)) { this.exp.curso = cursos[0].id; this.exp.asig = ""; }
      const per = this.per;
      const hoy = hoyISO();
      const acts = Notas.actividades(), mapa = Notas.mapa();
      const alumnosDe = {};
      cursos.forEach(c => alumnosDe[c.id] = Estudiantes.deCurso(c.id));
      const totalAlumnos = cursos.reduce((t, c) => t + alumnosDe[c.id].length, 0);

      // Promedios del período seleccionado
      const porCurso = {}, filasAsig = [], riesgo = [];
      let sumaG = 0, nG = 0;
      cursos.forEach(c => c.asignaturas.forEach(a => {
        const grupo = acts.filter(x => x.cursoId === c.id && x.asigId === a.id && x.per === per);
        if (!grupo.length) return;
        const r = { c, a, n: 0, suma: 0, ap: 0, rg: 0 };
        alumnosDe[c.id].forEach(al => {
          const p = Notas.promedio(al.id, grupo, mapa, cfg.escalaMaxima);
          if (p === null) return;
          r.n++; r.suma += p;
          if (p >= cfg.notaMinima) r.ap++;
          else { r.rg++; riesgo.push({ nombre: al.nombre, curso: c, asig: a, p }); }
          const pc = porCurso[c.id] ||= { suma: 0, n: 0 };
          pc.suma += p; pc.n++; sumaG += p; nG++;
        });
        filasAsig.push(r);
      }));
      riesgo.sort((a, b) => a.p - b.p);

      // Tareas con estudiantes aún sin nota (de todos los períodos)
      const pendientes = Tareas.todas().map(t => {
        const c = cursos.find(x => x.id === t.cursoId);
        const a = c?.asignaturas.find(x => x.id === t.asigId);
        if (!a) return null;
        const al = alumnosDe[c.id];
        const conNota = al.filter(s => (t.notas || {})[s.id] !== undefined).length;
        return al.length && conNota < al.length ? { t, c, a, conNota, total: al.length } : null;
      }).filter(Boolean).sort((x, y) => (x.t.fecha || "9999").localeCompare(y.t.fecha || "9999"));

      // Asistencia global: solo la falta injustificada no cuenta como asistencia
      const ids = new Set();
      cursos.forEach(c => alumnosDe[c.id].forEach(s => ids.add(s.id)));
      let pres = 0, tot = 0;
      Object.values(Asistencia.todo()).forEach(dia => Object.entries(dia).forEach(([id, v]) => {
        if (!ids.has(id)) return;
        tot++; if (v !== "F") pres++;
      }));

      const hora = new Date().getHours();
      const saludo = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";
      const subtitulo = [cfg.institucion, "Año lectivo " + cfg.anioLectivo].filter(Boolean).join(" · ");

      const barras = cursos.filter(c => porCurso[c.id]).map(c => {
        const prom = porCurso[c.id].suma / porCurso[c.id].n;
        const ancho = Math.max(0, Math.min(100, prom / cfg.escalaMaxima * 100));
        return `<div class="bar"><span title="${esc(c.nombre)}">${esc(c.nombre)}</span>
          <div class="track"><div class="fill ${prom < cfg.notaMinima ? "w" : ""}" style="width:${ancho}%"></div></div>
          <b>${fmt(prom)}</b></div>`;
      }).join("");

      const cursoExp = cursos.find(c => c.id === this.exp.curso);

      el.innerHTML = `
        <div class="cab" style="flex-wrap:wrap">
          <div><h1>${saludo}${cfg.docente ? ", " + esc(cfg.docente) : ""}</h1><p class="sub">${esc(subtitulo)}</p></div>
          <a class="btn" href="#tareas">Nueva tarea</a>
        </div>
        <div class="acc" style="justify-content:flex-start;margin:4px 0 20px">
          ${cfg.periodos.map((p, i) => `<button class="${i === per ? "btn" : "btn-sec"}" data-p="${i}">${esc(p)}</button>`).join("")}
        </div>

        <div class="stats">
          <div class="card"><div class="lbl">Estudiantes</div><div class="num">${totalAlumnos}</div></div>
          <div class="card"><div class="lbl">Promedio general</div><div class="num">${fmt(nG ? sumaG / nG : null)} <small>/ ${cfg.escalaMaxima}</small></div></div>
          <div class="card"><div class="lbl">Tareas por calificar</div><div class="num">${pendientes.length}</div></div>
          <div class="card"><div class="lbl">Asistencia</div><div class="num">${tot ? fmt(pres / tot * 100) + " <small>%</small>" : "—"}</div></div>
        </div>

        <div class="cols">
          <div class="card">
            <h2>Promedio por curso</h2>
            ${barras || '<p class="sub">Aún no hay notas en este período.</p>'}
          </div>
          <div class="card">
            <h2>Tareas por calificar</h2>
            ${pendientes.slice(0, 5).map(x => `
              <button class="item" data-ir="tareas" data-curso="${x.c.id}" data-asig="${x.a.id}" data-periodo="${x.t.per}">
                <span><b>${esc(x.t.titulo)}</b><br><span class="mut">${esc(x.c.nombre)} · ${esc(x.a.nombre)} · ${x.conNota}/${x.total} con nota</span></span>
                ${x.t.fecha && x.t.fecha < hoy ? '<span class="tag w">Vencida</span>' : `<span class="tag gris">${fechaCorta(x.t.fecha)}</span>`}
              </button>`).join("") || '<p class="sub">No tienes tareas pendientes de calificar.</p>'}
          </div>
          <div class="card">
            <h2>Estudiantes en riesgo (menos de ${cfg.notaMinima})</h2>
            ${riesgo.slice(0, 6).map(x => `
              <button class="item" data-ir="notas" data-curso="${x.curso.id}" data-asig="${x.asig.id}" data-periodo="${per}">
                <span>${esc(x.nombre)}<br><span class="mut">${esc(x.curso.nombre)} · ${esc(x.asig.nombre)}</span></span>
                <b>${fmt(x.p)}</b>
              </button>`).join("") || '<p class="sub">Ningún estudiante por debajo de la nota mínima.</p>'}
          </div>
        </div>

        <div class="card tabla-wrap" style="margin-top:16px">
          <h2>Resumen por curso y asignatura · ${esc(cfg.periodos[per])}</h2>
          <table class="tabla">
            <thead><tr><th>Curso</th><th>Asignatura</th><th class="c">Con nota</th><th class="c">Promedio</th>
              <th class="c">Aprobados</th><th class="c">En riesgo</th><th></th></tr></thead>
            <tbody>
              ${filasAsig.map(r => `<tr><td>${esc(r.c.nombre)}</td><td>${esc(r.a.nombre)}</td>
                <td class="c">${r.n}/${alumnosDe[r.c.id].length}</td>
                <td class="c"><b>${fmt(r.n ? r.suma / r.n : null)}</b></td>
                <td class="c">${r.ap}</td><td class="c">${r.rg}</td>
                <td class="der"><button class="btn-sec" data-ir="notas" data-curso="${r.c.id}" data-asig="${r.a.id}" data-periodo="${per}">Ver</button></td></tr>`).join("")
                || `<tr><td colspan="7" class="sub">Aún no hay actividades en este período.</td></tr>`}
            </tbody>
          </table>
        </div>

        <div class="card" style="margin-top:16px">
          <h2>Exportar calificaciones</h2>
          <p class="sub">Período: ${esc(cfg.periodos[per])} (cámbialo con los botones de arriba)</p>
          <div class="fila" style="flex-wrap:wrap">
            <select id="pxCurso">${cursos.map(c => `<option value="${c.id}" ${c.id === this.exp.curso ? "selected" : ""}>${esc(c.nombre)}</option>`).join("")}</select>
            <select id="pxAsig"><option value="">Todas las asignaturas</option>
              ${cursoExp.asignaturas.map(a => `<option value="${a.id}" ${a.id === this.exp.asig ? "selected" : ""}>${esc(a.nombre)}</option>`).join("")}</select>
            <button class="btn-sec" id="pxExcel">Exportar a Excel</button>
            <button class="btn" id="pxPdf">Exportar a PDF</button>
          </div>
        </div>`;
    };
    pintar();

    el.onchange = e => {
      if (e.target.id === "pxCurso") { this.exp = { curso: e.target.value, asig: "" }; pintar(); }
      else if (e.target.id === "pxAsig") { this.exp.asig = e.target.value; pintar(); }
    };

    el.onclick = e => {
      const bp = e.target.closest("[data-p]");
      if (bp) { this.per = Number(bp.dataset.p); pintar(); return; }
      const bx = e.target.closest("#pxExcel, #pxPdf");
      if (bx) {
        const d = this.datos(this.exp.curso, this.exp.asig, this.per, cfg);
        if (!d.grupos.length) { alert("No hay actividades con notas en ese curso y período."); return; }
        if (bx.id === "pxExcel") this.excel(d, cfg); else this.pdf(d, cfg);
        return;
      }
      const it = e.target.closest("[data-ir]");
      if (!it) return;
      Object.assign(Modulos[it.dataset.ir].sel, {
        curso: it.dataset.curso, asig: it.dataset.asig, per: Number(it.dataset.periodo)
      });
      location.hash = it.dataset.ir;
    };
  }
};