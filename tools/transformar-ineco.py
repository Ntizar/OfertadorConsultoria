# -*- coding: utf-8 -*-
"""Transforma el borrador del proyecto Ineco: perfiles por ROL (como el Excel) y estado completo."""
import json, pathlib

BASE = pathlib.Path(r"C:\Users\d_ant\Projects\Planifica")
BORRADOR = BASE / "datos" / "proyecto-abono-unico-fase2.json"
SALIDA = BASE / "datos" / "carga-ineco-abono-unico.json"

# Perfiles reales del encargo (rol, tarifa €/h, id)
PERFILES = [
    ("pf_jp",   "Jefe/a de proyecto (Tit. Sup. >15 años)", 65.35),
    ("pf_ct",   "Coordinador/a técnico SEPMA (Tit. Sup. >15 años)", 65.35),
    ("pf_cj1",  "Consultor/a jurídico 1 (Tit. Sup. >15 años)", 65.35),
    ("pf_cj2",  "Consultor/a jurídico 2 (Tit. Sup. 10-15 años)", 54.77),
    ("pf_cct",  "Coordinador/consultor teleco terrestre (10-15 años)", 54.77),
    ("pf_ctt",  "Consultor/a teleco terrestre (10-15 años)", 54.77),
    ("pf_ctad", "Consultor/a teleco / analista de datos (2-5 años)", 42.87),
    ("pf_ctm1", "Consultor/a transporte y movilidad 1 (>15 años)", 65.35),
    ("pf_ctm2", "Consultor/a transporte y movilidad 2 (5-10 años)", 47.76),
    ("pf_ctm3", "Consultor/a transporte y movilidad 3 (10-15 años)", 54.77),
    ("pf_ti",   "Coordinador/Consultor TI (Personal TIC)", 62.71),
    ("pf_ccom", "Coordinador/a técnico comunicación (>15 años)", 65.35),
    ("pf_cci",  "Consultor/a cc información (>15 años)", 65.35),
]

# Mapa línea → perfil (según la hoja original del Excel)
MAPA = {}
for lid in ["ln_A1a","ln_A2a"]: MAPA[lid] = "pf_jp"
for lid in ["ln_A1b","ln_A2b","ln_A3b"]: MAPA[lid] = "pf_cct"
for lid in ["ln_A1c","ln_A2c","ln_A3c"]: MAPA[lid] = "pf_ctt"
for lid in ["ln_A1d","ln_A2d","ln_A3d","ln_A4d"]: MAPA[lid] = "pf_ctad"
MAPA["ln_A5e"] = "pf_ti"
for pref in ["ln_B1","ln_B2","ln_B3","ln_B4","ln_B5"]:
    MAPA[pref+"a"] = "pf_jp"; MAPA[pref+"b"] = "pf_ct"
    MAPA[pref+"c"] = "pf_cj1"; MAPA[pref+"d"] = "pf_cj2"
for pref in ["ln_C1","ln_C2","ln_C3","ln_C4","ln_C5","ln_C6","ln_C7"]:
    MAPA[pref+"a"] = "pf_jp"; MAPA[pref+"b"] = "pf_ct"
    MAPA[pref+"c"] = "pf_ctm1"; MAPA[pref+"d"] = "pf_ctm2"; MAPA[pref+"e"] = "pf_ctm3"
MAPA["ln_D1a"] = "pf_jp"; MAPA["ln_D1b"] = "pf_ct"; MAPA["ln_D1c"] = "pf_ctm1"; MAPA["ln_D1d"] = "pf_ctm3"
MAPA["ln_D2a"] = "pf_jp"; MAPA["ln_D2b"] = "pf_ct"; MAPA["ln_D2c"] = "pf_ccom"; MAPA["ln_D2d"] = "pf_cci"

data = json.loads(BORRADOR.read_text(encoding="utf-8"))
proy = data["proyecto"]
cambiadas = 0
falta = []
for t in proy["tareas"]:
    for s in t["subtareas"]:
        for l in s["lineas"]:
            nuevo = MAPA.get(l["id"])
            if not nuevo:
                falta.append(l["id"]); continue
            if l["perfilId"] != nuevo: cambiadas += 1
            l["perfilId"] = nuevo
if falta:
    print("LINEAS SIN MAPA:", falta); raise SystemExit(1)

estado = {
    "version": 1,
    "marca": {"nombre": "Planifica", "sub": "Presupuestos y planificación de proyectos", "moneda": "€"},
    "mostrarImportes": True,
    "perfiles": [{"id": pid, "nombre": nom, "unidades": "h", "tarifa": tar} for pid, nom, tar in PERFILES],
    "perfilesInactivos": [],
    "proyectos": [proy],
    "activo": proy["id"],
    "pestana": "estructura",
}
SALIDA.write_text(json.dumps(estado, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"OK -> {SALIDA.name} ({SALIDA.stat().st_size/1024:.1f} KB), lineas remapeadas: {cambiadas}")

# Verificación: recalcular importes con las tarifas y comparar con el Excel
def horas(l): return sum(v for v in l["horas"].values())
def tarifa(pid): return next(p["tarifa"] for p in estado["perfiles"] if p["id"] == pid)
tot = 0
for t in proy["tareas"]:
    ti = sum(round(horas(l)*tarifa(l["perfilId"]),2) for s in t["subtareas"] for l in s["lineas"])
    tot += ti
    print(f"  {t['nombre'][:60]:62s} {ti:>12,.2f}")
print(f"  TOTAL: {tot:,.2f}  (Excel: 587.009,36)")
