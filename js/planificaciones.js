const CAMPOS_DEFECTO = ["Duración", "Objetivo de aprendizaje", "Destrezas o contenidos",
  "Actividades de inicio", "Actividades de desarrollo", "Actividades de cierre",
  "Recursos", "Evaluación", "Observaciones"].map((nombre, i) => ({ id: "c" + (i + 1), nombre }));

/* ---------- Utilidades para rellenar un .docx ---------- */
const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const PARTES = /^word\/(document|header\d*|footer\d*)\.xml$/;
const norm = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const padreP = n => { let x = n.parentNode; while (x && !(x.localName === "p" && x.namespaceURI === W_NS)) x = x.parentNode; return x; };
const leerBase64 = a => new Promise((ok, mal) => {
  const r = new FileReader();
  r.onload = () => ok(r.result.split(",")[1]);
  r.onerror = mal;
  r.readAsDataURL(a);
});
const textosDe = p => Array.from(p.getElementsByTagNameNS(W_NS, "t")).filter(n => padreP(n) === p);

// Nombres de los marcadores {{...}} que aparecen en un XML de Word
function marcadoresDe(xml) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const nombres = new Set();
  Array.from(doc.getElementsByTagNameNS(W_NS, "p")).forEach(p => {
    const txt = textosDe(p).map(n => n.textContent).join("");
    for (const c of txt.matchAll(/\{\{([^{}]+?)\}\}/g)) nombres.add(c[1].trim());
  });
  return [...nombres];
}

// Word suele partir un marcador en varios "runs": se trabaja con el texto completo del párrafo
function rellenarParrafo(doc, p, valores) {
  const nodos = textosDe(p);
  if (!nodos.length) return;
  const originales = nodos.map(n => n.textContent);
  const textos = originales.slice();
  const total = originales.join("");
  if (!total.includes("{{")) return;
  const inicios = []; let acc = 0;
  originales.forEach(t => { inicios.push(acc); acc += t.length; });

  const reemplazos = [];
  const coincidencias = [...total.matchAll(/\{\{([^{}]+?)\}\}/g)];
  for (let m = coincidencias.length - 1; m >= 0; m--) {   // de atrás hacia adelante
    const c = coincidencias[m];
    const valor = valores[norm(c[1])];
    if (valor === undefined) continue;                    // sin campo: se deja el marcador visible
    const ini = c.index, fin = ini + c[0].length;
    const k = reemplazos.push(valor) - 1;
    let primero = true;
    nodos.forEach((n, i) => {
      const a = inicios[i], b = a + originales[i].length;
      if (!(a < fin && b > ini)) return;
      const desde = Math.max(ini - a, 0), hasta = Math.min(fin - a, originales[i].length);
      textos[i] = textos[i].slice(0, desde) + (primero ? `\u0001${k}\u0002` : "") + textos[i].slice(hasta);
      primero = false;
    });
  }

  const nuevoT = txt => {
    const e = doc.createElementNS(W_NS, "w:t");
    e.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
    e.textContent = txt;
    return e;
  };
  nodos.forEach((n, i) => {
    if (textos[i] === originales[i]) return;
    const nuevos = [];
    textos[i].split(/\u0001(\d+)\u0002/).forEach((pz, j) => {
      if (j % 2 === 0) { if (pz) nuevos.push(nuevoT(pz)); }
      else String(reemplazos[Number(pz)]).split(/\r?\n/).forEach((linea, q) => {
        if (q > 0) nuevos.push(doc.createElementNS(W_NS, "w:br"));
        nuevos.push(nuevoT(linea));
      });
    });
    nuevos.forEach(e => n.parentNode.insertBefore(e, n));
    n.parentNode.removeChild(n);
  });
}

function rellenarXml(xml, valores) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("XML inválido");
  Array.from(doc.getElementsByTagNameNS(W_NS, "p")).forEach(p => rellenarParrafo(doc, p, valores));
  let out = new XMLSerializer().serializeToString(doc);
  if (!out.startsWith("<?xml")) out = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + out;
  return out;
}

