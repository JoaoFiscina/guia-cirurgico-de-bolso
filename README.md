# Guia Cirúrgico de Bolso

Site publicado: https://joaofiscina.github.io/guia-cirurgico-de-bolso/

Site estático em `HTML`, `CSS` e `JavaScript` puro para estudo de habilidades cirúrgicas, preparado para funcionar muito bem no GitHub Pages.

O diferencial desta versão é que os roteiros são carregados automaticamente a partir da pasta [procedimentos](procedimentos), sem precisar editar `index.html` ou `script.js` a cada novo arquivo.

## Estrutura do projeto

- [index.html](index.html): interface principal.
- [styles.css](styles.css): visual responsivo.
- [script.js](script.js): carregamento, validação, importação local e modos de estudo.
- [config/app-config.json](config/app-config.json): configuração do repositório GitHub.
- [procedimentos/](procedimentos): pasta onde ficam os arquivos de procedimentos.
- [procedimentos/procedimentos-manifest.json](procedimentos/procedimentos-manifest.json): fallback local opcional.
- [assets/imagens/](assets/imagens): imagens usadas pelos procedimentos.

## Como o sistema lê a pasta automaticamente

Ao abrir o site, o fluxo é:

1. Ler `config/app-config.json`.
2. Ler `procedimentos/procedimentos-manifest.json` no próprio site e baixar todos os roteiros listados ao mesmo tempo.
3. No site publicado, consultar a pasta pela API pública do GitHub só para achar roteiros novos que ainda não entraram no manifest. Se a API falhar ou atingir o limite de 60 consultas/hora, nada muda para quem está usando. Rodando localmente (`localhost`), essa etapa é pulada para valerem os arquivos do seu computador.
4. Se o manifest não puder ser lido, ler a pasta inteira pela API do GitHub; se isso também falhar, carregar os exemplos locais.
5. Interpretar o conteúdo de cada arquivo `.txt` ou `.json` como JSON.
6. Aceitar dois formatos:
   - um procedimento único como objeto JSON;
   - um objeto com a chave `"procedimentos"` contendo um array.
7. Normalizar tudo para uma lista única de procedimentos.
8. Validar campos mínimos.
9. Eliminar duplicatas por `id`.

## Regra de duplicatas

Se dois arquivos trouxerem o mesmo `id`, o sistema aplica esta regra:

1. `Importação local` tem prioridade sobre `GitHub`.
2. `GitHub` (arquivo novo, fora do manifest) tem prioridade sobre o manifest.
3. Dentro da mesma origem, vence o arquivo em ordem alfabética.
4. Os duplicados ignorados aparecem no painel de erros/avisos de importação.

Isso deixa o comportamento previsível e facilita pré-visualizar um arquivo local sem apagar o do repositório.

## Como adicionar um novo roteiro direto pelo navegador do GitHub

1. Abra o repositório no GitHub.
2. Entre na pasta `procedimentos/`.
3. Clique em `Add file`.
4. Escolha `Upload files` para enviar um arquivo pronto, ou `Create new file` para criar um novo.
5. Envie um arquivo `.txt` ou `.json` com JSON válido em UTF-8.
6. Faça o commit direto na branch publicada.
7. Atualize o site no GitHub Pages.

Se a leitura automática pela API estiver disponível, o novo roteiro já aparecerá sem editar o código principal.

Para ele carregar pelo caminho rápido (e não depender da API), inclua o nome do arquivo no manifest. No computador, basta rodar:

```bash
node scripts/validar_roteiros.js --atualizar-manifest
```

## Como validar os roteiros

```bash
node scripts/validar_roteiros.js
```

O script usa as mesmas regras do site e aponta JSON inválido, campos obrigatórios ausentes, `id` duplicado, imagem inexistente e diferenças entre a pasta e o manifest. Rode antes de cada commit que mexer em `procedimentos/`.

## Como pedir ao Codex para adicionar um procedimento

Você pode pedir algo como:

```text
Adicione um novo roteiro de drenagem torácica na pasta /procedimentos/ em formato .txt, com imagem de capa e passos críticos destacados.
```

O ideal é mencionar:

- nome do procedimento;
- categoria;
- passos;
- indicações;
- contraindicações;
- se quer arquivo `.txt` ou `.json`;
- se quer imagem relativa em `assets/imagens/...`.

## Formato aceito para cada arquivo

### Opção 1: procedimento único

```json
{
  "id": "sonda_vesical_demora",
  "nome": "Passagem de sonda vesical de demora",
  "categoria": "Urologia / Procedimentos básicos",
  "descricao_curta": "Resumo curto",
  "indicacoes": ["Item 1"],
  "contraindicacoes": ["Item 1"],
  "preparo": ["Item 1"],
  "materiais": ["Item 1"],
  "acoes_iniciais": ["Item 1"],
  "passos": [
    {
      "numero": 1,
      "titulo": "Nome do passo",
      "descricao": "Descrição do passo",
      "critico": true,
      "alerta": "Mensagem opcional",
      "imagem": "assets/imagens/pasta/imagem.svg"
    }
  ],
  "observacoes_finais": ["Item 1"],
  "referencias": ["Fonte 1"],
  "imagem_capa": "assets/imagens/pasta/capa.svg"
}
```

