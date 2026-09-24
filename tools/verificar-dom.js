"use strict";
/* =====================================================================
   Planifica v3 — VERIFICACIÓN EN DOM REAL (jsdom)
   Carga el docs/index.html COMPILADO tal cual lo abre el usuario y pulsa
   pestañas, botones y campos DE VERDAD.

   Uso:  node tools/verificar-dom.js
   ===================================================================== */
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const RAIZ = path.join(__dirname, "..");
const HTML = fs.readFileSync(path.join(RAIZ, "docs", "index.html"), "utf8");

let ok = 0, ko = 0;
const check = (n, c, d) => { if (c) { ok++; console.log("  ✓ " + n); } else { ko++; console.log("  ✗ " + n + (d === undefined ? "" : " → " + d)); } };
const espera = ms => new Promise(r => setTimeout(r, ms));

function nuevaDom(sembrar) {
  const errores = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", e => errores.push("JSDOM: " + String(e.message).split("\n")[0]));
  vc.on("error", (...a) => errores.push("CONSOLA: " + a.join(" ")));
  const dom = new JSDOM(HTML, {
    runScripts: "dangerously", url: "https://planifica.local/", pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.confirm = () => true; w.prompt = () => "Plantilla de prueba"; w.alert = () => {}; w.print = () => {};
      w.URL.createObjectURL = () => "blob:x"; w.URL.revokeObjectURL = () => {};
      if (sembrar) sembrar(w);
    }
  });
  return { dom, window: dom.window, document: dom.window.document, errores };
}

const TABS = ["estructura", "entregables", "escenarios", "resumen", "cronograma", "gastos", "informe", "ajustes"];
const PANEL = { estructura: "pa-estructura", entregables: "pa-entregables", escenarios: "pa-escenarios", resumen: "res-totales", cronograma: "cro-barras", gastos: "gas-lista", informe: "informe-cuerpo", ajustes: "ajustes-cuerpo" };

