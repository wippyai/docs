# Sistema de Arquivos

Acesso a diretorios e sistemas de arquivos embutidos.

## Tipos de Entradas

| Tipo | Descricao |
|------|-----------|
| `fs.directory` | Sistema de arquivos baseado em diretorio |
| `fs.embed` | Sistema de arquivos embutido somente leitura |

## Sistema de Arquivos de Diretorio

```yaml
- name: uploads
  kind: fs.directory
  directory: "/var/data/uploads"
  auto_init: true
  mode: "0755"
```

| Campo | Tipo | Padrao | Descricao |
|-------|------|--------|-----------|
| `directory` | string | obrigatorio | Caminho raiz |
| `auto_init` | bool | false | Cria diretorio se ausente |
| `mode` | string | 0755 | Modo de permissao Unix (octal) |

O modo restringe todas as operacoes de arquivo. Bits de execucao sao adicionados automaticamente quando bits de leitura estao presentes.

<note>
Caminhos sao normalizados e validados. Nao e possivel acessar arquivos fora do diretorio raiz configurado.
</note>

## Sistema de Arquivos Embutido

```yaml
- name: static
  kind: fs.embed
```

Sistemas de arquivos embutidos carregam de recursos de pack usando o ID da entrada. Eles sao somente leitura.

<warning>
Sistemas de arquivos embutidos sao um mecanismo interno. Configuracao manual tipicamente nao e necessaria.
</warning>

## Operacoes

Ambos os tipos de sistema de arquivos implementam:

| Operacao | Directory | Embed |
|----------|-----------|-------|
| Open/Read | Sim | Sim |
| Stat | Sim | Sim |
| ReadDir | Sim | Sim |
| OpenFile (escrita) | Sim | Nao |
| Remove | Sim | Nao |
| Mkdir | Sim | Nao |

Operacoes de escrita em sistemas de arquivos embutidos retornam um erro.

## API Lua

Veja [Modulo Filesystem](lua-fs.md) para operacoes de arquivo.
