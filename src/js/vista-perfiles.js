"use strict";
/* =====================================================================
   Planifica v4 — VISTA: PERFILES
   El catálogo de puestos del equipo, con su precio por hora. Es la fuente de
   la que salen los perfiles que se asignan a cada subtarea.

   Se guarda y se carga como fichero (no hay base de datos): así el catálogo
   viaja entre equipos y navegadores cuando haga falta.
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;
  const C = () => PL.calculo;
  const V = () => PL.vistas;
  const APP = () => PL.app;

  /** Una fila del catálogo: la ficha del perfil. */
  function ficha(p, ofertas) {
    const V2 = V();
    const usos = C().usosPerfil(ofertas, p.id);
    return '<div class="pa-perfil" data-id="' + p.id + '">' +
      '<div class="pa-perfil__cab">' +
        '<input class="nz-input pa-crece2" data-campo="perfil-nombre" data-id="' + p.id + '"' +
          ' value="' + N().esc(p.nombre) + '" placeholder="Puesto (p. ej. Consultor/a senior)" aria-label="Puesto">' +
        (p.esDefecto ? '<span class="nz-badge nz-badge--neutral">de fábrica</span>' : "") +
        (usos ? '<span class="nz-badge nz-badge--brand">' + usos + " uso(s)</span>" : '<span class="nz-badge nz-badge--neutral">sin usar</span>') +
      "</div>" +
      '<div class="pa-fila pa-perfil__datos">' +
        '<select class="nz-input nz-input--sm" data-campo="perfil-categoria" data-id="' + p.id + '"' +
          ' style="min-width:150px" aria-label="Categoría">' +
          PL.modelo.CATEGORIAS_PERFIL.map(c => "<option" + (p.categoria === c ? " selected" : "") + ">" + c + "</option>").join("") +
        "</select>" +
        '<label class="pa-mini pa-ahora">precio <input class="nz-input nz-input--sm pa-input-num" type="number" min="0" step="0.5"' +
          ' data-campo="perfil-tarifa" data-id="' + p.id + '" value="' + (N().num(p.tarifa) || "") + '" aria-label="Precio por hora"> €/</label>' +
        '<label class="pa-mini pa-ahora"><input class="nz-input nz-input--sm pa-input-corto" data-campo="perfil-unidad" data-id="' + p.id + '"' +
          ' value="' + N().esc(p.unidad) + '" aria-label="Unidad"></label>' +
        '<input class="nz-input nz-input--sm pa-crece" data-campo="perfil-notas" data-id="' + p.id + '"' +
          ' value="' + N().esc(p.notas || "") + '" placeholder="Notas (titulación, disponibilidad…)" aria-label="Notas">' +
        (p.esDefecto ? '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="restaurar-perfil" data-id="' + p.id + '" title="Restaurar los valores de fábrica">↺</button>' : "") +
        '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="elim-perfil" data-id="' + p.id + '" title="Eliminar o desactivar">✕</button>' +
      "</div>" +
    "</div>";
  }

  function render() {
    const V2 = V(), a = APP();
    const cont = "perfiles-cuerpo";
    if (!a.pr()) { V2.vaciar(cont); return; }
    const activos = N().lista(a.ESTADO.perfiles);
    const inactivos = N().lista(a.ESTADO.perfilesInactivos);
    const ofertas = a.ESTADO.ofertas;

    V2.escribir(cont,
      V2.articulo("Perfiles del equipo",
        '<p class="pa-mini">Tu catálogo de puestos con su precio por hora. Es global (se usa en todas las ofertas): ' +
        "guárdalo en un fichero para llevártelo a otro equipo o navegador, y cárgalo cuando quieras.</p>" +
        '<div class="pa-fila" style="margin:var(--nz-space-2) 0">' +
          '<button class="nz-btn nz-btn--primary nz-btn--sm" data-acc="nuevo-perfil">＋ Añadir perfil</button>' +
          '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="exp-perfiles">⬇ Guardar mis perfiles</button>' +
          '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="imp-perfiles">⬆ Cargar perfiles</button>' +
          '<span class="pa-espacio"></span>' +
          '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="restaurar-perfiles-defecto">↺ Los de fábrica</button>' +
        "</div>" +
        (activos.map(p => ficha(p, ofertas)).join("") ||
          '<p class="pa-mini">Sin perfiles: añade los de tu equipo con sus precios por hora.</p>') +
        (inactivos.length
          ? '<h4 class="nz-h4" style="margin-top:var(--nz-space-3)">Desactivados</h4>' +
            inactivos.map(p => '<div class="pa-dato"><span class="pa-crece">' + N().esc(p.nombre) +
              ' <span class="pa-mini">(' + N().esc(p.categoria) + " · " + N().fmtNum(p.tarifa) + " €/" + N().esc(p.unidad) + ")</span></span>" +
              '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="reactivar-perfil" data-id="' + p.id + '">Reactivar</button></div>').join("")
          : "")) +
      '<p class="pa-mini" style="margin-top:var(--nz-space-2)">Los perfiles que se están usando en alguna oferta no se borran: se desactivan, y puedes reactivarlos aquí.</p>');
  }

  PL.vistas.perfiles = { render: render };
})(typeof window !== "undefined" ? window : globalThis);
