"use strict";
/* Runner de verificación de Planifica v4.
   Uso: node tools/verificar.js     (compila y luego pasa todos los arneses) */
const { execFileSync } = require("child_process");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const ARNESES = [
  ["tools/verificar-motor.js", "motor (cálculo, periodos, entregables, fotos)", /(\d+) OK \/ (\d+) FALLOS/],
  ["tools/verificar-dom.js", "DOM real (jsdom: pestañas, Gantt, todo conectado)", /DOM REAL v4: (\d+) OK \/ (\d+) FALLOS/],
];

function corre(script) {
  try {
    return { salida: execFileSync(process.execPath, [path.join(RAIZ, script)], { cwd: RAIZ, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }), fallo: false };
  } catch (e) {
    return { salida: (e.stdout || "") + (e.stderr || ""), fallo: true };
  }
}

console.log("=== 1. COMPILAR ===");
try {
  console.log(execFileSync("py", ["-3.12", "tools/compilar.py"], { cwd: RAIZ, encoding: "utf8" }).trim());
} catch (e) { console.log((e.stdout || "") + (e.stderr || "")); process.exit(1); }

console.log("\n=== 2. ARNESES ===");
let ok = 0, ko = 0;
for (const [script, nombre, patron] of ARNESES) {
  const r = corre(script);
  const m = r.salida.match(patron);
  if (!m) { console.log(`  ✗ ${script}: no se pudo leer el resultado`); ko++; console.log(r.salida.split("\n").slice(-14).join("\n")); continue; }
  const [, bien, mal] = m.map(Number);
  ok += bien; ko += mal;
  const verde = mal === 0 && !r.fallo;
  console.log(`  ${verde ? "✓" : "✗"} ${nombre}: ${bien} OK · ${mal} fallos`);
  (r.salida.match(/^\s+✗ .*$/gm) || []).forEach(l => console.log("      " + l.trim()));
}

console.log("\n=== 3. AUDITORÍA DE CONEXIONES ===");
try {
  const salida = execFileSync("py", ["-3.12", "tools/auditar-wiring.py"], { cwd: RAIZ, encoding: "utf8" });
  console.log(salida.trim());
  if (/FALLOS/.test(salida)) ko++;
} catch (e) { console.log((e.stdout || "") + (e.stderr || "")); ko++; }

console.log("\n=============================================");
console.log(`TOTAL: ${ok} comprobaciones OK · ${ko} fallos`);
process.exit(ko ? 1 : 0);
