const http = require('http');

const urls = [
  'http://localhost:8123/index.html',
  'http://localhost:8123/teoria.js',
  'http://localhost:8123/teoria/instrumental_cirurgico.json',
  'http://localhost:8123/teoria/preparo_do_paciente.json',
  'http://localhost:8123/teoria/nos_e_sintese.json',
  'http://localhost:8123/assets/teoria/imagens_guia/bisturi.jpg',
  'http://localhost:8123/assets/teoria/imagens_guia/pinca_foerster.jpg',
  'http://localhost:8123/assets/teoria/imagens_guia/porta_agulhas_hegar.jpg',
  'http://localhost:8123/assets/teoria/imagens_guia/porta_agulhas_mathieu.jpg',
  'http://localhost:8123/assets/teoria/imagens_guia/pinca_mixter.jpg',
  'http://localhost:8123/assets/teoria/imagens_guia/pinca_rochester.jpg',
  'http://localhost:8123/assets/teoria/imagens_guia/tesoura_mayo.jpg',
  'http://localhost:8123/assets/teoria/imagens_guia/tesoura_metzenbaum.png',
  'http://localhost:8123/assets/teoria/imagens_guia/tricotomia_cirurgica.jpg',
  'http://localhost:8123/assets/teoria/imagens_guia/retirada_de_pontos.jpg',
  'http://localhost:8123/assets/teoria/imagens_guia/fatores_de_contaminacao.jpg',
];

function checkUrl(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      if (res.statusCode === 200) {
        console.log(`[OK] ${url} -> Status: 200`);
        resolve(true);
      } else {
        console.error(`[FAIL] ${url} -> Status: ${res.statusCode}`);
        resolve(false);
      }
      res.resume(); // Consome o stream
    }).on('error', (err) => {
      console.error(`[ERROR] ${url} -> ${err.message}`);
      resolve(false);
    });
  });
}

async function runTests() {
  console.log('Iniciando teste de carregamento de recursos via HTTP...');
  let allOk = true;
  for (const url of urls) {
    const ok = await checkUrl(url);
    if (!ok) allOk = false;
  }
  
  if (allOk) {
    console.log('\nTodos os recursos carregaram perfeitamente com HTTP 200 OK!');
    process.exit(0);
  } else {
    console.error('\nErro: Alguns recursos falharam ao carregar.');
    process.exit(1);
  }
}

runTests();
