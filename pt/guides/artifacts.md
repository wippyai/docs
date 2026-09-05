---
title: "Artefatos de build"
description: "Declarar um recurso de filesystem como um artefato ciente do formato, materializá-lo em um projeto consumidor e o que o runtime reconcilia automaticamente."
---

# Artefatos de build

Um módulo pode entregar um diretório que os consumidores usam **em tempo de build** em vez de
em tempo de execução — mais utilmente, um pacote contra o qual outros módulos compilam. O Wippy
chama isso de **artefatos**: recursos de filesystem WAPP comuns marcados com
`meta.artifact.format`.

É assim que um pacote compartilhado chega a um módulo em outro repositório. Um alias de
caminho só resolve dentro de um repositório; um artefato viaja com o módulo.

[A Camada de Design](../frontend/design-layer.md) explica *o que* pertence a tal
pacote e o que não pertence; esta página é o mecanismo que o entrega.

## Declarando um artefato

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

Nada mais muda: o recurso é embutido no WAPP como qualquer outro
`fs.directory` — liste-o em `embed:` no `wippy.yaml` ou passe `--embed` para
`wippy publish` e `wippy pack`; um diretório que não é embutido não é nem
empacotado nem validado. Artefatos declarados são **validados durante a
publicação do módulo e o pack da aplicação**, então um artefato malformado
falha na publicação, não em um consumidor.

## Formatos

Um adaptador de formato decide como um diretório é validado, que identidade ele tem
e onde ele é colocado. O Wippy entrega um formato integrado:

| Formato | Subárvore própria | Valida |
|---|---|---|
| `node-package` | `npm/` | `package.json` |

`node-package` exige um `name` e uma `version` semântica, e **rejeita os scripts de
ciclo de vida `preinstall`, `install`, `postinstall` e `prepare`** — um pacote
materializado não pode executar nada na instalação. Ele escreve em
`npm/<nome do pacote>` sob a raiz de materialização.

O formato deve estar registrado no binário que faz o trabalho. Hosts podem registrar
formatos adicionais; nomes duplicados e raízes sobrepostas são rejeitados.

## Materializando

Na maior parte do tempo você não executa nada. As saídas materializadas são reconciliadas
automaticamente durante:

- `wippy install` e `wippy update` completos e direcionados
- cold boot
- instalação, atualização e desinstalação dinâmicas via Hub

Instalação completa, atualização, cold boot e reconciliação de dependências em tempo de execução são
*exatas*: saídas obsoletas são removidas. Uma instalação **direcionada** sobrepõe apenas os
módulos selecionados e preserva saídas pertencentes a módulos que ela não selecionou.

Substituições locais de módulos passam pelo mesmo ciclo de validação e materialização
que os recursos empacotados, então o artefato de um módulo substituído se comporta como um
publicado.

### Materializando explicitamente

Para uma etapa de build que precisa do artefato antes de o runtime entrar em cena, a
CLI o expõe diretamente:

```bash
wippy artifacts materialize <pack.wapp> <namespace:name> [--root <directory>]
```

`--root` tem como padrão `.wippy`. O recurso deve declarar `meta.artifact.format`
e esse formato deve estar registrado nesta CLI.

Seja claro sobre o que este comando deliberadamente **não** faz: ele não
resolve dependências de módulos, não altera o `wippy.lock`, não invoca
gerenciadores de pacotes e não participa da composição em tempo de execução. Ele valida
um artefato de um WAPP e o escreve em disco.

### Onde a saída é colocada

`artifact.materialization_root` configura a raiz de saída pertencente à aplicação.
Seu padrão é o diretório pai do diretório vendor de dependências. Cada formato é dono de
uma subárvore não sobreposta abaixo dela, então a saída de `node-package` fica sempre sob
`<root>/npm/`.

A materialização é transacional. O conteúdo é validado e preparado, as raízes gerenciadas
são trocadas atomicamente sob um lock de processo, uma falha faz rollback junto com a
transação de registro circundante, e uma troca interrompida é recuperada na
execução seguinte.

