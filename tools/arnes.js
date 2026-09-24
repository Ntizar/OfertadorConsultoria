"use strict";
/* =====================================================================
   Planifica v4 — ARNÉS COMÚN
   Carga los módulos en un sandbox de Node (sin DOM) para verificar el motor
   puro, y ofrece el contador de comprobaciones.
   ===================================================================== */
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const DIR_JS = path.join(RAIZ, "src", "js");

/* Orden de carga real del build (MISMO orden que compilar.py). */
const MODULOS = [
  "nucleo.js", "periodos.js", "unidades.js", "modelo.js", "ejemplo.js",
  "calculo.js", "entregables.js", "comparar.js", "almacen.js"
];

/* Módulos de vista (solo se cargan si el arnés pasa el DOM). */
const MODULOS_VISTA = [
  "vistas.js", "vista-oferta.js", "vista-trabajo.js", "vista-resumen.js",
  "vista-informe.js", "vista-ajustes.js", "acciones.js", "eventos.js", "main.js"
];

function cargar(modulos, extra) {
  const sandbox = Object.assign({
    console: console, Math: Math, JSON: JSON, Date: Date, Number: Number, String: String,
    Array: Array, Object: Object, Map: Map, Set: Set, RegExp: RegExp, Error: Error,
    parseInt: parseInt, parseFloat: parseFloat, isFinite: isFinite, isNaN: isNaN,
    Infinity: Infinity, NaN: NaN
  }, extra || {});
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  const cargados = [], faltan = [];
  (modulos || MODULOS).forEach(f => {
    const ruta = path.join(DIR_JS, f);
    if (!fs.existsSync(ruta)) { faltan.push(f); return; }
    vm.runInContext(fs.readFileSync(ruta, "utf8"), sandbox, { filename: f });
    cargados.push(f);
  });
  return { sandbox: sandbox, PL: sandbox.PL, cargados: cargados, faltan: faltan };
}

/** Carga solo el motor (sin DOM). */
function cargarPL(extra) { return cargar(MODULOS, extra); }

/** Contador de comprobaciones con salida por consola. */
function contador(titulo) {
  let ok = 0, ko = 0;
  const fallos = [];
  if (titulo) console.log("== " + titulo + " ==\n");
  return {
    check(nombre, cond, detalle) {
      if (cond) { ok++; console.log("  ✓ " + nombre); }
      else { ko++; fallos.push(nombre); console.log("  ✗ " + nombre + (detalle === undefined ? "" : " → " + detalle)); }
    },
    grupo(t) { console.log("\n" + t); },
    info(t) { console.log("  · " + t); },
    get ok() { return ok; },
    get ko() { return ko; },
    get fallos() { return fallos; },
    resumen(silencio) {
      if (!silencio) {
        console.log("\n---------------------------------------------");
        console.log((ko === 0 ? "RESULTADO: " : "FALLOS: ") + ok + " OK / " + ko + " FALLOS" + (ko ? " (" + fallos.join("; ") + ")" : ""));
      }
      return ko === 0;
    }
  };
}

function leerDato(nombre) { return fs.readFileSync(path.join(RAIZ, "datos", nombre), "utf8"); }

module.exports = { RAIZ: RAIZ, DIR_JS: DIR_JS, MODULOS: MODULOS, MODULOS_VISTA: MODULOS_VISTA, cargar: cargar, cargarPL: cargarPL, contador: contador, leerDato: leerDato };
