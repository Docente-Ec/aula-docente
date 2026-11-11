const falla = m => Object.assign(new Error(m), { claro: true });

const Nube = {
  url: "https://kfkxvggnchdtvxrmfmwz.supabase.co",
  clave: "sb_publishable_hJDIVKi1fgToDx9s0BAiKQ_y0eG4-gX",
  K: "docenteec-sb",          // sesión
  P: "docenteec-pendiente",   // hay cambios sin subir
  D: "docenteec-dueno",       // de quién son los datos de este navegador
  _cola: {}, _t: null, _ref: null,

  // ---------- sesión ----------
  sesion() {
    try { return JSON.parse(localStorage.getItem(this.K) || sessionStorage.getItem(this.K)); }
    catch { return null; }
  },
  guardarSesion(s, recordar) {
    const enLocal = recordar === undefined ? !!localStorage.getItem(this.K) : recordar;
    (enLocal ? localStorage : sessionStorage).setItem(this.K, JSON.stringify(s));
  },
  quitarSesion() { localStorage.removeItem(this.K); sessionStorage.removeItem(this.K); },

  async entrar(correo, clave, recordar) {
    let r;
    try {
      r = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: this.clave, "Content-Type": "application/json" },
        body: JSON.stringify({ email: correo, password: clave })
      });
    } catch { throw falla("No hay conexión con el servidor."); }
    if (!r.ok) throw falla(r.status === 400 ? "Correo o contraseña incorrectos." : "No se pudo iniciar sesión. Intenta de nuevo.");
    const d = await r.json();
    const s = { token: d.access_token, refresh: d.refresh_token, expira: Date.now() + d.expires_in * 1000,
                id: d.user.id, correo: d.user.email, rol: "docente" };
    this.quitarSesion();
    this.guardarSesion(s, recordar);
    const p = await this.rest(`perfiles?select=rol&id=eq.${s.id}`);
    s.rol = p[0]?.rol === "admin" ? "admin" : "docente";
    this.guardarSesion(s);
    return s;
  },

  token() {
    const s = this.sesion();
    if (!s) return Promise.reject(new Error("sin sesión"));
    if (Date.now() < s.expira - 60000) return Promise.resolve(s.token);
    this._ref ||= fetch(`${this.url}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: { apikey: this.clave, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: s.refresh })
      })
      .then(r => { if (!r.ok) throw new Error("sesión vencida"); return r.json(); })
      .then(d => {
        const n = this.sesion() || s;
        Object.assign(n, { token: d.access_token, refresh: d.refresh_token, expira: Date.now() + d.expires_in * 1000 });
        this.guardarSesion(n);
        return n.token;
      })
      .finally(() => { this._ref = null; });
    return this._ref;
  },

  async rest(ruta, opc = {}) {
    const t = await this.token();
    const r = await fetch(`${this.url}/rest/v1/${ruta}`, { ...opc,
      headers: { apikey: this.clave, Authorization: "Bearer " + t, "Content-Type": "application/json", ...(opc.headers || {}) } });
    if (!r.ok) throw new Error("Error " + r.status);
    const txt = await r.text();
    return txt ? JSON.parse(txt) : null;
  },

  // ---------- datos ----------
  clavesLocales() { return Object.keys(localStorage).filter(k => k.startsWith(Storage.prefijo)); },
  limpiarLocal() { this.clavesLocales().forEach(k => localStorage.removeItem(k)); },

  async bajar(userId) {
    const filas = await this.rest(`datos?select=clave,valor&user_id=eq.${userId}`);
    this.limpiarLocal();
    filas.forEach(f => localStorage.setItem(Storage.prefijo + f.clave, JSON.stringify(f.valor)));
  },

  async enviar(pares) {
    const s = this.sesion();
    const filas = Object.entries(pares).map(([clave, valor]) =>
      ({ user_id: s.id, clave, valor, actualizado: new Date().toISOString() }));
    if (filas.length) await this.rest("datos?on_conflict=user_id,clave", {
      method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(filas) });
  },

  async subirTodo() {
    localStorage.setItem(this.P, "1");
    const pares = {};
    this.clavesLocales().forEach(k => pares[k.slice(Storage.prefijo.length)] = JSON.parse(localStorage.getItem(k)));
    await this.enviar(pares);
    localStorage.removeItem(this.P);
  },

  subir(clave, valor) {            // lo llama Storage.guardar (solo docentes)
    this._cola[clave] = valor;
    localStorage.setItem(this.P, "1");
    clearTimeout(this._t);
    this._t = setTimeout(() => this.vaciar(), 700);
  },

  async vaciar() {
    const cola = this._cola; this._cola = {};
    try {
      await this.enviar(cola);
      if (!Object.keys(this._cola).length) localStorage.removeItem(this.P);
    } catch { /* queda pendiente; se reintenta al abrir la app */ }
  },

  // Al iniciar sesión
  async prepararDatos(s) {
    const dueno = localStorage.getItem(this.D);
    const legado = this.clavesLocales().length > 0 && !dueno;   // datos de antes de existir las cuentas
    if (s.rol === "admin") {
      if (legado) Storage.exportar();                           // respaldo automático
      this.limpiarLocal();
      localStorage.setItem(this.D, "admin");
      return;
    }
    if (dueno && dueno !== s.id) { this.limpiarLocal(); localStorage.removeItem(this.P); }
    const hayNube = (await this.rest(`datos?select=clave&user_id=eq.${s.id}&limit=1`)).length > 0;
    const pendiente = dueno === s.id && localStorage.getItem(this.P);
    if (pendiente || (!hayNube && legado)) await this.subirTodo();
    else await this.bajar(s.id);
    localStorage.setItem(this.D, s.id);
  },

  // Al abrir la app con la sesión recordada
  async iniciar() {
    const s = this.sesion();
    await this.token();
    if (s.rol === "admin") { if (s.viendo) await this.bajar(s.viendo.id); return; }
    if (localStorage.getItem(this.P)) await this.subirTodo(); else await this.bajar(s.id);
  },

  async cerrar() {
    if (localStorage.getItem(this.P)) {
      try { await this.subirTodo(); }
      catch { if (!confirm("Hay cambios sin sincronizar. Si cierras sesión se perderán. ¿Cerrar sesión de todos modos?")) return false; }
    }
    clearTimeout(this._t); this._cola = {};
    this.quitarSesion();
    this.limpiarLocal();
    [this.P, this.D].forEach(k => localStorage.removeItem(k));
    return true;
  },

  // Administrador: carga los datos de un docente (solo lectura)
  async ver(u) {
    await this.bajar(u.id);
    const s = this.sesion();
    s.viendo = { id: u.id, correo: u.correo };
    this.guardarSesion(s);
  }
};