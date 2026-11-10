const vista = document.getElementById("vista");

function mostrar(nombre) {
    vista.onclick = null; vista.onkeydown = null;
    vista.onchange = null;
  const boton = document.querySelector(`[data-modulo="${nombre}"]`);
  document.querySelectorAll(".nav").forEach(b => b.classList.toggle("on", b === boton));
  if (Modulos[nombre]) {
    Modulos[nombre].render(vista);
  } else {
    vista.innerHTML = `<h1>${boton.textContent}</h1><p class="sub">Módulo en construcción.</p>`;
  }
}

document.getElementById("menu").addEventListener("click", e => {
  const b = e.target.closest(".nav");
  if (b) location.hash = b.dataset.modulo;
});

document.getElementById("btnExportar").addEventListener("click", () => Storage.exportar());
document.getElementById("btnImportar").addEventListener("click", () => document.getElementById("archivoImportar").click());
document.getElementById("archivoImportar").addEventListener("change", e => {
  const archivo = e.target.files[0];
  if (!archivo) return;
  Storage.importar(archivo, ok => {
    alert(ok ? "Respaldo importado correctamente." : "El archivo no es un respaldo válido.");
    if (ok) location.reload();
  });
});

function rutear() {
  const nombre = location.hash.slice(1);
  mostrar(document.querySelector(`[data-modulo="${nombre}"]`) ? nombre : "panel");
}
window.addEventListener("hashchange", rutear);
rutear();