### Opção 2: objeto com `"procedimentos"`

```json
{
  "procedimentos": [
    {
      "id": "reconstrucao_cutanea_por_enxertia",
      "nome": "Reconstrução cutânea por enxertia",
      "passos": [
        {
          "numero": 1,
          "titulo": "Preparar a sala",
          "descricao": "..."
        }
      ]
    }
  ]
}
```

## Campos mínimos obrigatórios

### Por procedimento

- `id`
- `nome`
- `passos`

### Por passo

- `numero`
- `titulo`
- `descricao`

### Disciplina (opcional)

O filtro "Disciplina" (HC I / HC II) é preenchido a partir do começo da `categoria`, por exemplo `"Habilidades Cirúrgicas II / Caixa torácica"`. Para outro valor, como um roteiro da liga, use o campo `"disciplina": "Liga"`.

Se faltar algum desses campos, o arquivo não quebra o site. Ele é ignorado e o motivo aparece no painel de importação.

## Como marcar uma etapa como crítica

Use:

```json
"critico": true
```

As etapas críticas aparecem destacadas visualmente no modo estudo e no modo sequência.

## Como usar imagens

Os campos suportados são:

- `imagem_capa`
- `imagem`

Você pode usar:

- URL absoluta;
- `data:image/...`;
- caminho relativo do repositório.

Exemplo recomendado para GitHub Pages:

```json
"imagem_capa": "assets/imagens/enxertia/capa.svg"
```

O carregador resolve esse caminho automaticamente com base na URL do site publicado.

## Como usar a importação local temporária

O topo do site tem quatro ações principais:

- `Recarregar procedimentos`
- `Importar arquivo local`
- `Importar vários arquivos locais`
- `Limpar importação local`

Uso típico:

1. Clique em `Importar arquivo local`.
2. Escolha um `.txt` ou `.json` do seu computador.
3. O arquivo será lido apenas na sessão atual do navegador.
4. Ele poderá coexistir temporariamente com os arquivos do GitHub.
5. Para voltar a usar apenas o repositório, clique em `Limpar importação local`.

Isso é útil para pré-visualizar um roteiro antes de subir o arquivo para o GitHub.

## Como configurar o repositório

Edite [config/app-config.json](config/app-config.json):

```json
{
  "github": {
    "owner": "SEU_USUARIO",
    "repo": "SEU_REPO",
    "branch": "main",
    "proceduresPath": "procedimentos"
  }
}
```

### Significado dos campos

- `owner`: usuário ou organização.
- `repo`: nome do repositório.
- `branch`: branch publicada.
- `proceduresPath`: pasta onde estão os arquivos de roteiro.

## O manifest

O arquivo `procedimentos/procedimentos-manifest.json` é a fonte principal da lista de roteiros: ele é lido do próprio site, é rápido e não depende da API do GitHub. Mantenha-o em dia com `node scripts/validar_roteiros.js --atualizar-manifest`.

Formato:

```json
{
  "files": [
    "sonda_vesical_demora.json",
    "reconstrucao_cutanea_por_enxertia.txt"
  ]
}
```

## Como publicar no GitHub Pages

1. Faça push do projeto para um repositório público.
2. No GitHub, abra `Settings`.
3. Entre em `Pages`.
4. Em `Build and deployment`, selecione:
   - `Source`: `Deploy from a branch`
   - `Branch`: `main` e pasta `/root`
5. Salve.
6. Aguarde a publicação.
7. Abra a URL do GitHub Pages e clique em `Recarregar procedimentos`.

## Versões

A versão publicada aparece no rodapé do site; clicando nela abre a lista de novidades. Quem volta ao site depois de uma atualização vê um aviso discreto no topo.

O histórico fica em `versoes.json`. Para publicar uma versão nova:

```bash
node scripts/nova_versao.js 1.4.0 "Título curto" "O que mudou" "Outra mudança"
```

O script acrescenta a versão em `versoes.json` e atualiza o `?v=` dos arquivos CSS e JS no `index.html`. Isso faz o navegador baixar sempre o CSS e o JS da mesma versão do HTML: o GitHub Pages guarda esses arquivos em cache por até 10 minutos, e misturar versões quebra o visual.

Depois do commit, marque a versão no git:

```bash
git tag -a v1.4.0 -m "Título curto"
git push origin v1.4.0
```

## Como rodar localmente

Para desenvolvimento, prefira um servidor local simples.

Se tiver Python instalado:

```bash
python -m http.server 8000
```

Depois abra:

```text
http://localhost:8000
```

Abrir diretamente com `file://` pode bloquear o carregamento de arquivos locais de configuração em alguns navegadores.

## Exemplos já incluídos

Esta versão já inclui:

- [procedimentos/sonda_vesical_demora.json](procedimentos/sonda_vesical_demora.json)
- [procedimentos/reconstrucao_cutanea_por_enxertia.txt](procedimentos/reconstrucao_cutanea_por_enxertia.txt)

E também imagens relativas em:

- [assets/imagens/sonda-vesical/](assets/imagens/sonda-vesical)
- [assets/imagens/reconstrucao-enxertia/](assets/imagens/reconstrucao-enxertia)
