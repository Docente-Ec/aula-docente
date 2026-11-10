const Modulos = {};   // cada módulo se registra aquí: Modulos.nombre = { render(el) {...} }
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const Storage = {
  prefijo: "aula:",

  leer(clave, defecto = []) {
    try {
      const v = localStorage.getItem(this.prefijo + clave);
      return v ? JSON.parse(v) : defecto;
    } catch { return defecto; }
  },

  guardar(clave, valor) {
    localStorage.setItem(this.prefijo + clave, JSON.stringify(valor));
  },

  nuevoId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  },

  exportar() {
    const datos = {};
    Object.keys(localStorage)
      .filter(k => k.startsWith(this.prefijo))
      .forEach(k => datos[k] = JSON.parse(localStorage.getItem(k)));
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "respaldo-aula-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
  },

  importar(archivo, alTerminar) {
    const lector = new FileReader();
    lector.onload = () => {
      try {
        const datos = JSON.parse(lector.result);
        Object.entries(datos).forEach(([k, v]) => {
          if (k.startsWith(this.prefijo)) localStorage.setItem(k, JSON.stringify(v));
        });
        alTerminar(true);
      } catch { alTerminar(false); }
    };
    lector.readAsText(archivo);
  }
};