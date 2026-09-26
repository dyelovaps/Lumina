// Copie Agnes Studio Pro (dossier source, modifié à la main) dans agnes/ : Chrome ne charge que les fichiers
// présents dans le dossier de l'extension. À relancer après chaque modification d'Agnes : npm run sync:agnes
// Source : variable AGNES_SRC, sinon le dossier de production habituel.
const fs = require("node:fs");
const path = require("node:path");

const SRC = process.env.AGNES_SRC ||
  "D:/Rmaopn/a classser/Dernier_projet/TitTok_Histoires_vraie/_BlackLow/Production/App/Agnes_production";
const DEST = path.join(__dirname, "..", "agnes");

if (!fs.existsSync(path.join(SRC, "index.html"))) {
  console.error("Agnes introuvable : " + SRC + " (réglez AGNES_SRC).");
  process.exit(1);
}
// Code distant interdit dans une extension : les bibliothèques doivent être dans vendor/.
const html = fs.readFileSync(path.join(SRC, "index.html"), "utf8");
if (/<script[^>]+src="https?:/i.test(html)) {
  console.error("index.html charge un script distant : Chrome le bloquera dans Lumina. Copiez-le dans vendor/.");
  process.exit(1);
}
fs.rmSync(DEST, { recursive: true, force: true });
fs.cpSync(SRC, DEST, { recursive: true, filter: (p) => !/(^|[\/])(\.git|node_modules)([\/]|$)/.test(p) });
const count = (d) => fs.readdirSync(d, { withFileTypes: true })
  .reduce((n, e) => n + (e.isDirectory() ? count(path.join(d, e.name)) : 1), 0);
console.log(`Agnes copiée dans agnes/ (${count(DEST)} fichiers). Rechargez Lumina dans chrome://extensions.`);
