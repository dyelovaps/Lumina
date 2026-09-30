"""Lanceur local Lumina — exécute, au clic d'un bouton de l'extension, les
commandes déclarées dans lanceur.json (et seulement celles-là).

    python lumina_lanceur.py            (ou double-clic sur Lancer_lanceur.bat)

Écoute sur 127.0.0.1 uniquement. Une requête doit venir de l'extension
(Origin chrome-extension://…) : une page web ouverte dans Chrome ne peut donc
pas déclencher une commande. Aucune dépendance hors bibliothèque standard.
"""

import json
import os
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ICI = Path(__file__).resolve().parent
CONFIG = ICI / "lanceur.json"
A_COMPLETER = "A_COMPLETER"

processus = {}  # id -> Popen


def charger():
    with open(CONFIG, encoding="utf-8") as f:
        return json.load(f)


def incomplet(c):
    return A_COMPLETER in json.dumps(c, ensure_ascii=False)


def etat(c):
    p = processus.get(c["id"])
    return {
        "id": c["id"],
        "label": c.get("label", c["id"]),
        "groupe": c.get("groupe", ""),
        "type": c.get("type", "lancer"),
        "aide": c.get("aide", ""),
        "a_completer": incomplet(c),
        "en_cours": bool(p and p.poll() is None),
    }


def executer(c):
    if incomplet(c):
        raise ValueError(f"« {c.get('label', c['id'])} » n'est pas configurée : complète lanceur.json.")
    genre = c.get("type", "lancer")
    if genre == "dossier":
        chemin = Path(c["path"])
        if not chemin.exists():
            raise FileNotFoundError(f"dossier introuvable : {chemin}")
        if sys.platform == "win32":
            os.startfile(chemin)  # ouvre l'Explorateur Windows
        else:
            subprocess.Popen(["xdg-open", str(chemin)])
        return {"ouvert": str(chemin)}
    if genre == "url":
        import webbrowser
        webbrowser.open(c["url"])
        return {"ouvert": c["url"]}

    p = processus.get(c["id"])
    if p and p.poll() is None and not c.get("plusieurs", False):
        return {"deja": True, "pid": p.pid}
    cwd = c.get("cwd") or None
    if cwd and not Path(cwd).exists():
        raise FileNotFoundError(f"dossier de travail introuvable : {cwd}")
    options = {}
    if sys.platform == "win32":
        options["creationflags"] = subprocess.CREATE_NEW_CONSOLE  # une fenêtre par commande
    p = subprocess.Popen(c["cmd"], cwd=cwd, **options)
    processus[c["id"]] = p
    return {"pid": p.pid}


class Handler(BaseHTTPRequestHandler):
    def _origine_ok(self):
        origin = self.headers.get("Origin", "")
        return origin.startswith("chrome-extension://")

    def _repondre(self, code, data):
        corps = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        origin = self.headers.get("Origin", "")
        if origin.startswith("chrome-extension://"):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(corps)))
        self.end_headers()
        self.wfile.write(corps)

    def do_OPTIONS(self):
        self._repondre(204 if self._origine_ok() else 403, {})

    def do_GET(self):
        if not self._origine_ok():
            return self._repondre(403, {"erreur": "origine refusée"})
        if self.path.split("?")[0] == "/commandes":
            try:
                cfg = charger()
            except Exception as e:  # JSON mal formé : on le dit au panneau
                return self._repondre(500, {"erreur": f"lanceur.json illisible : {e}"})
            return self._repondre(200, {"commandes": [etat(c) for c in cfg.get("commandes", [])]})
        self._repondre(404, {"erreur": "route inconnue"})

    def do_POST(self):
        if not self._origine_ok():
            return self._repondre(403, {"erreur": "origine refusée"})
        if not self.path.startswith("/lancer/"):
            return self._repondre(404, {"erreur": "route inconnue"})
        ident = self.path[len("/lancer/"):]
        try:
            cfg = charger()
            c = next((x for x in cfg.get("commandes", []) if x["id"] == ident), None)
            if not c:
                return self._repondre(404, {"erreur": f"commande inconnue : {ident}"})
            return self._repondre(200, {"ok": True, **executer(c)})
        except Exception as e:
            return self._repondre(400, {"ok": False, "erreur": str(e)})

    def log_message(self, fmt, *args):
        print("[lanceur]", fmt % args)


def main():
    port = int(charger().get("port", 8178))
    print(f"Lanceur Lumina sur http://127.0.0.1:{port} — laisse cette fenêtre ouverte.")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()


if __name__ == "__main__":
    main()
