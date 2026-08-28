---
title: "Artefatos de build"
description: "Declare, valide, publique e materialize artefatos de sistema de arquivos com formato definido para projetos consumidores."
---

# Artefatos de build

Um módulo pode distribuir um diretório que os consumidores usam **durante o build**, e não durante a execução, como um pacote contra o qual outros módulos são compilados. O Wippy chama esses recursos de **artefatos**: recursos de sistema de arquivos WAPP marcados com `meta.artifact.format`.

Os artefatos permitem que um pacote compartilhado acompanhe um módulo através dos limites entre repositórios, onde um alias de caminho local ao repositório não conseguiria resolvê-lo.

[A camada de design](../frontend/design-layer.md) explica *o que* pertence a esse tipo de pacote e o que não pertence; esta página descreve o mecanismo que o distribui.

## Declarar um artefato

O produtor declara um `fs.directory` normal e o marca com um formato:

```yaml
# src/_index.yaml
entries:
  - name: package_fs
    kind: fs.directory
    meta:
      comment: The npm package consumers materialize at build time.
      artifact:
        format: node-package
    directory: ./package
```

O marcador sozinho não inclui o conteúdo do diretório. Selecione o entry `fs.directory` pela lista `embed:` do manifest do produtor ou pela opção `--embed` de publish/pack. Depois de selecionado, o entry é transformado em um recurso empacotado e o formato do artefato é validado; artefatos selecionados malformados falham antes da criação do WAPP.

## Formatos

Um adaptador de formato determina como um diretório é validado, qual é sua identidade e onde ele será gravado. O Wippy inclui um formato nativo:

| Formato | Subárvore própria | Valida |
|---|---|---|
| `node-package` | `npm/` | `package.json` |

`node-package` exige `name` e uma `version` semântica e **rejeita scripts de ciclo de vida `preinstall`, `install`, `postinstall` e `prepare`** — um pacote materializado não pode executar nada durante a instalação. Ele é gravado em `npm/<package name>` dentro da raiz de materialização.

O formato precisa estar registrado no binário que executa a operação. Hosts podem registrar formatos adicionais; nomes duplicados e raízes sobrepostas são rejeitados.

## Materialização

As saídas materializadas são reconciliadas automaticamente durante:

- `wippy install` e `wippy update`, completos ou direcionados;
- inicialização a frio;
- instalação, atualização e desinstalação dinâmicas por meio do Hub.

Instalação completa, atualização, inicialização a frio e reconciliação de dependências em runtime são *exatas*: saídas obsoletas são removidas. Uma instalação **direcionada** sobrepõe somente os módulos selecionados e preserva as saídas pertencentes aos módulos que não selecionou.

Substituições de módulos locais passam pelo mesmo ciclo de validação e materialização que recursos empacotados; portanto, o artefato de um módulo substituído se comporta como um artefato publicado.

### Materialização explícita

Para uma etapa de build que precisa do artefato antes do envolvimento da runtime, a CLI o expõe diretamente:

```bash
wippy artifacts materialize <pack.wapp> <namespace:name> [--root <directory>]
```

O valor padrão de `--root` é `.wippy`. O recurso deve declarar `meta.artifact.format`, e esse formato deve estar registrado nesta CLI.

Esse comando **não** resolve dependências de módulos, não altera `wippy.lock`, não invoca gerenciadores de pacotes e não participa da composição da runtime. Ele valida um artefato de um WAPP e o grava em disco.

### Local da saída

`artifact.materialization_root` configura a raiz de saída controlada pela aplicação. O valor padrão é o diretório pai do diretório de dependências do vendor. Cada formato possui uma subárvore sem sobreposição dentro dessa raiz; portanto, a saída de `node-package` sempre fica em `<root>/npm/`.

A materialização é transacional. O conteúdo é validado e preparado em staging; as raízes gerenciadas são trocadas atomicamente sob um lock de processo; uma falha provoca rollback junto com a transação de registry; e uma troca interrompida é recuperada na próxima execução.

## Exemplo de integração: um pacote frontend compartilhado

