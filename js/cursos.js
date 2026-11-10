const Cursos = {
  todos() { return Storage.leer("cursos", []); },
  guardar(lista) { Storage.guardar("cursos", lista); }
};

Modulos.cursos = {
  render(el) {
    const pintar = () => {
      const lista = Cursos.todos();
      el.innerHTML = `
        <h1>Cursos y asignaturas</h1>
        <p class="sub">Crea tus cursos y las asignaturas que dictas en cada uno.</p>
        <div class="card fila">
          <input id="cuNombre" placeholder="Ej: 8vo A" maxlength="40">
          <button class="btn" id="cuAgregar">Agregar curso</button>
        </div>
        <div class="grid-cursos">
          ${lista.map(c => `
            <div class="card" data-id="${c.id}">
              <div class="cab">
                <h2>${esc(c.nombre)}</h2>
                <div>
                  <button class="btn-sec" data-acc="renombrar">Editar</button>
                  <button class="btn-sec" data-acc="borrar">Eliminar</button>
                </div>
              </div>
              <div class="chips">
                ${c.asignaturas.map(a => `<span class="chip">${esc(a.nombre)}<button data-acc="quitar" data-asig="${a.id}" aria-label="Quitar ${esc(a.nombre)}">×</button></span>`).join("") || '<span class="sub">Sin asignaturas</span>'}
              </div>
              <div class="fila">
                <input data-nueva placeholder="Nueva asignatura" maxlength="40">
                <button class="btn-sec" data-acc="asig">Agregar</button>
              </div>
            </div>`).join("") || '<p class="sub">Aún no hay cursos.</p>'}
        </div>`;
    };
    pintar();

    el.onclick = e => {
      const b = e.target.closest("[data-acc], #cuAgregar");
      if (!b) return;
      const lista = Cursos.todos();
      const tarjeta = b.closest("[data-id]");
      const curso = tarjeta && lista.find(c => c.id === tarjeta.dataset.id);

      if (b.id === "cuAgregar") {
        const n = el.querySelector("#cuNombre").value.trim();
        if (n) lista.push({ id: Storage.nuevoId(), nombre: n, asignaturas: [] });
      } else if (b.dataset.acc === "renombrar") {
        const n = prompt("Nuevo nombre del curso:", curso.nombre);
        if (n && n.trim()) curso.nombre = n.trim();
      } else if (b.dataset.acc === "borrar") {
        if (!confirm(`¿Eliminar "${curso.nombre}" y sus asignaturas?`)) return;
        Storage.guardar("estudiantes", Storage.leer("estudiantes").filter(s => s.cursoId !== curso.id));
        lista.splice(lista.indexOf(curso), 1);
      } else if (b.dataset.acc === "asig") {
        const n = tarjeta.querySelector("[data-nueva]").value.trim();
        if (n) curso.asignaturas.push({ id: Storage.nuevoId(), nombre: n });
      } else if (b.dataset.acc === "quitar") {
        curso.asignaturas = curso.asignaturas.filter(a => a.id !== b.dataset.asig);
      }
      Cursos.guardar(lista);
      pintar();
    };

    el.onkeydown = e => {
      if (e.key !== "Enter" || e.target.tagName !== "INPUT") return;
      const b = e.target.id === "cuNombre"
        ? el.querySelector("#cuAgregar")
        : e.target.closest(".card")?.querySelector('[data-acc="asig"]');
      b?.click();
    };
  }
};