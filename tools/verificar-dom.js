"use strict";
/* =====================================================================
   Planifica — verificación en DOM REAL (jsdom)
   Carga el docs/index.html COMPILADO tal cual lo abre el usuario, ejecuta
   la app de verdad y pulsa pestañas y botones de verdad.
   Cubre lo que tools/verificar.js (DOM falso) no puede ver: estructura del
   documento, delegación de eventos, visibilidad de pestañas y rendimiento.

   Uso:  node tools/verificar-dom.js
   ===================================================================== */
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const RAIZ = path.join(__dirname, "..");
const HTML = fs.readFileSync(path.join(RAIZ, "docs", "index.html"), "utf8");

let ok = 0, ko = 0;
const check = (n, c, d) => { if (c) { ok++; console.log("  ✓ " + n); } else { ko++; console.log("  ✗ " + n + (d ? " → " + d : "")); } };
const espera = ms => new Promise(r => setTimeout(r, ms));

/* Crea un DOM con la app. beforeParse sirve para stubs (confirm/prompt/print) y
   para presembrar localStorage antes de que corra el script de la app. */
function nuevaDom(sembrar) {
  const errores = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", e => errores.push("JSDOM: " + String(e.message).split("\n")[0]));
  vc.on("error", (...a) => errores.push("CONSOLA: " + a.join(" ")));
  const dom = new JSDOM(HTML, {
    runScripts: "dangerously", url: "https://planifica.local/", pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(window) {
      /* jsdom no implementa los diálogos nativos: sin esto, confirm/prompt/print
         emiten errores y el flujo de borrado no puede probarse. */
      window.confirm = () => true;
      window.prompt = () => "Plantilla de prueba";
      window.alert = () => {};
      window.print = () => {};
      if (!window.URL.createObjectURL) window.URL.createObjectURL = () => "blob:falso";
      window.URL.revokeObjectURL = () => {};
      if (sembrar) sembrar(window);
    }
  });
  return { dom, window: dom.window, document: dom.window.document, errores };
}

