# Sistema de Arquivos

Acesso a diretórios e sistemas de arquivos embutidos.

## Tipos de Entradas

| Tipo | Descrição |
|------|-----------|
| `fs.directory` | Sistema de arquivos baseado em diretório |
| `fs.embed` | Sistema de arquivos embutido somente leitura |

## Sistema de Arquivos de Diretório

```yaml
- name: uploads
  kind: fs.directory
  directory: "/var/data/uploads"
  auto_init: true
  mode: "0755"
```

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `directory` | string | obrigatório | Caminho raiz |
| `auto_init` | bool | false | Cria diretório se ausente |
| `mode` | string | 0755 | Modo de permissão Unix (octal) |

O modo restringe todas as operações de arquivo. Bits de execução são adicionados automaticamente quando bits de leitura estão presentes.

<note>
Caminhos são normalizados e validados. Não é possível acessar arquivos fora do diretório raiz configurado.
</note>

## Sistema de Arquivos Embutido

```yaml
- name: static
  kind: fs.embed
```

Sistemas de arquivos embutidos carregam de recursos de pack usando o ID da entrada. Eles são somente leitura.

<warning>
Sistemas de arquivos embutidos são um mecanismo interno. Configuração manual tipicamente não é necessária.
</warning>

## Operações

Ambos os tipos de sistema de arquivos implementam:

| Operação | Directory | Embed |
|----------|-----------|-------|
| Open/Read | Sim | Sim |
| Stat | Sim | Sim |
| ReadDir | Sim | Sim |
| OpenFile (escrita) | Sim | Não |
| Remove | Sim | Não |
| Mkdir | Sim | Não |

Operações de escrita em sistemas de arquivos embutidos retornam um erro.

## API Lua

Veja [Módulo Filesystem](lua-fs.md) para operações de arquivo.
