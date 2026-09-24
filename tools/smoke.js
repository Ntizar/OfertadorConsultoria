"use strict";
/* Arranque en seco de la app compilada (v4): caza errores de carga y comprueba
   que las 5 pestañas, el Gantt y la API pública responden.
   Uso: node tools/smoke.js */
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const HTML = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
const errores = [];
const vc = new VirtualConsole();
vc.on("jsdomError", e => errores.push("JSDOM: " + String(e.message).split("\n")[0]));
vc.on("error", (...a) => errores.push("CONSOLA: " + a.join(" ")));

const dom = new JSDOM(HTML, {
  runScripts: "dangerously", url: "https://planifica.local/", pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(w) {
    w.confirm = () => true; w.prompt = () => "prueba"; w.alert = () => {}; w.print = () => {};
    w.URL.createObjectURL = () => "blob:x"; w.URL.revokeObjectURL = () => {};
  }
});
const d = dom.window.document;

setTimeout(() => {
  console.log("TÍTULO      :", d.title);
  const err = d.getElementById("pa-error");
  console.log("ERROR EN PÁG.:", err && err.classList.contains("is-visible") ? err.textContent : "(ninguno)");
  console.log("MÓDULOS PL  :", dom.window.PL ? Object.keys(dom.window.PL).join(", ") : "¡PL NO EXISTE!");
  console.log("VISTAS      :", dom.window.PL && dom.window.PL.vistas ? Object.keys(dom.window.PL.vistas).join(", ") : "—");
  console.log("ACCIONES    :", dom.window.PL && dom.window.PL.acc ? Object.keys(dom.window.PL.acc).length : 0);
  console.log("ERRORES JS  :", errores.length ? errores.join(" | ") : "(ninguno)");

  const paneles = ["tr-guia", "tr-calendario", "tr-gantt", "tr-editor", "ofe-datos", "ofe-gastos", "ofe-economia",
    "res-totales", "res-perfiles", "res-tareas", "res-por-periodo", "res-fotos", "informe-cuerpo", "ajustes-cuerpo"];
  console.log("\n--- contenido de los paneles ---");
  paneles.forEach(id => {
    const el = d.getElementById(id);
    console.log("  " + (el ? String(el.innerHTML.length).padStart(7) : "  FALTA ") + "  " + id);
  });

  console.log("\n--- Gantt ---");
  const gantt = d.querySelector(".pa-gantt");
  if (gantt) {
    console.log("  filas de tarea      :", d.querySelectorAll(".pa-gantt__fila--tarea").length);
    console.log("  filas de subtarea   :", d.querySelectorAll(".pa-gantt__fila--subtarea").length);
    console.log("  filas de entregable :", d.querySelectorAll(".pa-gantt__fila--entregable").length);
    console.log("  bandas de año       :", [...d.querySelectorAll(".pa-gantt__anios th")].map(t => t.textContent).join(" | "));
    console.log("  rótulos de periodo  :", [...d.querySelectorAll(".pa-gantt__rotulo")].map(i => i.value).join(" "));
    console.log("  barras              :", d.querySelectorAll(".pa-barra:not(.pa-barra--hito)").length);
    console.log("  rombos de entregable:", d.querySelectorAll(".pa-barra--hito").length);
  } else { console.log("  ¡NO HAY GANTT!"); }

  console.log("\n--- KPIs ---");
  ["kpi-total", "kpi-horas", "kpi-perfiles", "kpi-calendario", "kpi-rango", "kpi-entregables", "kpi-cliente"].forEach(id => {
    const el = d.getElementById(id);
    console.log("  " + id.padEnd(16) + " = " + (el ? JSON.stringify(el.textContent) : "FALTA"));
  });

  console.log("\n--- pestañas y visibilidad ---");
  [...d.querySelectorAll("#pa-tabs .nz-tabs__tab")].forEach(t => console.log("  tab " + t.dataset.tab + " aria-selected=" + t.getAttribute("aria-selected")));
  [...d.querySelectorAll('section[id^="sec-"]')].forEach(s => console.log("  " + (s.hidden ? "oculta " : "VISIBLE") + " " + s.id));

  console.log("\n--- API pública ---");
  try {
    const api = dom.window.Planifica;
    if (api) {
      console.log("  oferta      :", api.oferta().nombre);
      console.log("  total       :", api.total().toLocaleString("es-ES"));
      console.log("  horas       :", api.horas().toLocaleString("es-ES"));
      console.log("  entregables :", api.entregables().length);
      console.log("  periodos    :", JSON.stringify(api.periodos()));
    }
  } catch (e) { console.log("  fallo consultando la API:", e.message); }
  process.exit(errores.length ? 1 : 0);
}, 500);
