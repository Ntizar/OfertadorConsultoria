# -*- coding: utf-8 -*-
"""Compila Planifica: incrusta Aurora 7 + CSS propio + JS en un unico HTML.

Uso:  py -3.12 tools/compilar.py
"""
import re
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

def lee(rel):
    return (AURORA / rel).read_text(encoding="utf-8")

def main():
    html = (BASE / "src" / "index.html").read_text(encoding="utf-8")
    css = "\n".join("/* ====== Aurora 7 %s: %s ====== */\n%s" % (TAG, p, lee(p)) for p in PACKS)
    propio = (BASE / "src" / "style.css").read_text(encoding="utf-8") if (BASE / "src" / "style.css").exists() else ""
    js = (BASE / "src" / "app.js").read_text(encoding="utf-8")
    bloque = "<!-- Aurora 7 %s incrustado (%d packs) + CSS propio -->\n<style>\n%s\n%s\n</style>" % (
        TAG, len(PACKS), css, propio)
    html = html.replace("<!--PACKS_CSS-->", bloque)
    html = html.replace("/*APP_JS*/", js)
    destino = BASE / "docs" / "index.html"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(html, encoding="utf-8")
    print("OK -> %s (%.1f KB)" % (destino, destino.stat().st_size / 1024))

if __name__ == "__main__":
    main()
