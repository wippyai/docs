---
title: "TTY"
description: "<secondary-label ref='process'/ <secondary-label ref='io'/"
---

# TTY
<secondary-label ref="process"/>
<secondary-label ref="io"/>

Eventos de entrada de terminal, saída estilizada, surfaces de apresentação e viewports virtuais locais.

<note>
Cada função resolve a porta de terminal anexada ao frame do processo chamador. Um processo em um <a href="system/terminal.md">Terminal Host</a> é dono do terminal físico; um <code>process.lua</code> em um <code>process.host</code> comum é dono de um terminal virtual quando é criado com uma concessão de viewport. Sem nenhuma dessas anexações o módulo retorna "no terminal context".
</note>

## Carregamento

```lua
local tty = require("tty")
```

## Modelo

Uma **Surface** é o lease exclusivo de apresentação de um processo sobre sua porta de terminal. Ela publica snapshots completos de linhas; o backend cuida do diffing e da recuperação do terminal. Apenas uma surface pode estar aberta em uma porta por vez.

Um **Canvas** é um buffer de composição de células estilizadas dentro do processo. Ele recorta em limites de célula e nunca emite comandos de controle de terminal próprios.

Um **Viewport** é um limite de terminal local e estruturado que permite a um processo hospedar a surface de outro processo sem compartilhar streams de bytes. O shell decide onde o conteúdo do viewport aparece e traduz a entrada para as coordenadas do filho; o filho vê uma porta de terminal comum e não sabe se está em tela cheia, lado a lado, em abas ou oculto.

Viewports são locais a um nó de runtime. Concessões e handles são capacidades locais opacas, não referências de rede serializáveis.

## Loop de Entrada

Inicia a entrega de entrada, inscreve-se nos eventos e os processa em loop:

```lua
local tty = require("tty")
local io = require("io")

local function handler()
    local events = tty.events()
    tty.start()

    while true do
        local ev = events:receive()
        if not ev then break end

        if ev.type == "key" then
            if ev.key == "q" or (ev.ctrl and ev.key == "c") then
                break
            end
            io.print("Key: " .. ev.key)

        elseif ev.type == "resize" then
            io.print("Size: " .. ev.width .. "x" .. ev.height)
        end
    end

    tty.stop()
end
```

Chame `events()` antes de `start()` para que um consumidor esteja pronto quando os primeiros eventos chegarem. Em uma porta virtual, `start()` abre a entrega de eventos do viewer para o produtor e `stop()` a fecha: um `Viewport:send()` fora desse intervalo falha em vez de descartar a entrada silenciosamente. A entrega de resize é independente do estado da entrada.

## Controle de Entrada

### tty.start()

Inicia a entrega de entrada para a porta atual. Um terminal físico alterna para o modo raw.

```lua
local ok, err = tty.start()
```

**Retorna:** `boolean, error`

### tty.stop()

Interrompe a entrega de entrada e restaura o terminal ao modo normal.

```lua
local ok, err = tty.stop()
```

**Retorna:** `boolean, error`

### tty.events()

Inscreve-se nos eventos de terminal da porta e retorna um channel. Eventos são entregues como tabelas com um campo `type`. Inscreva-se uma vez e reutilize o channel.

```lua
local events, err = tty.events()
```

**Retorna:** `EventChannel, error`

`EventChannel` tem `receive()` e `case_receive()`, portanto compõe com `channel.select`.

### tty.screen_size()

Consulta as dimensões atuais do terminal.

```lua
local width, height, err = tty.screen_size()
```

**Retorna:** `number, number, error`

### tty.mouse(enable)

Habilita ou desabilita o rastreamento de eventos de mouse.