## Exemplo prático: um pacote de frontend compartilhado

Um módulo produtor cujo único trabalho é publicar um pacote — ele não serve nada em
tempo de execução:

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

Um consumidor o materializa em sua própria árvore antes de instalar dependências:

```bash
wippy artifacts materialize kickside-ui-kit-1.5.0.wapp \
  kickside.ui_kit:package_fs --root ./.wippy
```

Isso escreve `./.wippy/npm/@kickside/ui-kit`. O consumidor o captura com um
glob de workspaces comum, então a resolução dali em diante é resolução node pura:

```json
{
  "workspaces": ["./.wippy/npm/@*/*"]
}
```

```bash
npm install
```

Duas coisas vale a pena copiar deste formato:

- **O pacote é seu próprio módulo, não um diretório dentro de outro maior.** O
  artefato carrega sua própria versão de `package.json`, e amarrá-lo a um módulo
  que muda por razões não relacionadas força um release de um toda vez que o
  outro se move.
- **O consumidor o resolve como uma dependência normal.** Uma vez materializado, não
  há caminho de import específico do Wippy, e é isso que permite que o mesmo código-fonte
  seja compilado dentro do monorepo e fora dele.

## De ponta a ponta: autoria, loop de desenvolvimento, CI

### Escrevendo o produtor

Para um artefato de pacote geralmente **não há nada para compilar** — o diretório é
o entregável. Um pacote de vocabulário CSS é apenas arquivos mais um manifesto:

```text
platform/ui-kit/
├── src/_index.yaml      # declara package_fs como o artefato
└── package/             # o diretório que se torna o pacote npm
    ├── package.json
    ├── kx-card.css
    └── kx-state.css
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

`sideEffects` importa para um pacote somente-CSS: sem ele, um bundler fica livre para
tratar uma folha de estilos importada como código morto e descartá-la.

**A versão do pacote deve ser igual à versão do módulo.** O `wippy publish`
valida isso e recusa uma divergência, então incremente ambas juntas. Essa é também a
razão para dar a um pacote compartilhado seu *próprio* módulo em vez de aninhá-lo dentro de
um maior — caso contrário, toda mudança não relacionada no módulo hospedeiro força um
release do pacote, e vice-versa.

### Publicando

```bash
# valida sem publicar
wippy publish --dry-run --version 1.5.0 --embed package_fs

# publica
wippy publish --create --module-type library --module-visibility public --version 1.5.0 --embed package_fs
```

Artefatos declarados são validados como parte da publicação, então um package.json que
falha nas regras do formato é rejeitado aqui e não no build de um consumidor.

### O loop de desenvolvimento

Publicar a cada edição não é um loop de desenvolvimento. Empacote o produtor localmente e aponte
a etapa de materialização do consumidor para esse arquivo:

```bash
# a partir do módulo produtor
wippy pack /tmp/ui-kit-dev.wapp --embed package_fs

# consumidores materializam a partir do pack local em vez do publicado
UI_KIT_WAPP=/tmp/ui-kit-dev.wapp make ui-kit MOD=workflows
```

Mantenha esse override como a *única* diferença entre o caminho de desenvolvimento e o de CI — uma
variável de ambiente que seleciona o arquivo de pack, com tudo mais abaixo dela idêntico.
Um loop de desenvolvimento que materializa de forma diferente do CI deixa de prever
o CI.

### Integrando ao make e ao CI

Faça da etapa de materialização um **pré-requisito do build do consumidor**, não algo
que uma pessoa precisa lembrar de executar:

```make
UI_KIT_WAPP ?=

build:
	@case " $(UI_KIT_CONSUMERS) " in *" $(MOD) "*) $(MAKE) ui-kit MOD=$(MOD);; esac
	cd $(call fe_dir,$(MOD)) && npm run build
