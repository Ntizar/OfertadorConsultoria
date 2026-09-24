"use strict";
/* =====================================================================
   Planifica v3 — VERIFICACIÓN COMPLETA
   Ejecuta todos los arneses y resume. Un solo comando:

       node tools/verificar.js            (todo)
       node tools/verificar.js --rapido   (sin el arnés de DOM, que es el lento)

   Arneses:
     · verificar-motor.js        cálculo, modelo y migraciones (sin DOM)
     · verificar-entregables.js  entregables y facturación por hito
     · verificar-comparar.js     escenarios, versiones y almacén
     · verificar-dom.js          DOM real sobre docs/index.html compilado
     · verificar-legado-v2.js    motor de la app v2 (hasta que se retire)
   ===================================================================== */
const { execFileSync } = require("child_process");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const rapido = process.argv.indexOf("--rapido") >= 0;

const PASOS = [
  ["Motor: cálculo, modelo y migraciones", "verificar-motor.js"],
  ["Entregables y facturación por hito", "verificar-entregables.js"],
  ["Escenarios, versiones y almacén", "verificar-comparar.js"],
  ["DOM real de la app compilada", "verificar-dom.js"],
  ["Motor de la app v2 (legado, hasta retirarlo)", "verificar-legado-v2.js"]
].filter(p => !(rapido && p[1] === "verificar-dom.js"));

console.log("\n##########  PLANIFICA — VERIFICACIÓN COMPLETA  ##########\n");

let okTotal = 0, koTotal = 0;
const resumen = [];

PASOS.forEach(([titulo, fichero]) => {
  console.log("\n==================================================");
  console.log("### " + titulo + "  (" + fichero + ")");
  console.log("==================================================");
  let salida = "", codigo = 0;
  try {
    salida = execFileSync(process.execPath, [path.join(__dirname, fichero)], { cwd: RAIZ, encoding: "utf8" });
  } catch (e) {
    salida = String(e.stdout || "") + String(e.stderr || "");
    codigo = e.status === undefined ? 1 : e.status;
  }
  process.stdout.write(salida);

  /* El resumen de cada arnés tiene la forma "N OK / M FALLOS" (v3) o
     "N/TOTAL comprobaciones OK" (arnés legado). */
  let m = salida.match(/(\d+)\s+OK\s*\/\s*(\d+)\s+FALLOS/);
  if (m) { m = [m[0], m[1], m[2]]; }
  else {
    const m2 = salida.match(/(\d+)\/(\d+)\s+comprobaciones OK/);
    m = m2 ? [m2[0], m2[1], String(parseInt(m2[2], 10) - parseInt(m2[1], 10))] : null;
  }
  const ok = m ? parseInt(m[1], 10) : 0;
  const ko = m ? parseInt(m[2], 10) : 1;
  okTotal += ok;
  koTotal += ko;
  resumen.push({ titulo: titulo, fichero: fichero, ok: ok, ko: ko, codigo: codigo });
});

console.log("\n\n####################  RESUMEN  ####################");
resumen.forEach(r => {
  const marca = r.ko === 0 && r.codigo === 0 ? "✓" : "✗";
  console.log("  " + marca + " " + r.fichero.padEnd(28, " ") + String(r.ok).padStart(4) + " OK" + (r.ko ? "   " + r.ko + " FALLOS" : ""));
});
console.log("  " + "-".repeat(48));
console.log("  TOTAL: " + okTotal + " comprobaciones OK" + (koTotal ? ", " + koTotal + " FALLOS" : " · todo en verde") + (rapido ? "  (modo rápido: sin DOM)" : ""));
console.log("");

process.exit(koTotal ? 1 : 0);