```lua
local ok, err = tty.mouse(true)
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-------------|
| `enable` | boolean | `true` para habilitar, `false` para desabilitar |

**Retorna:** `boolean, error`

## Surface

Uma surface é o lease de apresentação da porta. Adquira uma, publique frames completos, e feche-a ao terminar.

### tty.surface(options?)

```lua
local surface, err = tty.surface({
    alternate_screen = true,
    hide_cursor = true,
    synchronized_output = true,
})
```

| Opção | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `alternate_screen` | boolean | false | Apresenta no buffer de tela alternativa do terminal |
| `hide_cursor` | boolean | false | Oculta o cursor do terminal enquanto a surface estiver aberta |
| `synchronized_output` | boolean | false | Envolve cada frame em marcadores de saída sincronizada |

**Retorna:** `Surface, error`

Abrir uma segunda surface em uma porta que já tem uma falha. Uma porta virtual mantém as opções como metadados da surface; uma porta física as traduz em modos de terminal e os restaura no fechamento.

### surface:present(rows, options?)

Publica um array completo de strings de linha. A linha `1` é a linha do topo.

```lua
local stats, err = surface:present(rows, {
    cursor = {x = 12, y = 3, visible = true},
})
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `rows` | string[] | Frame completo, no máximo 16384 linhas |
| `options.cursor` | table | `{x, y, visible}` em coordenadas de surface baseadas em 1 |

Omitir `cursor` preserva o último estado explícito do cursor. Os três campos do cursor são obrigatórios quando `cursor` está presente.

**Retorna:** `stats, error` — um registro imutável com `rows`, `changed_rows` e `bytes_written`. Um frame físico idêntico ao anterior não escreve nada.

### surface:invalidate()

Esquece o estado de apresentação do backend sem apagar o frame lógico. O próximo `present` é comitado mesmo com linhas inalteradas. Use-o após um resize do terminal externo ou quando outro dono possa ter perturbado o estado físico.

**Retorna:** `boolean`

### surface:close()

Libera o lease. Idempotente: chamadas posteriores retornam o resultado do primeiro fechamento. Um backend físico restaura os modos do terminal.

**Retorna:** `boolean, error`

## Canvas

Um canvas é um buffer limitado de células estilizadas usado para compor um frame antes de apresentá-lo.

### tty.canvas(width, height)

```lua
local canvas = tty.canvas(width, height)
```

A largura é limitada a 16384 colunas, a altura a 16384 linhas, e a área a 262.144 células. Argumentos fora do intervalo geram um erro de argumento.

**Retorna:** `Canvas`

O desenho aceita texto estilizado, não comandos de terminal. Cores SGR e links OSC 8 são preservados; saída de apagamento, movimentação de cursor e outros controles não é emitida. Cada posicionamento é recortado independentemente em limites de célula com ciência da largura de grafemas, de modo que uma sequência de escape recortada não pode vazar para o conteúdo vizinho.

### canvas:clear(fill?)

Limpa todas as células. Uma string estilizada `fill` opcional é repetida em cada linha.

```lua
canvas:clear()
canvas:clear(tty.style():background("#1a1a1a"):render(" "))
```

**Retorna:** `boolean`

### canvas:put(x, y, text, width?)

Posiciona uma linha estilizada em `x`, `y` baseados em 1 e a recorta em `width` células (padrão: a largura do canvas). As coordenadas podem ser negativas ou além da borda; o posicionamento é recortado em vez de rejeitado. Uma quebra de linha encerra a linha, então use `put_rows` para conteúdo de múltiplas linhas.

```lua
canvas:put(3, 1, tty.style():bold():render("Title"), 40)
```

**Retorna:** `boolean`

### canvas:put_rows(x, y, rows, width?)

Posiciona um array de linhas estilizadas começando em `x`, `y`, uma linha por vez para baixo. Cada entrada é validada antes de qualquer desenho.

```lua
canvas:put_rows(2, 2, child_rows, inner_width)
```

**Retorna:** `boolean`

### canvas:rows()

Renderiza o array completo de linhas, pronto para `surface:present`.

**Retorna:** `string[]`

## Viewport

Um viewport é uma porta de terminal virtual. O processo criador é seu primeiro viewer; o processo admitido com sua concessão é seu produtor.