Os nomes `kickside/ui-kit`, targets de Make, variáveis de ambiente e caminhos de repositório desta seção ilustram um padrão de integração. Eles não são comandos ou scripts auxiliares fornecidos pelo Wippy; adapte-os ao produtor e ao sistema de build que controlam o artefato.

Um módulo produtor pode publicar um pacote sem servir um recurso de runtime:

```yaml
# platform/ui-kit/src/_index.yaml
version: "1.0"
namespace: kickside.ui_kit

entries:
  - name: package_fs
    kind: fs.directory
    meta:
      artifact:
        format: node-package
    directory: ./package
```

Um consumidor o materializa em sua própria árvore antes de instalar as dependências:

```bash
wippy artifacts materialize kickside-ui-kit-1.5.0.wapp \
  kickside.ui_kit:package_fs --root ./.wippy
```

Isso grava `./.wippy/npm/@kickside/ui-kit`. O consumidor o inclui com um glob comum de workspaces; a partir daí, a resolução é a resolução normal do Node:

```json
{
  "workspaces": ["./.wippy/npm/@*/*"]
}
```

```bash
npm install
```

Esse arranjo tem duas propriedades importantes:

- **O pacote é um módulo próprio, não um diretório dentro de um módulo maior.** O artefato carrega sua própria versão em `package.json`; vinculá-lo a um módulo que muda por motivos alheios obriga a publicar um sempre que o outro mudar.
- **O consumidor o resolve como uma dependência normal.** Depois da materialização, não existe um caminho de importação específico do Wippy. Isso permite compilar o mesmo código-fonte dentro e fora do monorepo.

## Fluxo completo

### Autoria do produtor

Para um artefato de pacote, o próprio diretório pode ser o entregável. Um pacote de vocabulário CSS consiste em seus arquivos e manifest:

```text
platform/ui-kit/
├── wippy.yaml           # selects package_fs for embedding
├── src/_index.yaml      # declares package_fs as the artifact
└── package/             # the directory that becomes the npm package
    ├── package.json
    ├── kx-card.css
    └── kx-state.css
```

Mantenha a seleção de embed no manifest do produtor para que publicação, pack local e CI usem o mesmo conjunto de recursos:

```yaml
# platform/ui-kit/wippy.yaml
embed:
  - package_fs
```

```json
{
  "name": "@kickside/ui-kit",
  "version": "1.5.0",
  "type": "module",
  "sideEffects": ["*.css"],
  "exports": {
    "./kx-card.css": "./kx-card.css",
    "./kx-state.css": "./kx-state.css"
  },
  "files": ["kx-card.css", "kx-state.css", "package.json"]
}
```

`sideEffects` é importante para um pacote apenas de CSS: sem esse campo, um bundler pode tratar uma folha de estilo importada como código morto e removê-la.

**A versão do pacote deve ser igual à versão do módulo.** `wippy publish` valida essa condição e rejeita divergências; portanto, incremente ambas ao mesmo tempo. Esse também é o motivo para dar a um pacote compartilhado seu *próprio* módulo em vez de aninhá-lo em um maior: do contrário, cada alteração não relacionada no módulo hospedeiro exige uma nova versão do pacote, e vice-versa.

### Publicação

```bash
# validate without publishing
wippy publish --dry-run --version 1.5.0

# publish
wippy publish --create --module-type library --module-visibility public --version 1.5.0
```

Como o manifest do produtor seleciona `package_fs` para embed, o artefato é incluído e validado durante a publicação. Um `package.json` que viole as regras do formato é rejeitado aqui, não durante o build de um consumidor.

### Ciclo de desenvolvimento

Durante o desenvolvimento, empacote o produtor localmente e aponte a etapa de materialização do consumidor para esse arquivo:

```bash
# from the producer module
wippy pack /tmp/ui-kit-dev.wapp

# consumers materialize from the local pack rather than the published one
UI_KIT_WAPP=/tmp/ui-kit-dev.wapp make ui-kit MOD=workflows
```

Mantenha a substituição do arquivo de pack como a única diferença entre desenvolvimento e CI. Uma variável de ambiente pode selecionar o pack local sem alterar as etapas posteriores de materialização e build.

