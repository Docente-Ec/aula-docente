const Estudiantes = {
  todos() { return Storage.leer("estudiantes", []); },
  guardar(l) { Storage.guardar("estudiantes", l); },
  deCurso(id) {
    return this.todos().filter(s => s.cursoId === id)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }
};

Modulos.estudiantes = {
  cursoSel: null,
  render(el) {
    const cursos = Cursos.todos();
    if (!cursos.length) {
      el.innerHTML = `<h1>Estudiantes</h1><p class="sub">Primero crea un curso en el módulo Cursos.</p>`;
      return;
    }
    if (!cursos.some(c => c.id === this.cursoSel)) this.cursoSel = cursos[0].id;

    // Convierte texto pegado o CSV en una lista de nombres
    const leerNombres = texto => {
      const filas = texto.split(/\r?\n/)
        .map(l => l.split(/[;\t]/).map(c => c.replace(/"/g, "").trim()).filter(Boolean).join(" "))
        .filter(Boolean);
      if (filas.length && /^(apellidos|nombres?|estudiantes?)\b/i.test(filas[0])) filas.shift();
      return filas;
    };

    const agregar = nombres => {
      const lista = Estudiantes.todos();
      const existentes = new Set(lista.filter(s => s.cursoId === this.cursoSel).map(s => s.nombre.toLowerCase()));
      let n = 0;
      nombres.forEach(nom => {
        nom = nom.trim();
        if (nom && !existentes.has(nom.toLowerCase())) {
          lista.push({ id: Storage.nuevoId(), cursoId: this.cursoSel, nombre: nom });
          existentes.add(nom.toLowerCase());
          n++;
        }
      });
      Estudiantes.guardar(lista);
      return n;
    };

    const pintar = (msg = "") => {
      const alumnos = Estudiantes.deCurso(this.cursoSel);
      el.innerHTML = `
        <h1>Estudiantes</h1>
        <p class="sub">Total en el curso: ${alumnos.length}</p>
        <div class="fila"><select id="esCurso">
          ${cursos.map(c => `<option value="${c.id}" ${c.id === this.cursoSel ? "selected" : ""}>${esc(c.nombre)}</option>`).join("")}
        </select></div>
        <div class="card fila">
          <input id="esNombre" placeholder="Apellidos y nombres" maxlength="80">
          <button class="btn" id="esAgregar">Agregar</button>
        </div>
        <div class="card form" style="max-width:none">
          <label>Agregar varios (uno por línea; puedes pegar una columna de Excel)
            <textarea id="esVarios" rows="4"></textarea></label>
          <div class="fila" style="margin:0">
            <button class="btn-sec" id="esLista">Agregar lista</button>
            <button class="btn-sec" id="esCsv">Importar archivo CSV</button>
            <input type="file" id="esArchivo" accept=".csv,.txt" hidden>
            <span class="sub">${esc(msg)}</span>
          </div>
        </div>
        <div class="card tabla-wrap">
          <table class="tabla">
            <thead><tr><th>#</th><th>Apellidos y nombres</th><th></th></tr></thead>
            <tbody>
              ${alumnos.map((s, i) => `<tr data-id="${s.id}"><td>${i + 1}</td><td>${esc(s.nombre)}</td>
                <td class="der"><button class="btn-sec" data-acc="editar">Editar</button>
                <button class="btn-sec" data-acc="borrar">Eliminar</button></td></tr>`).join("")
                || `<tr><td colspan="3" class="sub">Sin estudiantes en este curso.</td></tr>`}
            </tbody>
          </table>
        </div>`;
    };
    pintar();

    el.onchange = e => {
      if (e.target.id === "esCurso") { this.cursoSel = e.target.value; pintar(); }
      else if (e.target.id === "esArchivo" && e.target.files[0]) {
        const lector = new FileReader();
        lector.onload = () => {
          const n = agregar(leerNombres(lector.result));
          pintar(`${n} estudiante(s) importado(s).`);
        };
        lector.readAsText(e.target.files[0]);
      }
    };

    el.onclick = e => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.id === "esAgregar") {
        const n = agregar([el.querySelector("#esNombre").value]);
        pintar(n ? "" : "Nombre vacío o ya existente.");
      } else if (b.id === "esLista") {
        const n = agregar(leerNombres(el.querySelector("#esVarios").value));
        pintar(`${n} estudiante(s) agregado(s).`);
      } else if (b.id === "esCsv") {
        el.querySelector("#esArchivo").click();
      } else if (b.dataset.acc) {
        const lista = Estudiantes.todos();
        const s = lista.find(x => x.id === b.closest("tr").dataset.id);
        if (b.dataset.acc === "editar") {
          const n = prompt("Apellidos y nombres:", s.nombre);
          if (n && n.trim()) s.nombre = n.trim();
        } else if (confirm(`¿Eliminar a "${s.nombre}"?`)) {
          lista.splice(lista.indexOf(s), 1);
        } else return;
        Estudiantes.guardar(lista);
        pintar();
      }
    };

    el.onkeydown = e => {
      if (e.key === "Enter" && e.target.id === "esNombre") el.querySelector("#esAgregar").click();
    };
  }
};