### tty.viewport(options?)

```lua
local view, err = tty.viewport({width = 80, height = 24})
```

| Opção | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `width` | number | 80 | Colunas, 1 a 65535 |
| `height` | number | 24 | Linhas, 1 a 65535 |

A área é limitada a 262.144 células.

**Retorna:** `Viewport, error`

### tty.attach(handle)

Adiciona outro viewer local a um viewport existente. Um handle concede visualização, nunca a posse da apresentação, e não é válido em outro nó.

```lua
local view, err = tty.attach(handle)
```

**Retorna:** `Viewport, error`

### viewport:grant()

Retorna a capacidade de produtor de uso único. Passe-a como a opção de spawn `terminal`:

```lua
local grant = assert(view:grant())
local child = assert(process.with_options({terminal = grant})
    :spawn_monitored("app:child", "app:workers"))
```

A admissão consome a concessão transacionalmente: um start rejeitado restaura uma concessão não resolvida, enquanto um processo que resolveu a porta a consome permanentemente. Um host que não suporta anexações de terminal rejeita o spawn em vez de descartar a opção. Veja [Processos](lua/core/process.md#spawner-with-options).

**Retorna:** `string, error`

### viewport:handle()

Retorna o handle de viewer local para `tty.attach`.

**Retorna:** `string`

### viewport:snapshot(after_revision?)

Lê as dimensões, linhas, cursor e revisão atuais. Com `after_revision`, retorna `nil` quando a revisão não mudou.

```lua
local frame = view:snapshot(revision)
if frame then
    revision = frame.revision
    canvas:put_rows(2, 2, frame.rows, inner_width)
end
```

**Retorna:** `snapshot` ou `nil`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `revision` | number | Revisão monotônica deste frame |
| `width` | number | Colunas do viewport |
| `height` | number | Linhas do viewport |
| `rows` | string[] | Linhas publicadas por último pelo produtor |
| `cursor` | table | `{x, y, visible}` em coordenadas baseadas em 1, ausente até o produtor publicar um estado de cursor explícito |

### viewport:updates()

Retorna um channel de marcas d'água de revisão coalescidas. `receive()` entrega o número da revisão; `case_receive()` compõe com `channel.select`.

```lua
local updates = assert(view:updates())
```

As atualizações são dicas limitadas, não um log de eventos. Um viewer lento recebe apenas a marca d'água mais recente e deve chamar `snapshot()` para obter o estado. Apresentação e resize nunca bloqueiam por causa de um viewer lento.

**Retorna:** `ViewportUpdateChannel, error`

### viewport:send(event)

Encaminha um registro de evento validado ao produtor. O produtor deve ter chamado `tty.start()`; caso contrário a chamada falha em vez de descartar o evento.

```lua
assert(view:send(event))
assert(view:send({type = "close"}))
```

**Retorna:** `boolean, error`

### viewport:resize(width, height)

Atualiza a geometria do viewport. Quando o tamanho muda, os viewers recebem uma nova revisão e o produtor recebe um evento `resize`.

**Retorna:** `boolean, error`

### viewport:close()

Desanexa apenas este viewer. Fechar o último viewer não mata um produtor ativo, e fechar a porta do produtor não destrói o estado enquanto restarem viewers.

**Retorna:** `boolean, error`

## Tipos de Evento

Eventos são tabelas com um campo `type` que determina quais outros campos estão presentes. As coordenadas são baseadas em 1. Os mesmos registros são aceitos por `viewport:send()`.

### Evento de Tecla

```lua
{
    type = "key",
    key = "a",           -- caractere imprimível ou nome da tecla
    key_type = "runes",  -- "runes" para imprimível, ou nome de tecla especial
    action = "press",    -- "press" ou "release"
    alt = false,
    ctrl = false,
    shift = false
}
```

### Evento de Mouse

Requer `tty.mouse(true)`.

```lua
{
    type = "mouse",
    action = "press",    -- "press", "release", "motion", "wheel"
    button = "left",     -- nome do botão
    x = 10,
    y = 5,
    alt = false,
    ctrl = false,
    shift = false
}
```

### Evento de Redimensionamento

```lua
{type = "resize", width = 120, height = 40}
```

### Evento de Início

Emitido uma vez após `tty.start()` com as dimensões iniciais.

```lua
{type = "start", width = 120, height = 40}
```

### Evento de Foco

Reporta a posse do teclado.

```lua
{type = "focus", focused = true}
```

### Evento de Visibilidade

Reporta se repintar é útil. Ele não prescreve o ciclo de vida da aplicação nem computação em segundo plano.

```lua
{type = "visibility", visible = true}
```

### Evento de Colar

```lua
{type = "paste", text = "pasted content"}
```

### Evento de Fechamento

Pede ao produtor que encerre. Um shell o envia por `viewport:send` para solicitar a saída graciosa de um filho.

```lua
{type = "close"}
```

## Vinculações de Teclas

Crie vinculações de teclas reutilizáveis que correspondem a eventos de tecla:

```lua
local quit = tty.bind({
    keys = {"q", "ctrl+c"},
    help = {key = "q/ctrl+c", desc = "quit"}
})

-- No loop de eventos
if quit:matches(ev) then
    break
end
```

### tty.bind(config)

| Campo | Tipo | Descrição |
|-------|------|-------------|
| `keys` | string[] | Padrões de tecla a corresponder (ex: `"a"`, `"ctrl+c"`, `"enter"`) |
| `help` | table | Opcional. `{key = "...", desc = "..."}` para texto de ajuda |

**Retorna:** `KeyBinding`

### Métodos de KeyBinding

| Método | Retorna | Descrição |
|--------|---------|-------------|
| `matches(event)` | boolean | Testa se um evento de tecla corresponde a esta vinculação |
| `set_enabled(bool)` | self | Habilita ou desabilita a vinculação |
| `is_enabled()` | boolean | Verifica se a vinculação está habilitada |
| `help()` | table | Retorna informações de ajuda `{key, desc}` |

## Estilos

Crie saída de texto estilizada usando estilização baseada em lipgloss. Todos os métodos de estilo retornam um novo estilo (imutável).

```lua
local tty = require("tty")
local io = require("io")

local title = tty.style()
    :bold()
    :foreground("#FF0000")
    :padding(0, 1)

local box = tty.style()
    :border(tty.borders.ROUNDED)
    :border_foreground("#00FF00")
    :width(40)
    :padding(1, 2)

io.print(box:render(title:render("Hello"), "World"))
```

### tty.style()

Cria um novo estilo vazio.

**Retorna:** `Style`

### Métodos de Estilo

Todos os métodos retornam um novo `Style` e podem ser encadeados.

#### Decoração de Texto

| Método | Parâmetro | Descrição |
|--------|-----------|-------------|
| `foreground(color)` | string | Cor do texto (hex `"#FF0000"`, ANSI `"9"`, ou nome) |
| `background(color)` | string | Cor de fundo |
| `bold(enable?)` | boolean | Texto em negrito (padrão: true) |
| `italic(enable?)` | boolean | Texto em itálico |
| `underline(enable?)` | boolean | Texto sublinhado |
| `strikethrough(enable?)` | boolean | Texto tachado |
| `faint(enable?)` | boolean | Texto esmaecido |
| `blink(enable?)` | boolean | Texto piscante |
| `reverse(enable?)` | boolean | Inverte primeiro plano/fundo |

#### Layout

| Método | Parâmetro | Descrição |
|--------|-----------|-------------|
| `width(n)` | number | Largura fixa |
| `height(n)` | number | Altura fixa |
| `max_width(n)` | number | Largura máxima |
| `max_height(n)` | number | Altura máxima |
| `padding(...)` | numbers | Padding (estilo CSS: top, right, bottom, left) |
| `margin(...)` | numbers | Margin (estilo CSS) |
| `align(pos)` | number | Alinhamento horizontal |
| `align_vertical(pos)` | number | Alinhamento vertical |
| `inline(enable?)` | boolean | Modo de renderização inline |

#### Bordas

| Método | Parâmetro | Descrição |
|--------|-----------|-------------|
| `border(name, ...)` | string, booleans | Estilo de borda, alternâncias opcionais por lado |
| `border_foreground(...)` | strings | Cor(es) de borda |
| `border_background(...)` | strings | Cor(es) de fundo da borda |

#### Outros

| Método | Descrição |
|--------|-------------|
| `render(...)` | Renderiza strings com este estilo aplicado |
| `copy()` | Cria uma cópia deste estilo |

### Constantes de Borda

```lua
tty.borders.NORMAL
tty.borders.ROUNDED
tty.borders.THICK
tty.borders.DOUBLE
tty.borders.HIDDEN
```

### Constantes de Alinhamento

```lua
tty.align.LEFT    -- 0
tty.align.CENTER  -- 0.5
tty.align.RIGHT   -- 1
```

## Utilitários de Texto

Funções de layout e medição para texto estilizado. Disponíveis sob `tty.text`.

### Medição

```lua
local w = tty.text.width("hello")         -- largura imprimível (ciente de ANSI)
local h = tty.text.height("a\nb\nc")      -- contagem de linhas
local w, h = tty.text.size("hello\nworld") -- ambos
```

### Recorte

```lua
-- Trunca para uma largura imprimível, com um sufixo opcional
local head = tty.text.truncate(line, 40)
local head = tty.text.truncate(line, 40, "…")

-- Pega o intervalo de células imprimíveis [left, right)
local middle = tty.text.cut(line, 10, 30)
```

Ambos preservam o estado ANSI e os limites de grafema, de modo que texto estilizado pode ser recortado e emendado sem quebrar sequências de escape. `truncate` retorna uma string vazia para uma largura zero ou menor; `cut` retorna uma string vazia quando `right` não é maior que `left`.

### Junção

```lua
-- Junta lado a lado, alinhado no topo
local row = tty.text.join_horizontal(tty.text.position.TOP, left, right)

-- Empilha verticalmente, centralizado
local col = tty.text.join_vertical(tty.text.position.CENTER, top, bottom)
```

### Dimensões Máximas

```lua
local w = tty.text.max_width({"short", "a longer string"})   -- mais largo
local h = tty.text.max_height({"one\ntwo", "single"})         -- mais alto
```

### Posicionamento

Posiciona uma string dentro de uma caixa de dimensões dadas:

```lua
-- Centraliza em uma caixa 80x24
local out = tty.text.place(80, 24, tty.text.position.CENTER, tty.text.position.CENTER, content)

-- Apenas horizontal
local out = tty.text.place_horizontal(80, tty.text.position.RIGHT, content)

-- Apenas vertical
local out = tty.text.place_vertical(24, tty.text.position.BOTTOM, content)
```

### Constantes de Posição

```lua
tty.text.position.TOP      -- 0
tty.text.position.LEFT     -- 0
tty.text.position.CENTER   -- 0.5
tty.text.position.BOTTOM   -- 1
tty.text.position.RIGHT    -- 1
```

## Permissões

O módulo não impõe ações de política próprias. O acesso a um terminal vem do frame: o terminal host anexa a porta física, e `process.with_options({terminal = grant})` anexa um viewport, o que requer `process.context` do lado que faz o spawn.

## Veja Também

- [UI de Terminal](tutorials/tty.md) — construa um shell que hospeda um filho em um viewport
- [I/O do Terminal](lua/system/io.md) — operações de stdin/stdout/stderr
- [Terminal Host](system/terminal.md) — Configuração do host de terminal
- [Execução de Comandos](lua/dynamic/exec.md) — processos PTY e sessões de terminal
- [Processos](lua/core/process.md) — opções de spawn, monitoramento, eventos de ciclo de vida