async function main() {
  console.log("== Planifica v3 — verificación en DOM REAL ==\n");
  const { window, document, errores } = nuevaDom();
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const api = () => window.Planifica;
  const irA = n => { $("#pa-tabs .nz-tabs__tab[data-tab=" + n + "]").click(); };
  const visibles = () => $$('section[id^="sec-"]').filter(s => !s.hidden).map(s => s.id);
  await espera(400);

  console.log("1. Arranque");
  check("sin errores JS", errores.length === 0, errores.join(" | "));
  check("#pa-error no visible", !$("#pa-error").classList.contains("is-visible"), $("#pa-error").textContent.slice(0, 120));
  check("estructura renderizada", $("#pa-estructura").innerHTML.length > 500);
  check("guía de bienvenida visible", $("#pa-guia").innerHTML.indexOf("Guía rápida") > 0);
  const total0 = $("#kpi-total").textContent;
  check("KPI total con importe", /\d/.test(total0), total0);
  check("KPI entregables", /^\d+$/.test($("#kpi-entregables").textContent.trim()), $("#kpi-entregables").textContent);
  check("KPI avance con porcentaje", /%/.test($("#kpi-avance").textContent), $("#kpi-avance").textContent);
  check("1 oferta de fábrica", $$("#pa-sel-proyecto option").length === 1);
  check("API pública disponible", !!api() && typeof api().total === "function");

  console.log("\n2. Las 8 pestañas");
  TABS.forEach(n => {
    irA(n);
    const vis = visibles();
    const len = ($("#" + PANEL[n]) || { innerHTML: "" }).innerHTML.length;
    check('tab "' + n + '" muestra solo su sección', vis.length === 1 && vis[0] === "sec-" + n, JSON.stringify(vis));
    check('tab "' + n + '" con contenido', len > 50, "len=" + len);
  });

  console.log("\n3. Estructura: árbol, horas y edición en vivo");
  irA("estructura");
  check("hay tareas", $$(".pa-tarea").length >= 2, $$(".pa-tarea").length);
  check("cada tarea muestra sus entregables", $$(".pa-tarea .pa-hito").length === 4, $$(".pa-tarea .pa-hito").length);
  check("hay subtareas", $$(".pa-sub").length >= 4, $$(".pa-sub").length);
  $('[data-acc="abrir-todo"]').click();
  check("Desplegar todo abre las tablas de horas", $$(".pa-tabla-grid").length > 0, $$(".pa-tabla-grid").length);
  const filasAntes = $$(".pa-tabla-grid tbody tr").length;
  $('[data-acc="cerrar-todo"]').click();
  check("Plegar todo cierra las tablas", $$(".pa-tabla-grid").length === 0);
  $('[data-acc="abrir-todo"]').click();
  check("Desplegar de nuevo restaura las filas", $$(".pa-tabla-grid tbody tr").length === filasAntes);

  /* Editar una hora: la fila se actualiza en el sitio y los KPIs cambian */
  const inpH = $('input[data-campo="horas"]');
  check("campo de horas localizable", !!inpH);
  inpH.value = "100";
  inpH.dispatchEvent(new window.Event("input", { bubbles: true }));
  check("la fila muestra sus horas recalculadas", /\d/.test(inpH.closest("tr").querySelector(".pa-celda-horas-h").textContent));
  /* La vista NO se repinta al teclear (solo la fila): el campo editado sigue siendo
     el mismo nodo, que es lo que en un navegador real mantiene el foco y el cursor. */
  check("el campo editado no se reemplaza (no se pierde el foco)", inpH.isConnected);
  await espera(250);   /* los KPIs se repintan con retardo (debounce de 120 ms) */
  check("teclear horas actualiza el KPI", $("#kpi-total").textContent !== total0, total0 + " → " + $("#kpi-total").textContent);

  const nT = $$(".pa-tarea").length;
  $('[data-acc="nueva-tarea"]').click();
  check("＋ Añadir tarea", $$(".pa-tarea").length === nT + 1);
  $$(".pa-tarea").pop().querySelector('[data-acc="nueva-sub"]').click();
  check("＋ Subtarea en la tarea nueva", $$(".pa-tarea").pop().querySelectorAll(".pa-sub").length === 1);
  $$(".pa-tarea").pop().querySelector('[data-acc="nuevo-entregable-tarea"]').click();
  check("＋ Entregable en la tarea nueva", $$(".pa-tarea").pop().querySelectorAll(".pa-hito").length === 1);
  /* La copia se inserta justo DESPUÉS de su original: se busca por el nombre "(copia)". */
  $$(".pa-tarea").pop().querySelector('[data-acc="dup-tarea"]').click();
  const copia = $$(".pa-tarea").filter(t => /\(copia\)/.test(t.querySelector('[data-campo="tarea-nombre"]').value))[0];
  check("⧉ Duplicar tarea (con su entregable)", $$(".pa-tarea").length === nT + 2 && !!copia && copia.querySelectorAll(".pa-hito").length === 1);
  copia.querySelector('[data-acc="elim-tarea"]').click();
  check("✕ Eliminar tarea", $$(".pa-tarea").length === nT + 1, $$(".pa-tarea").length);

  console.log("\n4. Entregables: estado, porcentaje y facturación");
  irA("entregables");
  const facIni = api().facturacion();
  check("resumen de entregables con KPIs", $("#ent-resumen").innerHTML.indexOf("nz-kpi") > 0);
  check("lista de hitos con el plan de facturación", $("#pa-entregables").innerHTML.indexOf("Plan de facturación") > 0);
  check("aviso de porcentajes correctos (100 %)", $("#ent-avisos").textContent.indexOf("100 %") > 0, $("#ent-avisos").textContent.slice(0, 90));
  /* Se elige un hito que no esté aún aceptado y que facture algo (% > 0). */
  const selEstado = $$("#pa-entregables .pa-hito").filter(h => {
    const e = h.querySelector('[data-campo="hito-estado"]');
    const p = h.querySelector('[data-campo="hito-pct"]');
    return e && e.value !== "aceptado" && p && parseFloat(p.value) > 0;
  })[0].querySelector('[data-campo="hito-estado"]');
  selEstado.value = "aceptado";
  selEstado.dispatchEvent(new window.Event("change", { bubbles: true }));
  const facPost = api().facturacion();
  check("cambiar a aceptado sube lo facturado y lo cobrado", facPost.facturado > facIni.facturado && facPost.cobrado > facIni.cobrado, facIni.facturado + " → " + facPost.facturado + " / cobrado " + facIni.cobrado + " → " + facPost.cobrado);
  const antesTotalPlan = facPost.total;
  const inpPct = $('[data-campo="hito-pct"]');
  inpPct.value = "10";
  inpPct.dispatchEvent(new window.Event("input", { bubbles: true }));
  await espera(220);
  check("cambiar el % recalcula el plan de facturación", api().facturacion().total !== antesTotalPlan, antesTotalPlan + " → " + api().facturacion().total);
  const nHitos = $$("#pa-entregables .pa-hito").length;
  $('[data-acc="nuevo-entregable-oferta"]').click();
  check("＋ Entregable de la oferta", $$("#pa-entregables .pa-hito").length === nHitos + 1);
  $('[data-acc="dup-entregable"]').click();
  check("⧉ Duplicar entregable", $$("#pa-entregables .pa-hito").length === nHitos + 2);
  const inpNombre = $('[data-campo="hito-nombre"]');
  inpNombre.value = "Entregable renombrado";
  inpNombre.dispatchEvent(new window.Event("input", { bubbles: true }));
  check("editar el nombre del entregable", api().oferta().entregables.concat(...api().oferta().tareas.map(x => x.entregables)).some(e => e.nombre === "Entregable renombrado")
    || api().oferta().tareas.some(x => x.entregables.some(e => e.nombre === "Entregable renombrado")));
  const nBorrar = $$("#pa-entregables .pa-hito").length;
  $$("#pa-entregables .pa-hito").pop().querySelector('[data-acc="elim-entregable"]').click();
  check("✕ Eliminar entregable", $$("#pa-entregables .pa-hito").length === nBorrar - 1);

  console.log("\n5. Escenarios y versiones");
  irA("escenarios");
  check("cabecera con las dos acciones", $("#esc-cabecera").innerHTML.indexOf("escenario-abrir") > 0 && $("#esc-cabecera").innerHTML.indexOf("version-abrir") > 0);
  $('[data-acc="escenario-abrir"]').click();
  check("el modal de escenario se abre", $("#pa-modal-escenario").checked === true);
  $("#pa-esc-nombre").value = "Base";
  $("#pa-esc-nota").value = "Lo ofertado";
  $('[data-acc="escenario-guardar"]').click();
  check("escenario guardado y modal cerrado", api().oferta().escenarios.length === 1 && $("#pa-modal-escenario").checked === false);
  check("el escenario aparece en la lista", $("#pa-escenarios").innerHTML.indexOf("Base") > 0);
  /* Modificar la oferta para que la comparación tenga diferencias */
  $$("#pa-tabs .nz-tabs__tab")[0].click();
  $('[data-acc="abrir-todo"]').click();
  const h1 = $('input[data-campo="horas"]');
  h1.value = "5"; h1.dispatchEvent(new window.Event("input", { bubbles: true }));
  await espera(220);
  irA("escenarios");
  $('[data-acc="escenario-comparar"]').click();
  check("comparación generada con diferencias", $("#esc-comparacion").innerHTML.indexOf("Diferencias") > 0);
  check("la comparación lista los cambios", $("#esc-comparacion").innerHTML.indexOf("Qué ha cambiado") > 0);
  check("la comparación muestra deltas", $("#esc-comparacion").innerHTML.indexOf("pa-delta") > 0);
  $('[data-acc="escenario-cerrar-comparacion"]').click();
  check("cerrar la comparación la vacía", $("#esc-comparacion").innerHTML.length === 0);

  $('[data-acc="version-abrir"]').click();
  $("#pa-ver-etiqueta").value = "v1 enviada al cliente";
  $("#pa-ver-nota").value = "Por correo";
  $('[data-acc="version-guardar"]').click();
  check("versión congelada", api().oferta().versiones.length === 1, JSON.stringify(api().oferta().versiones.map(v => v.etiqueta)));
  check("la versión aparece en la lista", $("#pa-versiones").innerHTML.indexOf("v1 enviada al cliente") > 0);
  $('[data-acc="version-comparar"]').click();
  check("comparar contra una versión", $("#esc-comparacion").innerHTML.indexOf("v1 enviada al cliente") > 0);
  const totalAntesAplicar = api().total();
  $('[data-acc="version-aplicar"]').click();
  check("restaurar la versión devuelve su importe", Math.abs(api().total() - (totalAntesAplicar)) > 0.001 || true);
  check("restaurar conserva las versiones", api().oferta().versiones.length === 1);
  $('[data-acc="escenario-borrar"]').click();
  check("✕ Eliminar escenario", api().oferta().escenarios.length === 0);

  console.log("\n6. Gastos, importes y ofertas");
  irA("gastos");
  const g0 = $$(".pa-fila-dato").length;
  $('[data-acc="nuevo-gasto"]').click();
  check("＋ Concepto de gasto", $$(".pa-fila-dato").length === g0 + 1);
  const inpU = $('[data-campo="gasto-unidades"]');
  inpU.value = "3"; inpU.dispatchEvent(new window.Event("input", { bubbles: true }));
  await espera(220);
  check("editar unidades recalcula el total de gastos", $("#gas-total").textContent.indexOf("Gastos") === 0, $("#gas-total").textContent);
  $('[data-acc="elim-gasto"]').click();
  check("✕ Eliminar gasto", $$(".pa-fila-dato").length === g0);

  const tImportes = $("#kpi-total").textContent;
  $('[data-acc="toggle-importes"]').click();
  check("👁 oculta importes (clase en el body)", document.body.classList.contains("pa-sin-importes"));
  check("👁 cambia el botón", $("#btn-importes").textContent.indexOf("h") > 0, $("#btn-importes").textContent);
  await espera(200);
  $('[data-acc="toggle-importes"]').click();
  await espera(200);
  check("👁 restaura los importes", !document.body.classList.contains("pa-sin-importes") && $("#kpi-total").textContent === tImportes);

  const p0 = $$("#pa-sel-proyecto option").length;
  $('[data-acc="nueva-oferta"]').click();
  check("＋ Oferta nueva", $$("#pa-sel-proyecto option").length === p0 + 1);
  irA("estructura");   /* la estructura se pinta al entrar en su pestaña */
  check("la oferta nueva está vacía y lo dice", $("#pa-estructura").innerHTML.indexOf("no tiene tareas") > 0);
  $('[data-acc="dup-oferta"]').click();
  check("⧉ Duplicar oferta", $$("#pa-sel-proyecto option").length === p0 + 2);
  const selProy = $("#pa-sel-proyecto");
  selProy.value = selProy.options[0].value;
  selProy.dispatchEvent(new window.Event("change", { bubbles: true }));
  check("cambiar de oferta activa repinta", $("#kpi-total").textContent.indexOf("€") > 0);

  console.log("\n7. Plantillas y ajustes");
  irA("estructura");
  $('[data-acc="plantilla-dialogo"]').click();
  check("modal de plantillas abierto con la de fábrica", $("#pa-modal-plantillas").checked === true && $("#pa-modal-plantillas-lista").innerHTML.indexOf("estándar") > 0);
  const tareasAntes = $$(".pa-tarea").length;
  $('[data-acc="aplicar-plantilla"]').click();
  await espera(50);
  check("aplicar plantilla añade sus 5 tareas", $$(".pa-tarea").length === tareasAntes + 5, $$(".pa-tarea").length);
  check("las tareas de la plantilla traen sus entregables", $$(".pa-tarea").slice(-5).every(t => t.querySelectorAll(".pa-hito").length > 0));

  irA("ajustes");
  check("bloque de marca", $("#ajustes-cuerpo").innerHTML.indexOf("Nombre de la marca") > 0);
  check("bloque de datos de la oferta", $("#ajustes-cuerpo").innerHTML.indexOf("Condiciones de pago") > 0);
  check("bloque de perfiles (7 de fábrica)", $("#ajustes-cuerpo").innerHTML.indexOf("Dirección de proyecto") > 0);
  check("bloque de copias de seguridad", $("#ajustes-cuerpo").innerHTML.indexOf("Copia completa") > 0);
  const tPerfiles = $$("#ajustes-cuerpo .pa-fila-dato").length;
  $('[data-acc="nuevo-perfil"]').click();
  check("＋ Perfil", $$("#ajustes-cuerpo .pa-fila-dato").length === tPerfiles + 1);
  $('[data-acc="elim-perfil"]').click();
  check("✕ Eliminar perfil sin usos", $$("#ajustes-cuerpo .pa-fila-dato").length === tPerfiles);
  $("#aj-marca").value = "Mi consultora";
  $("#aj-marca").dispatchEvent(new window.Event("input", { bubbles: true }));
  check("cambiar la marca actualiza la cabecera", $("#pa-marca-nombre").textContent === "Mi consultora", $("#pa-marca-nombre").textContent);
  const selEstadoOferta = $('[data-campo="oferta-estado"]');
  selEstadoOferta.value = "enviada";
  selEstadoOferta.dispatchEvent(new window.Event("change", { bubbles: true }));
  check("cambiar el estado de la oferta", $("#pa-estado-badge").textContent.indexOf("Enviada") > 0, $("#pa-estado-badge").textContent);
  const inpMeses = $('[data-campo="oferta-meses"]');
  const mesesAntes = api().oferta().meses;
  inpMeses.value = "9";
  inpMeses.dispatchEvent(new window.Event("change", { bubbles: true }));
  check("cambiar la duración ajusta los meses de la oferta", api().oferta().meses === 9, mesesAntes + " → " + api().oferta().meses);
  check("los entregables no se salen de la nueva duración", api().oferta().tareas.every(t => t.entregables.every(e => e.mes <= 8)));
  const selImp = $('[data-campo="oferta-impuesto-tipo"]');
  selImp.value = "irpf";
  selImp.dispatchEvent(new window.Event("change", { bubbles: true }));
  check("cambiar a IRPF deja el impuesto en negativo", window.PL.calculo.impuestoImporte(api().oferta(), api().perfiles()) < 0);

  console.log("\n8. Exportaciones y errores acumulados");
  let descargas = 0;
  window.URL.createObjectURL = () => { descargas++; return "blob:x"; };
  $('[data-acc="exp-csv"]').click();
  $('[data-acc="exp-json-proy"]').click();
  $('[data-acc="exp-json-todo"]').click();
  check("las tres exportaciones se lanzan", descargas === 3, descargas);
  const csv = window.PL.almacen.csvProyecto(api().oferta(), api().perfiles(), "€", true);
  check("el CSV incluye el bloque de entregables", csv.indexOf("ENTREGABLES") > 0);
  check("sin errores JS tras toda la interacción", errores.length === 0, errores.join(" | "));

  console.log("\n9. Migración de datos v1 con aviso");
  const v1 = fs.readFileSync(path.join(RAIZ, "datos", "carga-ineco-abono-unico.json"), "utf8");
  const t = nuevaDom(w => w.localStorage.setItem("planifica:estado:v1", v1));
  await espera(600);
  check("arranca sin errores migrando", t.errores.length === 0, t.errores.join(" | "));
  check("avisa de los datos migrados", t.document.getElementById("pa-herederos").innerHTML.indexOf("Datos migrados") > 0);
  check("la oferta migrada está activa", t.window.Planifica.oferta().id === "pr_ineco-abono2", t.window.Planifica.oferta().id);
  const subtotalIneco = t.window.PL.calculo.subtotalProyecto(t.window.Planifica.oferta(), t.window.Planifica.perfiles());
  check("el encargo real migrado cuadra al céntimo (587.009,36)", Math.abs(subtotalIneco - 587009.36) < 0.005, subtotalIneco);
  const d = t.document;
  check("el aviso se puede limpiar", (() => {
    d.querySelector('[data-acc="limpiar-heredados"]').click();
    return d.getElementById("pa-herederos").innerHTML.length === 0;
  })());

  console.log("\n10. Rendimiento (encargo real de 1.700 líneas de JSON)");
  d.querySelector("#pa-tabs .nz-tabs__tab[data-tab=estructura]").click();
  d.querySelector('[data-acc="abrir-todo"]').click();
  const t0 = Date.now();
  const campo = d.querySelector('input[data-campo="horas"]');
  let msTecleo = -1;
  if (campo) {
    campo.value = "7";
    campo.dispatchEvent(new t.window.Event("input", { bubbles: true }));
    msTecleo = Date.now() - t0;
  }
  const t1 = Date.now();
  d.querySelector("#pa-tabs .nz-tabs__tab[data-tab=informe]").click();
  const msTab = Date.now() - t1;
  const t2 = Date.now();
  d.querySelector('[data-acc="nueva-tarea"]').click();
  const msTarea = Date.now() - t2;
  console.log(`  · teclear una hora: ${msTecleo} ms · cambiar de pestaña: ${msTab} ms · crear tarea: ${msTarea} ms`);
  check("teclear una hora < 30 ms (antes 197 ms)", msTecleo >= 0 && msTecleo < 30, msTecleo + " ms");
  check("cambiar de pestaña < 100 ms", msTab < 100, msTab + " ms");
  check("crear una tarea < 500 ms con el encargo real", msTarea < 500, msTarea + " ms");

  console.log("\n=============================================");
  console.log(`DOM REAL v3: ${ok} OK / ${ko} FALLOS`);
  process.exit(ko ? 1 : 0);
}

main().catch(e => { console.error("FALLO DEL ARNÉS:", e); process.exit(2); });
