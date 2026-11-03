const fs = require('fs');
const path = require('path');

// Valida os roteiros da pasta procedimentos/ com as mesmas regras do site
// e confere se o manifest lista exatamente os arquivos da pasta.
//
// Uso:
//   node scripts/validar_roteiros.js                      -> só valida
//   node scripts/validar_roteiros.js --atualizar-manifest -> valida e reescreve o manifest

const projectRoot = path.resolve(__dirname, '..');
const proceduresDir = path.join(projectRoot, 'procedimentos');
const manifestName = 'procedimentos-manifest.json';
const manifestPath = path.join(proceduresDir, manifestName);
const shouldUpdateManifest = process.argv.includes('--atualizar-manifest');

const errors = [];
const warnings = [];

function isProcedureFile(fileName) {
  return /\.(txt|json)$/i.test(fileName) && fileName !== manifestName;
}

// Mesmo pré-processamento do site: remove BOM e cerca ```json
function parseProcedureText(text) {
  let clean = String(text).replace(/^﻿/, '').trim();
  const fence = clean.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) clean = fence[1].trim();
  const parsed = JSON.parse(clean);

  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.procedimentos)) return parsed.procedimentos;
  return [parsed];
}

function mediaExists(mediaPath) {
  if (!mediaPath || /^(https?:|data:|blob:)/i.test(mediaPath)) return true;
  return fs.existsSync(path.join(projectRoot, mediaPath.replace(/^\/+/, '')));
}

function validateProcedure(procedure, fileName, seenIds) {
  const label = `${fileName} -> ${procedure && procedure.id ? procedure.id : '(sem id)'}`;

  if (!procedure || typeof procedure !== 'object' || Array.isArray(procedure)) {
    errors.push(`${fileName}: item não é um objeto JSON.`);
    return null;
  }

  if (!procedure.id) errors.push(`${label}: campo obrigatório "id" ausente.`);
  if (!procedure.nome) errors.push(`${label}: campo obrigatório "nome" ausente.`);
  if (!procedure.categoria) warnings.push(`${label}: sem "categoria" (vai aparecer em "Outros procedimentos").`);

  if (procedure.id) {
    if (seenIds.has(procedure.id)) {
      errors.push(`${label}: id duplicado, já usado em ${seenIds.get(procedure.id)}.`);
    } else {
      seenIds.set(procedure.id, fileName);
    }
  }

  const steps = Array.isArray(procedure.passos) ? procedure.passos : [];
  if (!steps.length) {
    errors.push(`${label}: campo obrigatório "passos" ausente ou vazio.`);
    return null;
  }

  const numbers = new Set();
  steps.forEach((step, index) => {
    const stepLabel = `${label}, passo ${index + 1}`;
    if (!Number.isFinite(Number(step.numero))) errors.push(`${stepLabel}: "numero" inválido.`);
    if (!step.titulo) errors.push(`${stepLabel}: "titulo" ausente.`);
    if (!step.descricao) errors.push(`${stepLabel}: "descricao" ausente.`);
    if (numbers.has(Number(step.numero))) warnings.push(`${stepLabel}: número ${step.numero} repetido.`);
    numbers.add(Number(step.numero));
    if (!mediaExists(step.imagem)) errors.push(`${stepLabel}: imagem não encontrada (${step.imagem}).`);
  });

  if (!mediaExists(procedure.imagem_capa)) {
    errors.push(`${label}: imagem_capa não encontrada (${procedure.imagem_capa}).`);
  }

  return {
    id: procedure.id,
    steps: steps.length,
    critical: steps.filter((step) => step.critico).length
  };
}

function runValidation() {
  console.log('Validando roteiros em procedimentos/...\n');

  const files = fs.readdirSync(proceduresDir).filter(isProcedureFile).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const seenIds = new Map();
  const summaries = [];

  files.forEach((fileName) => {
    let procedures;
    try {
      procedures = parseProcedureText(fs.readFileSync(path.join(proceduresDir, fileName), 'utf8'));
    } catch (error) {
      errors.push(`${fileName}: JSON inválido (${error.message}).`);
      return;
    }

    procedures.forEach((procedure) => {
      const summary = validateProcedure(procedure, fileName, seenIds);
      if (summary) summaries.push(summary);
    });
  });

  // Manifest: deve listar exatamente os arquivos da pasta
  let manifestFiles = [];
  try {
    manifestFiles = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).files || [];
  } catch (error) {
    if (!shouldUpdateManifest) errors.push(`${manifestName}: não foi possível ler (${error.message}).`);
  }

  const missingInManifest = files.filter((fileName) => !manifestFiles.includes(fileName));
  const missingOnDisk = manifestFiles.filter((fileName) => !files.includes(fileName));

  if (shouldUpdateManifest) {
    fs.writeFileSync(manifestPath, JSON.stringify({ files }, null, 2) + '\n', 'utf8');
    console.log(`Manifest atualizado com ${files.length} arquivo(s).\n`);
  } else {
    missingInManifest.forEach((fileName) => errors.push(`${manifestName}: falta listar ${fileName}.`));
    missingOnDisk.forEach((fileName) => errors.push(`${manifestName}: lista ${fileName}, mas o arquivo não existe.`));
  }

  summaries.forEach((summary) => {
    console.log(`  ${summary.id}: ${summary.steps} passos, ${summary.critical} críticos`);
  });

  console.log(`\n${summaries.length} roteiro(s) válido(s) em ${files.length} arquivo(s).`);

  if (warnings.length) {
    console.log(`\nAvisos (${warnings.length}):`);
    warnings.forEach((warning) => console.log(`  - ${warning}`));
  }

  if (errors.length) {
    console.log(`\nErros (${errors.length}):`);
    errors.forEach((error) => console.log(`  - ${error}`));
    if (missingInManifest.length || missingOnDisk.length) {
      console.log('\nPara corrigir o manifest: node scripts/validar_roteiros.js --atualizar-manifest');
    }
    process.exit(1);
  }

  console.log('\nTudo certo.');
}

runValidation();
