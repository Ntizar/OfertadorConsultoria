"use strict";
/* =====================================================================
   Planifica v3 — ARNÉS COMÚN
   Carga los módulos de la app en un sandbox de Node (sin DOM) para poder
   verificar el motor puro, y ofrece el contador de comprobaciones.
   ===================================================================== */
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const DIR_JS = path.join(RAIZ, "src", "js");

/* Orden de concatenación real del build: aquí se carga igual.
   Los módulos que aún no existan se saltan (permite verificar por fases). */
const MODULOS = ["nucleo.js", "modelo.js", "ejemplo.js", "calculo.js", "entregables.js", "comparar.js", "almacen.js"];

function cargarPL(extra) {
  const sandbox = Object.assign({
    console: console, Math: Math, JSON: JSON, Date: Date, Number: Number, String: String,
    Array: Array, Object: Object, Map: Map, Set: Set, RegExp: RegExp, Error: Error,
    parseInt: parseInt, parseFloat: parseFloat, isFinite: isFinite, isNaN: isNaN,
    Infinity: Infinity, NaN: NaN
  }, extra || {});
  /* Los módulos usan `typeof window !== "undefined" ? window : globalThis`:
     dentro del sandbox, window ES el sandbox. */
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  const cargados = [];
  MODULOS.forEach(f => {
    const ruta = path.join(DIR_JS, f);
    if (!fs.existsSync(ruta)) return;
    vm.runInContext(fs.readFileSync(ruta, "utf8"), sandbox, { filename: f });
    cargados.push(f);
  });
  vm.runInContext("var __MODULOS_CARGADOS = " + JSON.stringify(cargados) + ";", sandbox);
  return { sandbox: sandbox, PL: sandbox.PL, cargados: cargados };
}

/** Contador de comprobaciones con salida por consola y código de salida. */
function contador(titulo) {
  let ok = 0, ko = 0;
  const fallos = [];
  if (titulo) console.log("== " + titulo + " ==\n");
  return {
    check: function (nombre, cond, detalle) {
      if (cond) { ok++; console.log("  ✓ " + nombre); }
      else { ko++; fallos.push(nombre); console.log("  ✗ " + nombre + (detalle === undefined ? "" : " → " + detalle)); }
    },
    grupo: function (t) { console.log("\n" + t); },
    info: function (t) { console.log("  · " + t); },
    get ok() { return ok; },
    get ko() { return ko; },
    get fallos() { return fallos; },
    resumen: function (silencio) {
      if (!silencio) {
        console.log("\n---------------------------------------------");
        console.log((ko === 0 ? "RESULTADO: " : "FALLOS: ") + ok + " OK / " + ko + " FALLOS" + (ko ? " (" + fallos.join("; ") + ")" : ""));
      }
      return ko === 0;
    }
  };
}

/** Lee un JSON de datos/ con nombre y lo devuelve como cadena (para migrar). */
function leerDato(nombre) {
  return fs.readFileSync(path.join(RAIZ, "datos", nombre), "utf8");
}

module.exports = { RAIZ: RAIZ, DIR_JS: DIR_JS, MODULOS: MODULOS, cargarPL: cargarPL, contador: contador, leerDato: leerDato };
