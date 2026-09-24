"use strict";
/* Arranque en seco de la app compilada: sirve para cazar errores de carga antes
   de ejecutar el arnés completo. Uso: node tools/smoke.js */
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
  console.log("API PÚBLICA :", dom.window.Planifica ? "sí" : "no");
  console.log("ERRORES JS  :", errores.length ? errores.join(" | ") : "(ninguno)");
  const paneles = ["pa-estructura", "pa-guia", "ent-resumen", "pa-entregables", "esc-cabecera", "pa-escenarios",
    "res-totales", "res-perfiles", "res-tareas", "res-facturacion", "cro-barras", "cro-hitos", "cro-tabla",
    "gas-lista", "informe-cuerpo", "ajustes-cuerpo"];
  console.log("\n--- contenido de los paneles (longitud del HTML) ---");
  paneles.forEach(id => {
    const el = d.getElementById(id);
    console.log("  " + (el ? String(el.innerHTML.length).padStart(7) : "  FALTA ") + "  " + id);
  });
  console.log("\n--- visibilidad de secciones ---");
  [...d.querySelectorAll('section[id^="sec-"]')].forEach(s => console.log("  " + (s.hidden ? "oculta " : "VISIBLE") + " " + s.id));
  console.log("\n--- KPIs ---");
  ["kpi-total", "kpi-horas", "kpi-entregables", "kpi-avance", "kpi-facturado", "kpi-cliente"].forEach(id => {
    const el = d.getElementById(id);
    console.log("  " + id.padEnd(16) + " = " + (el ? JSON.stringify(el.textContent) : "FALTA"));
  });
  console.log("\n--- API de datos ---");
  try {
    const api = dom.window.Planifica;
    if (api) {
      console.log("  oferta   :", api.oferta().nombre);
      console.log("  total    :", api.total().toLocaleString("es-ES"));
      console.log("  factura  :", JSON.stringify(api.facturacion()));
    }
  } catch (e) { console.log("  fallo consultando la API:", e.message); }
  process.exit(errores.length ? 1 : 0);
}, 500);
