"use strict";
/* =====================================================================
   Planifica v4 — VISTA: AJUSTES
   Marca blanca, biblioteca de perfiles, plantillas y datos (copias,
   importación y datos heredados de versiones anteriores).
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;
  const C = () => PL.calculo;
  const V = () => PL.vistas;
  const A = () => PL.almacen;
  const APP = () => PL.app;

  function marca(a) {
    const V2 = V();
    const m = a.ESTADO.marca;
    return V2.articulo("Marca",
      '<div class="nz-formgrid nz-formgrid--2">' +
        '<label class="nz-field"><span class="nz-field__label">Nombre de la marca</span><input class="nz-input" id="aj-marca" value="' + N().esc(m.nombre) + '"></label>' +
        '<label class="nz-field"><span class="nz-field__label">Lema / subtítulo</span><input class="nz-input" id="aj-sub" value="' + N().esc(m.sub) + '"></label>' +
        '<label class="nz-field"><span class="nz-field__label">Moneda</span><input class="nz-input pa-input-corto" id="aj-moneda" value="' + N().esc(m.moneda) + '" maxlength="4"></label>' +
        '<div class="nz-field"><span class="nz-field__label">Logo</span>' +
          '<span class="pa-fila"><button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="cargar-logo">🖼 Cargar logo</button>' +
          (m.logo ? '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="quitar-logo">Quitar</button>' : "") + "</span>" +
          '<span class="nz-field__help">Se guarda dentro de tus datos: no se sube a ningún sitio.</span></div>' +
      "</div>" +
      '<label class="nz-switch" style="margin-top:var(--nz-space-2)"><input type="checkbox" id="aj-importes"' + (a.ESTADO.mostrarImportes ? " checked" : "") + '>' +
      '<span class="nz-switch__track"><span class="nz-switch__thumb"></span></span>' +
      '<span class="nz-switch__label">Mostrar los importes (€)</span></label>');
  }

  function perfiles(a) {
    const V2 = V(), o = a.pr();
    const activos = N().lista(a.ESTADO.perfiles);
    const inactivos = N().lista(a.ESTADO.perfilesInactivos);
    const filas = activos.map(p => {
      const usos = C().usosPerfil(a.ESTADO.ofertas, p.id);
      return '<div class="pa-dato" data-id="' + p.id + '">' +
        '<input class="nz-input pa-crece2" data-campo="perfil-nombre" data-id="' + p.id + '" value="' + N().esc(p.nombre) + '">' +
        '<select class="nz-input nz-input--sm" data-campo="perfil-categoria" data-id="' + p.id + '" style="min-width:145px">' +
          PL.modelo.CATEGORIAS_PERFIL.map(c => "<option" + (p.categoria === c ? " selected" : "") + ">" + c + "</option>").join("") +
        "</select>" +
        '<label class="pa-mini pa-ahora">tarifa <input class="nz-input nz-input--sm pa-input-num" type="number" min="0" step="0.01" data-campo="perfil-tarifa" data-id="' + p.id + '" value="' + (N().num(p.tarifa) || "") + '"></label>' +
        '<label class="pa-mini pa-ahora">ud <input class="nz-input nz-input--sm pa-input-corto" data-campo="perfil-unidad" data-id="' + p.id + '" value="' + N().esc(p.unidad) + '"></label>' +
        (p.esDefecto ? '<span class="nz-badge nz-badge--neutral">fábrica</span><button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="restaurar-perfil" data-id="' + p.id + '" title="Restaurar valores de fábrica">↺</button>' : "") +
        '<span class="pa-mini pa-ahora">' + usos + " uso(s)</span>" +
        '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="elim-perfil" data-id="' + p.id + '" title="Eliminar o desactivar">✕</button>' +
      "</div>";
    }).join("");

    return V2.articulo("Perfiles del equipo",
      '<p class="pa-mini">Biblioteca global: se usa en todas las ofertas. Los perfiles «de fábrica» se restauran con ↺. Llévate la biblioteca a otro navegador exportándola.</p>' +
      '<div class="pa-fila" style="margin:var(--nz-space-2) 0">' +
        '<button class="nz-btn nz-btn--primary nz-btn--sm" data-acc="nuevo-perfil">＋ Perfil</button>' +
        '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="restaurar-perfiles-defecto">↺ Perfiles de fábrica</button>' +
        '<span class="pa-espacio"></span>' +
        '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="exp-biblio">⬇ Exportar biblioteca</button>' +
      "</div>" +
      (filas || '<p class="pa-mini">Sin perfiles: añade los de tu equipo con sus tarifas.</p>') +
      (inactivos.length
        ? '<h4 class="nz-h4" style="margin-top:var(--nz-space-3)">Desactivados</h4>' + inactivos.map(p =>
          '<div class="pa-dato"><span class="pa-crece">' + N().esc(p.nombre) + ' <span class="pa-mini">(' + N().esc(p.categoria) + ")</span></span>" +
          '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="reactivar-perfil" data-id="' + p.id + '">Reactivar</button></div>').join("")
        : ""));
    void o;
  }

  function datos(a) {
    const V2 = V();
    const heredados = A().datosHeredados();
    const o = a.pr();
    return V2.articulo("Datos y copias de seguridad",
      '<div class="pa-fila">' +
        '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="exp-json-todo">⬇ Copia completa (JSON)</button>' +
        '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="imp-json">⬆ Importar JSON</button>' +
        '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="exp-csv">⬇ CSV de la oferta</button>' +
        '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="imprimir">🖨 Informe PDF</button>' +
      "</div>" +
      '<p class="pa-mini" style="margin-top:var(--nz-space-2)">Todo se guarda solo en este navegador: nadie más ve tus datos. ' +
      "Si importas una oferta o una copia, se descarga antes una copia de seguridad de lo que tenías.</p>" +
      (heredados.length
        ? '<div class="nz-callout nz-callout--warning" style="margin-top:var(--nz-space-2)"><p><strong>Hay datos de versiones anteriores</strong> en este navegador (' +
          heredados.map(N().esc).join(", ") + "). No se han tocado: puedes traerlos, descargar una copia o descartarlos.</p>" +
          '<div class="pa-fila">' +
          '<button class="nz-btn nz-btn--primary nz-btn--sm" data-acc="traer-heredados">📥 Traer mis ofertas antiguas</button>' +
          '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="descargar-heredados">⬇ Descargar copia</button>' +
          '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="limpiar-heredados">Descartar</button>' +
          "</div></div>" 
        : "") +
      '<div class="pa-fila" style="margin-top:var(--nz-space-3)">' +
        '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="restaurar-ejemplo">Volver al ejemplo de inicio</button>' +
        '<button class="nz-btn nz-btn--danger nz-btn--sm" data-acc="borrar-todo">Borrar todos los datos</button>' +
      "</div>" +
      '<p class="pa-mini" style="margin-top:var(--nz-space-3)">Esta oferta: ' + N().esc(PL.periodos.duracionLegible(o.periodos)) +
      " · " + PL.entregables.porContexto(o).total + " entregable(s) · " + N().lista(o.fotos).length + " foto(s) guardada(s).</p>");
  }

  function render() {
    const V2 = V(), a = APP();
    if (!a.pr()) { V2.vaciar("ajustes-cuerpo"); return; }
    V2.escribir("ajustes-cuerpo", marca(a) + perfiles(a) + datos(a));
  }

  PL.vistas.ajustes = { render: render };
})(typeof window !== "undefined" ? window : globalThis);