### Integração com build e CI

Faça da materialização um **pré-requisito do build do consumidor**:

```make
UI_KIT_WAPP ?=

build:
	@case " $(UI_KIT_CONSUMERS) " in *" $(MOD) "*) $(MAKE) ui-kit MOD=$(MOD);; esac
	cd $(call fe_dir,$(MOD)) && npm run build
```

Assim, o CI pode executar o mesmo `make build` sem uma etapa de artefato adicional. `UI_KIT_WAPP` fica vazio, então o caminho de busca e materialização usa a versão publicada fixada em `build-inputs`. Um checkout novo não consegue compilar com um pacote ausente ou obsoleto, e um colaborador que nunca ouviu falar em artefatos ainda obtém um build correto.

## Etapas de integração do consumidor

Como `wippy artifacts materialize` processa um recurso de um pack, o build consumidor precisa coordenar quatro etapas:

**1. Buscar o `.wapp`.** O comando recebe um *caminho de arquivo de pack*, não uma referência de módulo, e não resolve dependências. Uma opção é um pequeno projeto Wippy que fixa e baixa o produtor:

```yaml
# build-inputs/wippy.lock — a project that exists only to fetch
modules:
  - name: kickside/ui-kit
    version: 1.5.0
    hash: be1eafd5…
```

```bash
( cd build-inputs && wippy install )
wapp=$(ls build-inputs/.wippy/vendor/kickside/ui-kit-*.wapp | grep -v sha256 | sort | tail -1)
```

Fixar o módulo aqui, em vez de no lock da aplicação, mantém uma entrada de build fora do grafo de dependências da runtime.

**2. Materializar uma vez por consumidor** em uma raiz visível ao gerenciador de pacotes do consumidor:

```bash
wippy artifacts materialize "$wapp" kickside.ui_kit:package_fs --root ./ui/.wippy
```

**3. Configurar o `package.json` do consumidor.** A materialização grava arquivos; ela não edita manifests. O npm vincula o pacote apenas se o consumidor declarar **tanto** o glob de workspace quanto a dependência:

```json
{
  "workspaces": ["./.wippy/npm/@*/*"],
  "dependencies": { "@kickside/ui-kit": "*" }
}
```

A versão é `*` porque o pacote materializado contém sua própria versão. Automatize esta etapa e torne-a idempotente. Sem a configuração do manifest, o build pode depois relatar um `ENOENT` para uma folha de estilo em vez de identificar a dependência ausente.

**4. Executar o gerenciador de pacotes.** `materialize` não o invoca; portanto, execute `npm install` depois da etapa 3.

Em conjunto, em um target que recebe o módulo consumidor como parâmetro:

```make
ui-kit:
	@set -e; \
	( cd build-inputs && $(WIPPY) install ); \
	wapp=$$(ls build-inputs/.wippy/vendor/kickside/ui-kit-*.wapp | grep -v sha256 | sort | tail -1); \
	test -n "$$wapp" || { echo "no ui-kit .wapp; is the module published?"; exit 1; }; \
	$(WIPPY) artifacts materialize "$$wapp" kickside.ui_kit:package_fs --root $(DIR)/.wippy; \
	cd $(DIR) && node ../../scripts/wire-ui-kit.mjs && npm install --no-audit --no-fund
```

Faça do target completo um pré-requisito do build do consumidor para impedir que um checkout novo compile contra um pacote ausente ou obsoleto.

## Fora do escopo

Artefatos não introduzem um segundo resolver, registry de pacotes, formato de archive, schema de lock, API do Hub ou manifest de módulo. Semântica de dependências exclusivas de build, política de redistribuição e validação de ABI do host são assuntos separados e não são resolvidos aqui.

## Relacionados

- [Gerenciamento de dependências](./dependency-management.md) — resolução de módulos e substituições locais
- [Publicação](./publishing.md) — conteúdo de um módulo publicado
- [A camada de design](../frontend/design-layer.md) — por que um vocabulário frontend compartilhado é distribuído como pacote
