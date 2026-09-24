# -*- coding: utf-8 -*-
"""Compila Planifica v3: incrusta Aurora 7 + el CSS propio + los módulos JS
en un único HTML autocontenido (abrible con doble clic, sin CDN).

Uso:  py -3.12 tools/compilar.py

Guardas (si alguna falla, NO se escribe el destino y sale con código 1):
  · falta algún fichero fuente            · queda algún placeholder sin sustituir
  · falta alguna de las 8 secciones       · el JS no ensambla (paréntesis/llaves)
"""
import re
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
AURORA = Path(r"C:/Users/d_ant/Projects/Aurora-7")
TAG = "v7.2.0"

PACKS = [
    "tokens.css",
    "packs/p1-layout.css",
    "packs/p2-navigation.css",
    "packs/p3-typography.css",
    "packs/p4-actions.css",
    "packs/p5-forms.css",
    "packs/p6-feedback.css",
    "packs/p7-overlays.css",
    "packs/p8-data.css",
    "packs/p13-charts.css",
]

# Orden de carga OBLIGATORIO: utilidades → modelo → cálculo → datos → vistas → eventos → arranque.
MODULOS_JS = [
    "nucleo.js",
    "modelo.js",
    "ejemplo.js",
    "calculo.js",
    "entregables.js",
    "comparar.js",
    "almacen.js",
    "vistas.js",
    "vista-estructura.js",
    "vista-entregables.js",
    "vista-escenarios.js",
    "vista-resumen.js",
    "vista-cronograma.js",
    "vista-gastos.js",
    "vista-informe.js",
    "vista-ajustes.js",
    "acciones.js",
    "eventos.js",
    "main.js",
]

SECCIONES = ["sec-estructura", "sec-entregables", "sec-escenarios", "sec-resumen",
             "sec-cronograma", "sec-gastos", "sec-informe", "sec-ajustes"]


def morir(mensaje):
    print("COMPILACIÓN FALLIDA: " + mensaje)
    sys.exit(1)


def lee_aurora(rel):
    ruta = AURORA / rel
    if not ruta.exists():
        morir("no existe el pack de Aurora %s" % ruta)
    return ruta.read_text(encoding="utf-8")


def main():
    html = (BASE / "src" / "index.html").read_text(encoding="utf-8")
    css_propio = (BASE / "src" / "css" / "app.css").read_text(encoding="utf-8")

    # --- JS por módulos, con cabecera de cada uno para poder leerlo en el HTML final ---
    trozos, faltan = [], []
    for m in MODULOS_JS:
        ruta = BASE / "src" / "js" / m
        if not ruta.exists():
            faltan.append(m)
            continue
        trozos.append("/* ====== MÓDULO %s ====== */\n%s" % (m, ruta.read_text(encoding="utf-8")))
    if faltan:
        morir("faltan módulos JS: %s" % ", ".join(faltan))
    js = "\n".join(trozos)

    # --- CSS de Aurora + el propio ---
    packs = "\n".join("/* ====== Aurora 7 %s: %s ====== */\n%s" % (TAG, p, lee_aurora(p)) for p in PACKS)
    bloque_css = "<style>\n/* ====== Aurora 7 %s incrustado (%d packs) ====== */\n%s\n/* ====== CSS propio de la aplicación ====== */\n%s\n</style>" % (
        TAG, len(PACKS), packs, css_propio)

    if "<!--PACKS_CSS-->" not in html:
        morir("el HTML fuente no tiene el marcador <!--PACKS_CSS-->")
    if "<!--APP_CSS-->" not in html:
        morir("el HTML fuente no tiene el marcador <!--APP_CSS-->")
    if "/*APP_JS*/" not in html:
        morir("el HTML fuente no tiene el marcador /*APP_JS*/")

    html = html.replace("<!--PACKS_CSS-->", bloque_css)
    html = html.replace("<!--APP_CSS-->", "")
    html = html.replace("/*APP_JS*/", js)

    # --- Guardas del resultado ---
    for marcador in ("<!--PACKS_CSS-->", "<!--APP_CSS-->", "/*APP_JS*/"):
        if marcador in html:
            morir("quedó el marcador %s sin sustituir" % marcador)
    for sec in SECCIONES:
        if 'id="%s"' % sec not in html:
            morir("falta la sección %s" % sec)
    if re.search(r'\$\$\("main>section"\)', html):
        morir("ha vuelto el selector roto $$(\"main>section\")")

    destino = BASE / "docs" / "index.html"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(html, encoding="utf-8")

    print("OK -> %s (%.1f KB)" % (destino, destino.stat().st_size / 1024))
    print("     %d módulos JS · %d packs de Aurora %s · CSS propio %.1f KB" % (
        len(MODULOS_JS), len(PACKS), TAG, len(css_propio) / 1024))


if __name__ == "__main__":
    main()
