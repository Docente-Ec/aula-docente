const Config = {
  defecto: {
    anioLectivo: "2026-2027", docente: "", institucion: "",
    escalaMaxima: 100, notaMinima: 70,
    periodos: ["Quimestre 1", "Quimestre 2"]
  },
  obtener() { return { ...this.defecto, ...Storage.leer("config", {}) }; },
  guardar(c) { Storage.guardar("config", c); }
};

Modulos.config = {
  render(el) {
    const c = Config.obtener();
    let periodos = [...c.periodos];
    el.innerHTML = `
      <h1>Configuración</h1>
      <p class="sub">Estos valores se usan en todos los módulos.</p>
      <div class="card form">
        <label>Año lectivo<input id="cfAnio" value="${esc(c.anioLectivo)}"></label>
        <label>Docente<input id="cfDocente" value="${esc(c.docente)}"></label>
        <label>Institución<input id="cfInst" value="${esc(c.institucion)}"></label>
        <label>Escala máxima de calificación<input id="cfMax" type="number" min="1" value="${c.escalaMaxima}"></label>
        <label>Nota mínima para aprobar<input id="cfMin" type="number" min="0" value="${c.notaMinima}"></label>
        <div>
          <div class="lbl">Períodos del año (quimestres, trimestres...)</div>
          <div id="cfPeriodos"></div>
          <button class="btn-sec" id="cfAgregar" type="button">Agregar período</button>
        </div>
        <div><button class="btn" id="cfGuardar">Guardar cambios</button> <span id="cfMsg" class="sub"></span></div>
      </div>`;

    const caja = el.querySelector("#cfPeriodos");
    const msg = el.querySelector("#cfMsg");
    const pintar = () => {
      caja.innerHTML = periodos.map((p, i) =>
        `<div class="per"><input data-i="${i}" value="${esc(p)}">
         <button class="btn-sec" data-del="${i}" type="button">Quitar</button></div>`).join("");
    };
    pintar();

    caja.addEventListener("input", e => {
      if (e.target.dataset.i !== undefined) periodos[e.target.dataset.i] = e.target.value;
    });
    caja.addEventListener("click", e => {
      const d = e.target.dataset.del;
      if (d !== undefined && periodos.length > 1) { periodos.splice(d, 1); pintar(); }
    });
    el.querySelector("#cfAgregar").onclick = () => {
      periodos.push("Período " + (periodos.length + 1)); pintar();
    };

    el.querySelector("#cfGuardar").onclick = () => {
      const max = Number(el.querySelector("#cfMax").value);
      const min = Number(el.querySelector("#cfMin").value);
      const limpios = periodos.map(p => p.trim()).filter(Boolean);
      if (!(max > 0) || min < 0 || min > max || !limpios.length) {
        msg.textContent = "Revisa los valores: la nota mínima no puede superar la escala y debe haber al menos un período.";
        return;
      }
      Config.guardar({
        anioLectivo: el.querySelector("#cfAnio").value.trim(),
        docente: el.querySelector("#cfDocente").value.trim(),
        institucion: el.querySelector("#cfInst").value.trim(),
        escalaMaxima: max, notaMinima: min, periodos: limpios
      });
      periodos = limpios; pintar();
      msg.textContent = "Guardado.";
    };
  }
};