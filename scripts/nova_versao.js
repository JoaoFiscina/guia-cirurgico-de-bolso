const fs = require('fs');
const path = require('path');

// Registra uma versão nova do site em versoes.json e atualiza o ?v= dos
// arquivos CSS/JS no index.html (para o navegador não misturar versões).
//
// Uso:
//   node scripts/nova_versao.js 1.4.0 "Título curto" "Mudança 1" "Mudança 2"
//   node scripts/nova_versao.js --sincronizar   -> só reaplica a versão atual no index.html

const projectRoot = path.resolve(__dirname, '..');
const versionsPath = path.join(projectRoot, 'versoes.json');
const indexPath = path.join(projectRoot, 'index.html');
const versionedAssets = ['styles.css', 'script.js', 'teoria.js'];

function parseVersion(text) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(text || ''));
  return match ? match.slice(1).map(Number) : null;
}

function isNewer(candidate, current) {
  for (let i = 0; i < 3; i++) {
    if (candidate[i] !== current[i]) return candidate[i] > current[i];
  }
  return false;
}

function syncIndexHtml(version) {
  let html = fs.readFileSync(indexPath, 'utf8');

  versionedAssets.forEach((asset) => {
    const escaped = asset.replace('.', '\\.');
    const pattern = new RegExp(`(["'])${escaped}(?:\\?v=[^"']*)?\\1`, 'g');
    if (!pattern.test(html)) {
      console.warn(`Aviso: ${asset} não foi encontrado no index.html.`);
    }
    html = html.replace(pattern, `$1${asset}?v=${version}$1`);
  });

  fs.writeFileSync(indexPath, html, 'utf8');
}

function today() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function run() {
  const args = process.argv.slice(2);
  const data = JSON.parse(fs.readFileSync(versionsPath, 'utf8'));

  if (args[0] === '--sincronizar') {
    syncIndexHtml(data.atual);
    console.log(`index.html sincronizado com a versão ${data.atual}.`);
    return;
  }

  const [version, title, ...changes] = args;
  const parsed = parseVersion(version);

  if (!parsed || !title || !changes.length) {
    console.error('Uso: node scripts/nova_versao.js 1.4.0 "Título curto" "Mudança 1" ["Mudança 2" ...]');
    process.exit(1);
  }

  if (!isNewer(parsed, parseVersion(data.atual))) {
    console.error(`A versão ${version} precisa ser maior que a atual (${data.atual}).`);
    process.exit(1);
  }

  data.atual = version;
  data.versoes.unshift({ versao: version, data: today(), titulo: title, mudancas: changes });
  fs.writeFileSync(versionsPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  syncIndexHtml(version);

  console.log(`Versão ${version} registrada em versoes.json e aplicada no index.html.`);
  console.log(`Depois do commit, marque no git: git tag -a v${version} -m "${title}"`);
}

run();