```

O CI então não precisa de nenhuma etapa específica de artefatos: ele roda o mesmo `make build`,
`UI_KIT_WAPP` não está definida, então o caminho de buscar-e-materializar roda contra a
versão publicada fixada em `build-inputs`. Um checkout novo não consegue compilar
contra um pacote obsoleto ou ausente, e um contribuidor que nunca ouviu falar de
artefatos ainda obtém um build correto.

## O que você ainda tem que montar à mão

`wippy artifacts materialize` é deliberadamente restrito, então um build que consome
um artefato atualmente cola quatro etapas por conta própria. Saber quais são as quatro
poupa redescobri-las:

**1. Obter o `.wapp`.** O comando recebe um *caminho de arquivo de pack*, não uma referência
de módulo, e não resolve dependências — então algo tem que buscar o
produtor primeiro. O padrão que funciona é um projeto Wippy minúsculo cujo único trabalho é
fixá-lo e baixá-lo:

```yaml
# build-inputs/wippy.lock — um projeto que existe só para buscar
directories:
  modules: .wippy
  src: ./src
modules:
  - name: kickside/ui-kit
    version: 1.5.0
    hash: be1eafd5…
```

```bash
( cd build-inputs && wippy install )
wapp=$(ls build-inputs/.wippy/vendor/kickside/ui-kit-*.wapp | grep -v sha256 | sort | tail -1)
```

Fixá-lo aqui em vez de no lock da aplicação mantém uma entrada de tempo de build
fora do grafo de dependências de tempo de execução.

**2. Materializar uma vez por consumidor**, em uma raiz que o gerenciador de pacotes do
consumidor consiga ver:

```bash
wippy artifacts materialize "$wapp" kickside.ui_kit:package_fs --root ./ui/.wippy
```

**3. Ligar o `package.json` do consumidor.** Materializar escreve arquivos; não
edita manifestos. O npm vincula o pacote apenas se o consumidor declarar
*ambos*: o glob de workspace e a dependência:

```json
{
  "workspaces": ["./.wippy/npm/@*/*"],
  "dependencies": { "@kickside/ui-kit": "*" }
}
```

A versão é `*` porque o pacote materializado carrega a sua própria. Coloque isso em
script e torne-o idempotente — se a ligação estiver faltando, o build falha muito
mais tarde com um `ENOENT` seco em uma folha de estilos, o que se lê como arquivo ausente
e não como ligação ausente.

**4. Executar o gerenciador de pacotes.** O `materialize` não invoca nenhum, então
`npm install` é sua responsabilidade, após a etapa 3.

Tudo junto, em um target que recebe o módulo consumidor como parâmetro:

```make
ui-kit:
	@set -e; \
	( cd build-inputs && $(WIPPY) install ); \
	wapp=$$(ls build-inputs/.wippy/vendor/kickside/ui-kit-*.wapp | grep -v sha256 | sort | tail -1); \
	test -n "$$wapp" || { echo "no ui-kit .wapp; is the module published?"; exit 1; }; \
	$(WIPPY) artifacts materialize "$$wapp" kickside.ui_kit:package_fs --root $(DIR)/.wippy; \
	cd $(DIR) && node ../../scripts/wire-ui-kit.mjs && npm install --no-audit --no-fund
```

Faça do target inteiro um pré-requisito do build do consumidor, para que um checkout
novo não consiga compilar contra um pacote obsoleto ou ausente.

## Fora de escopo

Artefatos intencionalmente não introduzem um segundo resolvedor, registro de pacotes,
formato de arquivo, esquema de lock, API de Hub ou manifesto de módulo. Semântica de dependência
apenas de build, política de redistribuição e validação de ABI do host são preocupações separadas
e não são resolvidas aqui.

## Relacionado

- [Gerenciamento de Dependências](./dependency-management.md) — resolvendo módulos e
  substituições locais
- [Publicação](./publishing.md) — o que um módulo publicado contém
- [A Camada de Design](../frontend/design-layer.md) — por que um vocabulário de frontend
  compartilhado é entregue como pacote em primeiro lugar