async function main() {
  console.log("== Planifica — auditoría en DOM REAL (docs/index.html compilado) ==\n");
  const { window, document, errores } = nuevaDom();
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const tabs = () => $$("#pa-tabs .nz-tabs__tab");
  const seccionesVisibles = () => $$("section[id^=sec-]").filter(s => !s.hidden).map(s => s.id);
  const irA = n => tabs().find(t => t.dataset.tab === n).click();
  await espera(400);

  console.log("1. Arranque");
  check("sin errores JS en consola", errores.length === 0, errores.join(" | "));
  check("#pa-error no visible", !$("#pa-error").classList.contains("is-visible"), $("#pa-error").textContent.slice(0, 140));
  check("estructura renderizada", $("#pa-estructura").innerHTML.length > 200);
  check("KPI total con importe", /\d/.test($("#kpi-total").textContent), "kpi='" + $("#kpi-total").textContent + "'");
  check("guía de bienvenida visible", $("#pa-guia").innerHTML.includes("Guía rápida"));
  check("estado de fábrica: 1 oferta", $$("#pa-sel-proyecto option").length === 1, $$("#pa-sel-proyecto option").length + " opciones");
  const totalInicial = $("#kpi-total").textContent;

  console.log("\n2. Pestañas: cada tab muestra SOLO su sección");
  tabs().forEach(t => {
    irA(t.dataset.tab);
    const vis = seccionesVisibles();
    const esperada = "sec-" + t.dataset.tab;
    const idPanel = { estructura: "pa-estructura", resumen: "res-totales", cronograma: "cro-barras", gastos: "gas-lista", informe: "informe-cuerpo", ajustes: "ajustes-cuerpo" }[t.dataset.tab];
    check(`tab "${t.dataset.tab}" → visible solo #${esperada}`, vis.length === 1 && vis[0] === esperada, "visibles=" + JSON.stringify(vis));
    const len = (($("#" + idPanel) || { innerHTML: "" }).innerHTML || "").length;
    check(`tab "${t.dataset.tab}" con contenido`, len > 50, "len=" + len);
    check(`tab "${t.dataset.tab}" marcado aria-selected`, t.getAttribute("aria-selected") === "true");
  });

  console.log("\n3. Estructura: desplegar, crear, duplicar, borrar");
  irA("estructura");
  const nSubs = $$(".pa-sub").length;
  check("hay subtareas de partida", nSubs > 0, nSubs + " subtareas");
  $('[data-acc="abrir-todo"]').click();
  /* Las subtareas sin líneas no pintan tabla: se cuenta cuántas aparecen desplegadas. */
  const conTabla = $$(".pa-tabla-grid").length;
  check("Desplegar todo abre las subtareas con horas", conTabla > 0 && conTabla <= nSubs, conTabla + " tablas de " + nSubs + " subtareas");
  $('[data-acc="cerrar-todo"]').click();
  check("Plegar todo cierra todas", $$(".pa-tabla-grid").length === 0);
  $('[data-acc="abrir-todo"]').click();
  check("Desplegar todo es idempotente", $$(".pa-tabla-grid").length === conTabla, $$(".pa-tabla-grid").length + "/" + conTabla);
  $('[data-acc="cerrar-todo"]').click();
  const nT = $$(".pa-tarea").length;
  $('[data-acc="nueva-tarea"]').click();
  check("＋ Añadir tarea", $$(".pa-tarea").length === nT + 1);
  const nueva = $$(".pa-tarea").pop();
  nueva.querySelector('[data-acc="nueva-sub"]').click();
  /* La app re-renderiza el árbol: el nodo anterior queda huérfano, hay que re-consultar. */
  check("＋ Subtarea dentro de la tarea nueva", $$(".pa-tarea").pop().querySelectorAll(".pa-sub").length === 1);
  $$(".pa-tarea").pop().querySelector(".pa-sub").querySelector('[data-acc="toggle-sub"]').click();
  $$(".pa-tarea").pop().querySelector(".pa-sub").querySelector('[data-acc="nueva-linea"]').click();
  const subAbierta = $$(".pa-tarea").pop().querySelector(".pa-sub");
  check("＋ Perfil crea una línea en la subtarea", subAbierta.querySelectorAll(".pa-tabla-grid tbody tr").length === 1);
  const inpH = subAbierta.querySelector('input[data-campo="horas"]');
  check("campo de horas localizable", !!inpH);
  if (inpH) {
    inpH.value = "10";
    inpH.dispatchEvent(new window.Event("input", { bubbles: true }));
    check("editar horas recalcula el KPI (delegación input)", $("#kpi-total").textContent !== totalInicial, "antes=" + totalInicial + " ahora=" + $("#kpi-total").textContent);
  }
  subAbierta.querySelector('[data-acc="dup-sub"]').click();
  check("⧉ Duplicar subtarea", $$(".pa-tarea").pop().querySelectorAll(".pa-sub").length === 2);
  $$(".pa-tarea").pop().querySelector('[data-acc="elim-tarea"]').click();
  check("✕ Eliminar tarea (confirm aceptado)", $$(".pa-tarea").length === nT, $$(".pa-tarea").length + " vs " + nT);

  console.log("\n4. Modo importes y gastos");
  $('[data-acc="toggle-importes"]').click();
  check("👁 oculta importes", document.body.classList.contains("pa-modo-oculto"));
  check("👁 cambia el botón", $("#btn-importes").textContent.includes("h"), $("#btn-importes").textContent);
  $('[data-acc="toggle-importes"]').click();
  check("👁 restaura importes", !document.body.classList.contains("pa-modo-oculto"));
  irA("gastos");
  const g0 = $$(".pa-fila-gasto").length;
  $('[data-acc="nueva-gasto"]').click();
  check("＋ Concepto de gasto", $$(".pa-fila-gasto").length === g0 + 1);
  $('[data-acc="elim-gasto"]').click();
  check("✕ Eliminar gasto", $$(".pa-fila-gasto").length === g0);

  console.log("\n5. Ofertas");
  const p0 = $$("#pa-sel-proyecto option").length;
  $('[data-acc="nuevo-proyecto"]').click();
  check("＋ Oferta nueva en el selector", $$("#pa-sel-proyecto option").length === p0 + 1);
  $('[data-acc="dup-proyecto"]').click();
  check("⧉ Duplicar oferta", $$("#pa-sel-proyecto option").length === p0 + 2);
  irA("estructura");
  check("la oferta recién creada informa de que está vacía", $("#pa-estructura").innerHTML.includes("no tiene tareas"));

  console.log("\n6. Errores acumulados");
  check("sin errores JS tras toda la interacción", errores.length === 0, errores.join(" | "));

  console.log("\n7. Migración de datos v1 (encargo Ineco real) y rendimiento");
  const v1 = fs.readFileSync(path.join(RAIZ, "datos", "carga-ineco-abono-unico.json"), "utf8");
  const t = nuevaDom(w => w.localStorage.setItem("planifica:estado:v1", v1));
  await espera(600);
  check("migración v1→v2 sin errores", t.errores.length === 0, t.errores.join(" | "));
  const sel = t.document.querySelector("#pa-sel-proyecto");
  check("proyectos v1 migrados al selector", !!sel && sel.querySelectorAll("option").length > 0, "opciones=" + (sel ? sel.querySelectorAll("option").length : 0));
  const d = t.document;
  check("KPI con importe tras migrar (sin IVA inyectado)", /\d/.test(d.querySelector("#kpi-total").textContent), "kpi='" + d.querySelector("#kpi-total").textContent + "'");
  const tIni = Date.now();
  d.querySelector('[data-acc="nueva-tarea"]').click();
  const msTarea = Date.now() - tIni;
  const tSel = Date.now();
  d.querySelector("#pa-tabs .nz-tabs__tab[data-tab=ajustes]").click();
  const msTab = Date.now() - tSel;
  const tHora = Date.now();
  d.querySelector("#pa-tabs .nz-tabs__tab[data-tab=estructura]").click();
  d.querySelector('[data-acc="abrir-todo"]').click();
  const hid = d.querySelector('input[data-campo="horas"]');
  let msHora = -1;
  if (hid) { hid.value = "7"; hid.dispatchEvent(new t.window.Event("input", { bubbles: true })); msHora = Date.now() - tHora; }
  console.log(`  · rendimiento con el encargo real: nueva tarea ${msTarea} ms · cambio de pestaña ${msTab} ms · teclear una hora ${msHora} ms`);
  check("render de una tarea < 1500 ms con 1.700 líneas de JSON", msTarea < 1500, msTarea + " ms");
  check("teclear una hora < 800 ms", msHora < 0 || msHora < 800, msHora + " ms");

  console.log("\n=============================================");
  console.log(`DOM REAL: ${ok} OK / ${ko} FALLOS`);
  process.exit(ko ? 1 : 0);
}

main().catch(e => { console.error("FALLO DEL ARNÉS:", e); process.exit(2); });
