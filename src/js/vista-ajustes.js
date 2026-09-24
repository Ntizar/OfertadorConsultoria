"use strict";
/* =====================================================================
   Planifica v3 — VISTA: AJUSTES
   Marca blanca, datos de la oferta activa, biblioteca de perfiles,
   plantillas de tareas y copias de seguridad.
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;
  const M = () => PL.modelo;
  const C = () => PL.calculo;
  const EL = () => PL.entregables;
  const V = () => PL.vistas;
  const A = () => PL.almacen;
  const APP = () => PL.app;

  function bloqueMarca() {
    const V2 = V(), a = APP();
    const m = a.ESTADO.marca;
    return V2.articulo("Marca",
      '<div class="nz-formgrid nz-formgrid--2">' +
        '<label class="nz-field"><span class="nz-field__label">Nombre de la marca</span><input class="nz-input" id="aj-marca" value="' + N().esc(m.nombre || "") + '"></label>' +
        '<label class="nz-field"><span class="nz-field__label">Lema / subtítulo</span><input class="nz-input" id="aj-sub" value="' + N().esc(m.sub || "") + '"></label>' +
        '<label class="nz-field"><span class="nz-field__label">Moneda</span><input class="nz-input pa-input-corto" id="aj-moneda" value="' + N().esc(m.moneda || "€") + '" maxlength="4"></label>' +
        '<div class="nz-field"><span class="nz-field__label">Logo</span><span class="pa-fila">' +
          '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="cargar-logo">🖼 Cargar logo</button>' +
          (m.logo ? '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="quitar-logo">Quitar</button>' : "") +
        '</span><span class="nz-field__help">Se guarda dentro de tus datos (no se sube a ningún sitio).</span></div>' +
      "</div>" +
      '<label class="nz-switch" style="margin-top:var(--nz-space-2)"><input type="checkbox" id="aj-importes"' + (a.ESTADO.mostrarImportes ? " checked" : "") + '><span class="nz-switch__track"><span class="nz-switch__thumb"></span></span><span class="nz-switch__label">Mostrar importes (€)</span></label>');
  }

  function camposOferta(pr) {
    const t = pr.impuestos || {}, d = pr.descuento || {};
    return '<div class="nz-formgrid nz-formgrid--2">' +
      '<label class="nz-field"><span class="nz-field__label">Cliente</span><input class="nz-input" data-campo="oferta-cliente-nombre" value="' + N().esc(pr.cliente.nombre || "") + '" placeholder="Nombre del cliente"></label>' +
      '<label class="nz-field"><span class="nz-field__label">Persona de contacto</span><input class="nz-input" data-campo="oferta-cliente-contacto" value="' + N().esc(pr.cliente.contacto || "") + '" placeholder="Nombre · email · teléfono"></label>' +
      '<label class="nz-field"><span class="nz-field__label">Referencia / expediente</span><input class="nz-input" data-campo="oferta-cliente-ref" value="' + N().esc(pr.cliente.ref || "") + '"></label>' +
      '<label class="nz-field"><span class="nz-field__label">Estado de la oferta</span><select class="nz-input" data-campo="oferta-estado">' +
        Object.keys(M().ESTADOS_OFERTA).map(k => '<option value="' + k + '"' + (pr.estado === k ? " selected" : "") + ">" + M().ESTADOS_OFERTA[k].texto + "</option>").join("") + "</select></label>" +
      '<label class="nz-field"><span class="nz-field__label">Fecha de la oferta</span><input class="nz-input pa-input-fecha" type="date" data-campo="oferta-fecha" value="' + N().esc(pr.fecha || "") + '"></label>' +
      '<label class="nz-field"><span class="nz-field__label">Validez (días)</span><input class="nz-input pa-input-num" type="number" min="0" data-campo="oferta-validez" value="' + (N().num(pr.validezDias) || 30) + '"></label>' +
      '<label class="nz-field"><span class="nz-field__label">Inicio de ejecución</span><input class="nz-input pa-input-fecha" type="month" data-campo="oferta-inicio" value="' + N().esc(pr.fechaInicio || "") + '"></label>' +
      '<label class="nz-field"><span class="nz-field__label">Duración (meses)</span><input class="nz-input pa-input-num" type="number" min="1" max="60" data-campo="oferta-meses" value="' + (pr.meses || 12) + '"></label>' +
      '<label class="nz-field pa-ancho"><span class="nz-field__label">Condiciones de pago</span><input class="nz-input" data-campo="oferta-pago" value="' + N().esc(pr.condicionesPago || "") + '" placeholder="Ej.: facturación por entregables aceptados, a 30 días"></label>' +
      '<label class="nz-field pa-ancho"><span class="nz-field__label">Descripción / alcance</span><textarea class="nz-input" rows="2" data-campo="oferta-desc">' + N().esc(pr.descripcion || "") + "</textarea></label>" +
      '<label class="nz-field"><span class="nz-field__label">Impuesto</span><select class="nz-input" data-campo="oferta-impuesto-tipo">' +
        '<option value="iva"' + (t.tipo === "iva" ? " selected" : "") + ">IVA (se añade)</option>" +
        '<option value="irpf"' + (t.tipo === "irpf" ? " selected" : "") + ">IRPF (retención)</option>" +
        '<option value="ninguno"' + (!t.tipo || t.tipo === "ninguno" ? " selected" : "") + ">Sin impuestos</option></select></label>" +
      '<label class="nz-field"><span class="nz-field__label">Tipo %</span><input class="nz-input pa-input-num" type="number" min="0" max="100" step="0.5" data-campo="oferta-impuesto-tasa" value="' + N().num(t.tasa === undefined ? 21 : t.tasa) + '"></label>' +
      '<label class="nz-field"><span class="nz-field__label">Descuento</span><select class="nz-input" data-campo="oferta-descuento-tipo">' +
        '<option value=""' + (!d.tipo ? " selected" : "") + ">Sin descuento</option>" +
        '<option value="%"' + (d.tipo === "%" ? " selected" : "") + ">Porcentaje</option>" +
        '<option value="fijo"' + (d.tipo === "fijo" ? " selected" : "") + ">Importe fijo</option></select></label>" +
      '<label class="nz-field"><span class="nz-field__label">Valor del descuento</span><input class="nz-input pa-input-num" type="number" min="0" step="0.01" data-campo="oferta-descuento-valor" value="' + (N().num(d.valor) || "") + '"></label>' +
      '<label class="nz-switch"><input type="checkbox" data-campo="oferta-impuesto-incluido"' + (t.incluido ? " checked" : "") + '><span class="nz-switch__track"><span class="nz-switch__thumb"></span></span><span class="nz-switch__label">Impuesto ya incluido en los precios</span></label>' +
      "</div>";
  }

  function bloqueOferta(pr) {
    const V2 = V();
    return V2.articulo("Datos de la oferta activa", camposOferta(pr));
  }

  function filaPerfil(pr, p) {
    const usos = C().usosPerfil([pr], p.id);
    return '<div class="pa-fila-dato" data-id="' + p.id + '">' +
      '<input class="nz-input pa-crece2" data-campo="perfil-nombre" data-id="' + p.id + '" value="' + N().esc(p.nombre) + '">' +
      '<select class="nz-input nz-input--sm" data-campo="perfil-categoria" data-id="' + p.id + '" style="min-width:150px">' +
        M().CATEGORIAS_PERFIL.map(c => "<option" + (p.categoria === c ? " selected" : "") + ">" + c + "</option>").join("") + "</select>" +
      '<label class="pa-mini">Tarifa <input class="nz-input nz-input--sm pa-input-num" type="number" step="0.01" min="0" data-campo="perfil-tarifa" data-id="' + p.id + '" value="' + (N().num(p.tarifa) || "") + '"></label>' +
      '<label class="pa-mini">Ud <input class="nz-input nz-input--sm pa-input-corto" data-campo="perfil-unidades" data-id="' + p.id + '" value="' + N().esc(p.unidades || "h") + '"></label>' +
      (p.esDefecto ? '<span class="nz-badge nz-badge--neutral">defecto</span><button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="restaurar-perfil" data-id="' + p.id + '" title="Restaurar valores de fábrica">↺</button>' : "") +
      '<span class="pa-mini">' + usos + " usos</span>" +
      '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="elim-perfil" data-id="' + p.id + '" title="Eliminar o desactivar">✕</button>' +
      "</div>";
  }

  function bloquePerfiles(pr) {
    const V2 = V(), a = APP();
    const activos = N().lista(a.ESTADO.perfiles);
    const inactivos = N().lista(a.ESTADO.perfilesInactivos);
    return V2.articulo("Perfiles del equipo",
      '<p class="pa-mini">Biblioteca global: se usa en todas tus ofertas. Los perfiles «por defecto» se pueden editar y ↺ los restaura. Exporta la biblioteca para llevarla a otro navegador.</p>' +
      '<div class="pa-fila" style="margin:var(--nz-space-2) 0">' +
        '<button class="nz-btn nz-btn--primary nz-btn--sm" data-acc="nuevo-perfil">＋ Perfil</button>' +
        '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="restaurar-perfiles-defecto" title="Recrea los 7 perfiles de fábrica que falten">↺ Defectos</button>' +
        '<span class="pa-espacio"></span>' +
        '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="exp-biblio">⬇ Exportar biblioteca</button>' +
      "</div>" +
      (activos.map(p => filaPerfil(pr, p)).join("") || '<p class="pa-mini">Sin perfiles. Añade perfiles de tu equipo con sus tarifas.</p>') +
      (inactivos.length
        ? '<h4 class="nz-h4" style="margin-top:var(--nz-space-3)">Desactivados</h4>' + inactivos.map(p =>
          '<div class="pa-fila-dato"><span class="pa-crece">' + N().esc(p.nombre) + ' <span class="pa-mini">(' + N().esc(p.categoria) + ")</span></span>" +
          '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="reactivar-perfil" data-id="' + p.id + '">Reactivar</button></div>').join("")
        : ""));
  }

  function bloquePlantillas(pr) {
    const V2 = V(), a = APP();
    const pls = N().lista(a.ESTADO.plantillas);
    return V2.articulo("Plantillas de tareas recurrentes",
      '<p class="pa-mini">Guarda estructuras de tareas (con sus subtareas y entregables) y aplícalas con un clic.</p>' +
      '<div class="pa-fila" style="margin:var(--nz-space-2) 0">' +
        '<button class="nz-btn nz-btn--primary nz-btn--sm" data-acc="guardar-plantilla">💾 Guardar estructura actual como plantilla</button>' +
        '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="restaurar-plantillas-defecto">↺ Defectos</button>' +
      "</div>" +
      (pls.map(pl =>
        '<div class="pa-fila-dato">' +
          '<span class="pa-crece2"><strong>' + N().esc(pl.nombre) + "</strong>" + (pl.esDefecto ? ' <span class="nz-badge nz-badge--neutral">por defecto</span>' : "") +
          '<br><span class="pa-mini">' + N().esc(pl.desc || "") + " · " + N().lista(pl.tareas).length + " tareas · " +
          N().suma(pl.tareas, t => N().lista(t.entregables).length) + " entregables</span></span>" +
          '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="plantilla-dialogo">Aplicar…</button>' +
          '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="elim-plantilla" data-id="' + pl.id + '" title="Eliminar plantilla">✕</button>' +
        "</div>").join("") || '<p class="pa-mini">Sin plantillas.</p>'));
    void pr;
  }

  function bloqueDatos() {
    const V2 = V();
    const a = APP();
    const heredados = A().datosHeredados();
    return V2.articulo("Datos y copias de seguridad",
      '<div class="pa-fila">' +
        '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="exp-json-todo">⬇ Copia completa (JSON)</button>' +
        '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="imp-json">⬆ Importar JSON</button>' +
        '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="exp-csv">⬇ CSV de la oferta</button>' +
        '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="imprimir">🖨 Informe PDF</button>' +
      "</div>" +
      '<p class="pa-mini" style="margin-top:var(--nz-space-2)">Todo se guarda solo en este navegador. Nadie más ve tus datos.</p>' +
      (heredados.length
        ? '<div class="nz-callout nz-callout--warning" style="margin-top:var(--nz-space-2)"><p><strong>Hay datos de una versión anterior</strong> guardados en este navegador (' +
          heredados.map(N().esc).join(", ") + "). Se pueden borrar sin miedo: la app ya trabaja con los datos actuales.</p>" +
          '<button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="limpiar-heredados">Borrar los datos antiguos</button></div>'
        : "") +
      '<div class="pa-fila" style="margin-top:var(--nz-space-3)">' +
        '<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="restaurar-ejemplo">Volver al ejemplo de inicio</button>' +
        '<button class="nz-btn nz-btn--danger nz-btn--sm" data-acc="borrar-todo">Borrar todos los datos</button>' +
      "</div>" +
      '<p class="pa-mini" style="margin-top:var(--nz-space-3)">Esta oferta: ' + C().mesesProyecto(a.pr()) + " meses · " +
      EL().porEstado(a.pr()).total + " entregable(s) · " + N().lista(a.pr().escenarios).length + " escenario(s) · " +
      N().lista(a.pr().versiones).length + " versión(es).</p>");
  }

  function render() {
    const V2 = V(), a = APP();
    const pr = a.pr();
    if (!pr) { V2.vaciar("ajustes-cuerpo"); return; }
    V2.escribir("ajustes-cuerpo",
      bloqueMarca() + bloqueOferta(pr) + bloquePerfiles(pr) + bloquePlantillas(pr) + bloqueDatos());
  }

  PL.vistas.ajustes = { render: render };
})(typeof window !== "undefined" ? window : globalThis);