/* ---------- Datos ---------- */
const Planificaciones = {
  todas() { return Storage.leer("planificaciones", []); },
  guardar(l) { Storage.guardar("planificaciones", l); },
  campos() { return Storage.leer("plantilla", null) || CAMPOS_DEFECTO.map(c => ({ ...c })); },
  guardarCampos(l) { Storage.guardar("plantilla", l); },
  formato() { return Storage.leer("formato_docx", null); },   // { nombre, datos (base64), marcadores }

  // Valores disponibles para los marcadores, por nombre normalizado
  valores(p, cfg) {
    const curso = Cursos.todos().find(c => c.id === p.cursoId);
    const asig = curso?.asignaturas.find(a => a.id === p.asigId);
    const m = {};
    const dato = (nombres, v) => nombres.forEach(n => m[norm(n)] = v ?? "");
    dato(["docente"], cfg.docente);
    dato(["institución"], cfg.institucion);
    dato(["año lectivo", "año"], cfg.anioLectivo);
    dato(["curso"], curso?.nombre);
    dato(["asignatura"], asig?.nombre);
    dato(["fecha"], p.fecha ? fechaCorta(p.fecha) : "");
    dato(["título"], p.titulo);
    this.campos().forEach(c => m[norm(c.nombre)] = (p.valores || {})[c.id] ?? "");
    return m;
  },

  descargarBlob(blob, nombre) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nombre.replace(/[\\/:*?"<>|\s]+/g, "_");
    a.click();
    URL.revokeObjectURL(a.href);
  },

  async subirFormato(archivo) {
    if (typeof JSZip === "undefined") { alert("Falta la librería JSZip. Revisa que js/lib/jszip.min.js exista y esté en index.html."); return false; }
    if (!/\.docx$/i.test(archivo.name)) { alert("El archivo debe ser un Word .docx"); return false; }
    try {
      const zip = await JSZip.loadAsync(await archivo.arrayBuffer());
      const marcadores = new Set();
      for (const r of Object.keys(zip.files).filter(r => PARTES.test(r)))
        marcadoresDe(await zip.file(r).async("string")).forEach(m => marcadores.add(m));
      const datos = await leerBase64(archivo);
      try {
        Storage.guardar("formato_docx", { nombre: archivo.name, datos, marcadores: [...marcadores] });
      } catch {
        alert("El archivo es demasiado grande para guardarse en el navegador (límite aproximado de 5 MB).");
        return false;
      }
      return true;
    } catch (err) {
      console.error(err);
      alert("No se pudo leer el archivo. Comprueba que sea un .docx válido.");
      return false;
    }
  },

  async descargarFormato(p, cfg) {
    const f = this.formato();
    if (!f) return;
    if (typeof JSZip === "undefined") { alert("Falta la librería JSZip."); return; }
    try {
      const zip = await JSZip.loadAsync(f.datos, { base64: true });
      const valores = this.valores(p, cfg);
      for (const ruta of Object.keys(zip.files).filter(r => PARTES.test(r)))
        zip.file(ruta, rellenarXml(await zip.file(ruta).async("string"), valores));
      const blob = await zip.generateAsync({
        type: "blob", compression: "DEFLATE",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      });
      this.descargarBlob(blob, `planificacion-${p.titulo}.docx`);
    } catch (err) {
      console.error(err);
      alert("No se pudo generar el documento con tu formato. Comprueba que el .docx sea válido.");
    }
  },

  // Documento genérico (sin formato propio), usado para imprimir/PDF y Word simple
  html(p, cfg) {
    const curso = Cursos.todos().find(c => c.id === p.cursoId);
    const asig = curso?.asignaturas.find(a => a.id === p.asigId);
    const datos = [["Docente", cfg.docente], ["Institución", cfg.institucion], ["Año lectivo", cfg.anioLectivo],
      ["Curso", curso?.nombre], ["Asignatura", asig?.nombre], ["Fecha", fechaCorta(p.fecha)]];
    const txt = v => esc(v ?? "").replace(/\n/g, "<br>");
    return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${esc(p.titulo)}</title>
<style>
body{font-family:Arial,sans-serif;font-size:12pt;color:#000}
h1{font-size:18pt;margin:0 0 4pt} h2{font-size:13pt;margin:0 0 10pt;font-weight:normal}
table{border-collapse:collapse;width:100%;margin-bottom:12pt}
td,th{border:1px solid #444;padding:6pt;vertical-align:top;text-align:left}
th{background:#eee;width:28%}
</style></head><body>
<h1>Planificación</h1><h2>${esc(p.titulo)}</h2>
<table>${datos.map(([k, v]) => `<tr><th>${k}</th><td>${txt(v)}</td></tr>`).join("")}</table>
<table>${this.campos().map(c => `<tr><th>${esc(c.nombre)}</th><td>${txt((p.valores || {})[c.id])}</td></tr>`).join("")}</table>
</body></html>`;
  },

  imprimir(html) {
    const f = document.createElement("iframe");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(f);
    f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
    f.contentWindow.onafterprint = () => f.remove();
    setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); }, 300);
  },

  descargarWord(p, cfg) {
    const html = this.html(p, cfg).replace("<html ",
      '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40" ');
    this.descargarBlob(new Blob(["\ufeff", html], { type: "application/msword" }), `planificacion-${p.titulo}.doc`);
  }
};

/* ---------- Pantalla ---------- */
Modulos.planificaciones = {
  sel: {},
  vista: "lista",   // "lista" | "editor" | "plantilla"
  abierta: null,

  render(el) {
    const cfg = Config.obtener();
    const cursos = Cursos.todos();
    const s = this.sel;
    if (!cursos.length) {
      el.innerHTML = `<h1>Planificaciones</h1><p class="sub">Primero crea un curso y sus asignaturas.</p>`;
      return;
    }
    let campos = Planificaciones.campos();

    const pintarPlantilla = () => {
      const f = Planificaciones.formato();
      const conocidos = Planificaciones.valores({}, cfg);
      const sinCampo = f ? f.marcadores.filter(m => !(norm(m) in conocidos)) : [];
      const disponibles = ["Docente", "Institución", "Año lectivo", "Curso", "Asignatura", "Fecha", "Título", ...campos.map(c => c.nombre)];
      el.innerHTML = `
        <h1>Plantilla de planificación</h1>
        <p class="sub">Define los campos de tus planificaciones. Docente, institución, año lectivo, curso, asignatura y fecha se agregan solos.</p>
        <div class="card form">
          <div>${campos.map((c, i) => `<div class="per"><input data-i="${i}" value="${esc(c.nombre)}" maxlength="60" aria-label="Nombre del campo">
            <button class="btn-sec" data-del="${i}">Quitar</button></div>`).join("")}</div>
          <div class="fila" style="margin:0;flex-wrap:wrap">
            <button class="btn-sec" id="plAgregar">Agregar campo</button>
            <button class="btn-sec" id="plRestablecer">Restablecer</button>
            <button class="btn" id="plListo">Listo</button>
          </div>
        </div>

        <div class="card form" style="margin-top:16px">
          <div class="lbl">Formato propio (.docx)</div>
          <p class="sub" style="margin:0">${f
            ? `Cargado: <b>${esc(f.nombre)}</b> · ${f.marcadores.length} marcador(es) encontrado(s).`
            : "Aún no has subido un formato; mientras tanto se usa el documento genérico."}</p>
          ${sinCampo.length ? `<p class="sub" style="margin:0;color:var(--alerta-texto);font-weight:600">Sin campo equivalente: ${sinCampo.map(m => `{{${esc(m)}}}`).join(", ")}. Renombra un campo de arriba o corrige el marcador en tu Word.</p>` : ""}
          <div class="fila" style="margin:0;flex-wrap:wrap">
            <button class="btn-sec" id="fSubir">${f ? "Reemplazar formato" : "Subir formato (.docx)"}</button>
            ${f ? '<button class="btn-sec" id="fQuitar">Quitar formato</button>' : ""}
            <input type="file" id="fArchivo" accept=".docx" hidden>
          </div>
      
        </div>`;
    };

    const pintarEditor = () => {
      const p = Planificaciones.todas().find(x => x.id === this.abierta);
      if (!p) { this.vista = "lista"; pintar(); return; }
      const curso = cursos.find(c => c.id === p.cursoId);
      const asig = curso?.asignaturas.find(a => a.id === p.asigId);
      const v = p.valores || {};
      const f = Planificaciones.formato();
      el.innerHTML = `
        <div class="fila" style="margin-top:0;flex-wrap:wrap;justify-content:space-between">
          <button class="btn-sec" id="pVolver">← Volver</button>
          <div class="acc">
            <button class="btn-sec" id="pImprimir">Imprimir / PDF</button>
            ${f ? `<button class="btn-sec" id="pWord">Word genérico</button>
                   <button class="btn" id="pWordF">Descargar con tu formato</button>`
                : `<button class="btn" id="pWord">Descargar Word</button>`}
          </div>
        </div>
        <h1 style="margin-top:16px">Planificación</h1>
        <p class="sub">${esc(curso?.nombre ?? "")} · ${esc(asig?.nombre ?? "")}</p>
        <div class="card form" style="max-width:860px">
          <label>Título<input data-p="titulo" value="${esc(p.titulo)}" maxlength="100"></label>
          <label>Fecha<input data-p="fecha" type="date" value="${p.fecha}"></label>
          ${campos.map(c => `<label>${esc(c.nombre)}<textarea data-c="${c.id}" rows="3">${esc(v[c.id] ?? "")}</textarea></label>`).join("")}
        </div>`;
    };

    const pintarLista = () => {
      if (!cursos.some(c => c.id === s.curso)) { s.curso = cursos[0].id; s.asig = null; }
      const curso = cursos.find(c => c.id === s.curso);
      if (!curso.asignaturas.some(a => a.id === s.asig)) s.asig = curso.asignaturas[0]?.id || null;

      const cabecera = `
        <h1>Planificaciones</h1>
        <p class="sub">Crea, duplica y exporta tus planificaciones.</p>
        <div class="fila" style="flex-wrap:wrap">
          <select id="pCurso">${cursos.map(c => `<option value="${c.id}" ${c.id === s.curso ? "selected" : ""}>${esc(c.nombre)}</option>`).join("")}</select>
          <select id="pAsig">${curso.asignaturas.map(a => `<option value="${a.id}" ${a.id === s.asig ? "selected" : ""}>${esc(a.nombre)}</option>`).join("")}</select>
          <button class="btn-sec" id="pPlantilla">Editar plantilla y formato</button>
        </div>`;

      if (!s.asig) {
        el.innerHTML = cabecera + `<p class="sub" style="margin-top:20px">Este curso no tiene asignaturas. Agrégalas en el módulo Cursos.</p>`;
        return;
      }

      const lista = Planificaciones.todas()
        .filter(p => p.cursoId === s.curso && p.asigId === s.asig)
        .sort((a, b) => (a.fecha || "9999").localeCompare(b.fecha || "9999"));

      el.innerHTML = cabecera + `
        <div class="card fila" style="flex-wrap:wrap">
          <input id="pTitulo" placeholder="Nueva planificación (Ej: Unidad 1 · Fracciones)" maxlength="100">
          <input id="pFecha" type="date" style="flex:none" aria-label="Fecha">
          <button class="btn" id="pCrear">Crear y abrir</button>
        </div>
        ${lista.map(p => `<div class="card tarea" data-id="${p.id}">
          <div class="cab">
            <div><h2>${esc(p.titulo)}</h2><div class="mut">${fechaCorta(p.fecha)}</div></div>
            <div class="acc">
              <button class="btn" data-acc="abrir">Abrir</button>
              <button class="btn-sec" data-acc="duplicar">Duplicar</button>
              <button class="btn-sec" data-acc="borrar">Eliminar</button>
            </div>
          </div></div>`).join("") || '<p class="sub" style="margin-top:20px">Aún no hay planificaciones para esta asignatura.</p>'}`;
    };

    const pintar = () => {
      if (this.vista === "plantilla") pintarPlantilla();
      else if (this.vista === "editor") pintarEditor();
      else pintarLista();
    };
    pintar();

    // Los textos se guardan al salir de cada casilla
    el.onchange = e => {
      const t = e.target;
      if (t.id === "pCurso") { s.curso = t.value; s.asig = null; pintar(); }
      else if (t.id === "pAsig") { s.asig = t.value; pintar(); }
      else if (t.id === "fArchivo") {
        if (t.files[0]) Planificaciones.subirFormato(t.files[0]).then(ok => { if (ok) pintar(); });
      }
      else if (this.vista === "editor") {
        const l = Planificaciones.todas();
        const p = l.find(x => x.id === this.abierta);
        if (!p) return;
        if (t.dataset.p === "titulo") {
          if (!t.value.trim()) { t.value = p.titulo; return; }
          p.titulo = t.value.trim();
        } else if (t.dataset.p === "fecha") p.fecha = t.value;
        else if (t.dataset.c) { p.valores = p.valores || {}; p.valores[t.dataset.c] = t.value; }
        Planificaciones.guardar(l);
      }
      else if (this.vista === "plantilla" && t.dataset.i !== undefined) {
        const c = campos[t.dataset.i];
        if (t.value.trim()) c.nombre = t.value.trim(); else t.value = c.nombre;
        Planificaciones.guardarCampos(campos);
        pintar();
      }
    };

    el.onclick = e => {
      const b = e.target.closest("button");
      if (!b) return;
      const l = Planificaciones.todas();

      if (b.id === "pCrear") {
        const titulo = el.querySelector("#pTitulo").value.trim();
        if (!titulo) return;
        const p = { id: Storage.nuevoId(), cursoId: s.curso, asigId: s.asig, titulo,
          fecha: el.querySelector("#pFecha").value, valores: {} };
        l.push(p);
        Planificaciones.guardar(l);
        this.abierta = p.id; this.vista = "editor";
        pintar(); window.scrollTo(0, 0);
      }
      else if (b.id === "pPlantilla") { campos = Planificaciones.campos(); this.vista = "plantilla"; pintar(); }
      else if (b.id === "plAgregar") {
        campos.push({ id: Storage.nuevoId(), nombre: "Nuevo campo" });
        Planificaciones.guardarCampos(campos);
        pintar();
      }
      else if (b.id === "plRestablecer") {
        if (!confirm("¿Restablecer la plantilla a los campos iniciales?")) return;
        campos = CAMPOS_DEFECTO.map(c => ({ ...c }));
        Planificaciones.guardarCampos(campos);
        pintar();
      }
      else if (b.id === "fSubir") el.querySelector("#fArchivo").click();
      else if (b.id === "fQuitar") {
        if (!confirm("¿Quitar el formato subido? Volverá a usarse el documento genérico.")) return;
        localStorage.removeItem(Storage.prefijo + "formato_docx");
        pintar();
      }
      else if (b.id === "plListo" || b.id === "pVolver") { this.vista = "lista"; pintar(); }
      else if (b.dataset.del !== undefined) {
        if (campos.length <= 1) return;
        if (!confirm("¿Quitar este campo de la plantilla? Sus textos dejarán de mostrarse.")) return;
        campos.splice(Number(b.dataset.del), 1);
        Planificaciones.guardarCampos(campos);
        pintar();
      }
      else if (b.id === "pImprimir" || b.id === "pWord" || b.id === "pWordF") {
        const p = l.find(x => x.id === this.abierta);
        if (!p) return;
        if (b.id === "pImprimir") Planificaciones.imprimir(Planificaciones.html(p, cfg));
        else if (b.id === "pWord") Planificaciones.descargarWord(p, cfg);
        else Planificaciones.descargarFormato(p, cfg);
      }
      else if (b.dataset.acc) {
        const p = l.find(x => x.id === b.closest("[data-id]").dataset.id);
        if (!p) return;
        if (b.dataset.acc === "abrir") { this.abierta = p.id; this.vista = "editor"; pintar(); window.scrollTo(0, 0); }
        else if (b.dataset.acc === "duplicar") {
          l.push({ ...p, id: Storage.nuevoId(), titulo: p.titulo + " (copia)", valores: { ...(p.valores || {}) } });
          Planificaciones.guardar(l);
          pintar();
        }
        else if (b.dataset.acc === "borrar") {
          if (!confirm(`¿Eliminar la planificación "${p.titulo}"?`)) return;
          Planificaciones.guardar(l.filter(x => x.id !== p.id));
          pintar();
        }
      }
    };

    el.onkeydown = e => {
      if (e.key === "Enter" && e.target.id === "pTitulo") el.querySelector("#pCrear").click();
    };
  }
};