---
title: "ターミナルUI"
description: "自身のクロームを描画し、ビューポート内に子プロセスをホストするターミナルシェルを構築します。"
---

# ターミナルUI

画面を所有し、スタイル付きのフレームを描画し、自身のレイアウトの枠で囲まれた領域に別のプロセスをホストするターミナルアプリケーションを構築します。

## 構築するもの

シェルプロセスがターミナルホスト上で動作し、物理ターミナルのプレゼンテーションリースを取得します。ヘッダー、ステータスバー、枠線を描画します。その枠の内側に2つ目のプロセスをホストし、そのプロセスは擬似ターミナル経由でインタラクティブなBashを実行します。

```text
physical terminal -> shell surface -> viewport -> child process -> PTY proxy
```

シェルは子プロセスがどこに表示されるかを決定し、入力を子の座標系へ変換します。子は通常のターミナルポートを見ているだけで、自分が枠に収められていることを知りません。

## プロジェクト構造

```
tty-app/
├── wippy.lock
└── src/
    ├── _index.yaml
    ├── shell.lua
    └── child.lua
```

```bash
mkdir tty-app && cd tty-app
mkdir src
```

## ステップ1: エントリ定義

`src/_index.yaml`を作成:

```yaml
version: "1.0"
namespace: app

entries:
  - name: policy
    kind: security.policy
    policy:
      actions:
        - process.context
        - process.spawn
        - process.spawn.monitored
        - process.host
        - process.terminate
        - exec.get
        - exec.run
      resources: "*"
      effect: allow

  # 子プロセスを実行する
  - name: workers
    kind: process.host
    host:
      workers: 2
    lifecycle:
      auto_start: true

  # 物理ターミナルを所有する
  - name: terminal
    kind: terminal.host
    hide_logs: true
    lifecycle:
      auto_start: true

  - name: exec
    kind: exec.native

  - name: child
    kind: process.lua
    source: file://child.lua
    method: main
    modules: [channel, exec, tty]
    security:
      policies: [app:policy]

  - name: shell
    kind: process.lua
    source: file://shell.lua
    method: main
    modules: [channel, process, time, tty]
    meta:
      command:
        name: shell
        short: Run the terminal shell
        security:
          actor: {id: app:shell}
          policies: [app:policy]
```

<note>
<code>hide_logs: true</code>はログ出力をターミナルではなくイベントバスへリダイレクトします。サーフェスを所有するプロセスは完全なフレームを発行するため、同じターミナルへ書き込む他のものはそれを壊してしまいます。
</note>

## ステップ2: 入力ループ

`src/shell.lua`を作成します。先にイベントを購読し、その後で入力の配信を開始することで、コンシューマーが存在する前にイベントが到着しないようにします:

```lua
local tty = require("tty")

local function main()
    local events = assert(tty.events())
    assert(tty.start())
    assert(tty.mouse(true))

    local width, height = tty.screen_size()
    width = math.max(20, math.floor(width or 80))
    height = math.max(8, math.floor(height or 24))

    while true do
        local ev = events:receive()
        if not ev then break end

        if ev.type == "resize" then
            width, height = ev.width, ev.height
        elseif ev.type == "key" and ev.ctrl and ev.key == "q" then
            break
        end
    end

    assert(tty.stop())
end

return {main = main}
```

イベントは`type`で判別されるレコードです。印字可能なキーでは`key_type`が`"runes"`で`key`がそのテキストを保持します。名前付きキーでは`key_type`と`key`の両方が名前（`"enter"`、`"backspace"`、`"up"`）を保持します。マウスイベントの座標は1始まりです。

## ステップ3: フレームの描画

`Surface`はターミナルのプレゼンテーションリースです。完全な行の配列を受け取り、直前のフレームとの差分を取ります。`Canvas`は、自前のターミナル制御シーケンスを一切出力せずに、スタイル付きテキストからそれらの行を構成します。

`shell.lua`の先頭にスタイルとパディング用のヘルパーを追加します:

```lua
local tty = require("tty")

local header_style = tty.style():bold():foreground("#eceff4"):background("#5e81ac")
local status_style = tty.style():foreground("#a3be8c")
local prompt_style = tty.style():foreground("#88c0d0")

local function fit(text, width)
    local clipped = tty.text.truncate(text, width)
    return clipped .. string.rep(" ", math.max(0, width - tty.text.width(clipped)))
end
```

`tty.text.truncate`と`tty.text.width`はANSIを認識するため、スタイル付きテキストはバイト数ではなく印字可能なセル数で計測され、切り詰められます。

次にサーフェスを開き、ヘッダー、スクロール可能な本文、ステータスバー、そして最終行に固定された入力行を持つフレームを発行します:

```lua
local function main()
    local events = assert(tty.events())
    assert(tty.start())
    assert(tty.mouse(true))

    local surface = assert(tty.surface({
        alternate_screen = true,
        hide_cursor = true,
        synchronized_output = true,
    }))

    local width, height = tty.screen_size()
    width = math.max(20, math.floor(width or 80))
    height = math.max(8, math.floor(height or 24))
    local canvas = tty.canvas(width, height)

    local lines, scroll, input = {}, 0, ""

    local function draw()
        local body_height = height - 3
        canvas:clear()
        canvas:put(1, 1, header_style:render(fit(" wippy tui — Ctrl+Q to quit ", width)))

        local first = math.max(1, #lines - body_height + 1 - scroll)
        for row = 1, body_height do
            local line = lines[first + row - 1]
            if line then
                canvas:put(2, row + 1, line, width - 2)
            end
        end

        canvas:put(1, height - 1, status_style:render(fit(
            string.format(" %d lines   scroll %d   %dx%d", #lines, scroll, width, height), width)))
        canvas:put(1, height, prompt_style:render("> ") .. input)

        assert(surface:present(canvas:rows(), {
            cursor = {x = math.min(width, 3 + tty.text.width(input)), y = height, visible = true},
        }))
    end

    draw()
    while true do
        local ev = events:receive()
        if not ev then break end

        if ev.type == "resize" then
            width = math.max(20, ev.width)
            height = math.max(8, ev.height)
            canvas = tty.canvas(width, height)
            surface:invalidate()
        elseif ev.type == "key" and ev.ctrl and ev.key == "q" then
            break
        elseif ev.type == "key" and ev.action == "press" then
            if ev.key == "enter" then
                lines[#lines + 1] = "> " .. input
                input, scroll = "", 0
            elseif ev.key == "backspace" then
                input = input:sub(1, -2)
            elseif ev.key_type == "runes" and not ev.ctrl and not ev.alt then
                input = input .. ev.key
            end
        elseif ev.type == "mouse" and ev.action == "wheel" then
            if ev.button == "wheel_up" then
                scroll = scroll + 1
            elseif ev.button == "wheel_down" then
                scroll = math.max(0, scroll - 1)
            end
        end
        draw()
    end

    assert(surface:close())
    assert(tty.stop())
end
```

`present`は毎回フレーム全体を発行します。バックエンドは変化した行だけを書き込み、`rows`、`changed_rows`、`bytes_written`を報告します。`invalidate()`はその比較状態を忘れさせます。外側のターミナルが自分の知らないうちにリサイズされた後に必要となる動作です。

## ステップ4: 子プロセスのホスト

`Viewport`は仮想のターミナルポートです。シェルはこれを作成し、子にそのグラントを渡し、子が発行したフレームを読み戻します。

レイアウトの本文を枠付きの領域に置き換え、その内側にビューポートの行を配置します:

```lua
local channel = require("channel")
local process = require("process")
local tty = require("tty")

local BODY_X, BODY_Y = 2, 3            -- 枠の内側の左上セル
local CHROME_ROWS = 5                  -- ヘッダー、枠線2行、ステータス、ヒント

local border_style = tty.style():foreground("#4c566a")
local hint_style = tty.style():faint()
```

ビューポートを作成し、グラント付きで子をスポーンし、更新のウォーターマークを購読します:

```lua
    local inner_width = math.max(1, width - 2)
    local inner_height = math.max(1, height - CHROME_ROWS)

    local viewport = assert(tty.viewport({width = inner_width, height = inner_height}))
    local updates = assert(viewport:updates())
    local child = assert(process.with_options({terminal = assert(viewport:grant())})
        :spawn_monitored("app:child", "app:workers", "/bin/bash --noprofile --norc"))
```

グラントは一度きりです。受け入れによって消費されます。起動が拒否された場合グラントは未解決のまま残り、ターミナルをアタッチできないホストは、オプションを黙って破棄するのではなくスポーンを拒否します。

枠線は自分で描画し、`put_rows`で子の行をその内側に配置します。`put_rows`は何かを描画する前にすべての行を検証します:

```lua
    local function draw()
        canvas:clear()
        canvas:put(1, 1, header_style:render(fit(" wippy shell — Ctrl+Q to quit ", width)))
        canvas:put(1, 2, border_style:render("┌" .. string.rep("─", inner_width) .. "┐"))
        for row = 1, inner_height do
            canvas:put(1, BODY_Y + row - 1, border_style:render("│"))
            canvas:put(width, BODY_Y + row - 1, border_style:render("│"))
        end
        canvas:put_rows(BODY_X, BODY_Y, frame.rows, inner_width)
        canvas:put(1, BODY_Y + inner_height,
            border_style:render("└" .. string.rep("─", inner_width) .. "┘"))
        canvas:put(1, height - 1, status_style:render(fit(" " .. status, width)))
        canvas:put(1, height, hint_style:render(fit(
            string.format(" child viewport %dx%d", inner_width, inner_height), width)))

        local cursor = {x = 1, y = height, visible = false}
        if frame.cursor then
            cursor = {
                x = math.min(width, BODY_X + frame.cursor.x - 1),
                y = math.min(height, BODY_Y + frame.cursor.y - 1),
                visible = frame.cursor.visible,
            }
        end
        assert(surface:present(canvas:rows(), {cursor = cursor}))
    end
```

子はビューポートへ発行します。シェルは`updates`を通じてそれを知り、`snapshot`で状態を読み取ります:

```lua
        if selected.channel == updates then
            local next_frame = viewport:snapshot(revision)
            if next_frame then
                frame, revision = next_frame, next_frame.revision
                if #frame.rows > 0 then ready = true end
                draw()
            end
        end
```

更新はまとめられたウォーターマークであり、イベントログではありません。遅いシェルは最新の1つだけを受け取り、実際の行を得るには`snapshot()`を呼ばなければなりません。直前のリビジョンを渡すと、何も変化していない場合`snapshot`は`nil`を返します。新しいリビジョンは子が描画したことを意味しません。`viewport:resize`もリビジョンを進めますし、最初のフレームまでスナップショットは行を持ちません。そのため`ready`はリビジョンではなく`rows`を基準にしています。

入力は`viewport:send`を通じて逆方向へ流れます。キーイベントはそのまま渡されます。マウスの座標は子の1始まりの空間へ移す必要があり、領域外のイベントは破棄されます:

```lua
    local function translate(event)
        if event.type ~= "mouse" then
            return event
        end
        local x, y = event.x - BODY_X + 1, event.y - BODY_Y + 1
        if x < 1 or y < 1 or x > inner_width or y > inner_height then
            return nil
        end
        return {
            type = "mouse", action = event.action, button = event.button,
            x = x, y = y, alt = event.alt, ctrl = event.ctrl, shift = event.shift,
        }
    end
```

`send`は生成側が`tty.start()`を呼び出していることを要求するため、シェルは何かを転送する前に最初のフレームを待ちます。それを追跡するのが`ready`フラグです。

## ステップ5: 子プロセス

`src/child.lua`を作成します。子は通常のターミナルポートを受け取るため、同じ`tty`モジュールを使います。ただし自分で描画する代わりに、そのポートをPTYに支えられたプロセスへ渡します。

```lua
local channel = require("channel")
local exec = require("exec")
local tty = require("tty")

local function main(command)
    local events = assert(tty.events())
    assert(tty.start())

    local executor = assert(exec.get("app:exec"))
    local proc = assert(executor:exec(command or "/bin/bash --noprofile --norc", {
        pty = {term = "xterm-256color"},
    }))
    local session = assert(proc:attach_terminal())
    local done = session:done()

    while true do
        local selected = channel.select({
            events:case_receive(),
            done:case_receive(),
        })
        if not selected.ok or selected.channel == done then break end

        local event = selected.value
        if event.type == "close" then break end
        assert(session:send(event))
    end

    assert(session:close())
    assert(executor:release())
    assert(tty.stop())
end

return {main = main}
```

`attach_terminal()`は未起動のPTYプロセスを消費し、それを所有する`TerminalSession`を返します。PTYのエミュレーション、入力のエンコード、リサイズ、終了、後始末を担います。セッションは子が保持しているポート上にサーフェスを開くため、子がターミナルホスト上で動いていてもビューポート内で動いていても、同じコードが機能します。

子が転送するすべて（キー、マウス、ペースト、フォーカス、そしてシェルが生成する`resize`イベント）は、Bashにとってのターミナル入力になります。`close`イベントは、シェルによる正常終了の要求です。

## ステップ6: リサイズ、シャットダウン、後始末

外側のターミナルのリサイズは3つのものを変化させます。シェル自身のジオメトリ、ビューポートのジオメトリ、そして画面に何が表示されているかについてのバックエンドの認識です。

```lua
            if event.type == "resize" then
                width = math.max(20, math.floor(event.width))
                height = math.max(8, math.floor(event.height))
                inner_width = math.max(1, width - 2)
                inner_height = math.max(1, height - CHROME_ROWS)
                canvas = tty.canvas(width, height)
                assert(viewport:resize(inner_width, inner_height))
                surface:invalidate()
                draw()
            end
```

`viewport:resize`は閲覧者向けにリビジョンを進め、子へ`resize`イベントを配信します。子はそれを自身のターミナルセッションへ転送し、セッションがPTYをリサイズします。シェル側の1回の呼び出しが一番下まで届きます。

Ctrl+Qは子に停止を求め、期限を設定します。これにより応答しない子がシェルをハングさせることはありません:

```lua
            elseif event.type == "key" and event.ctrl and event.key == "q" then
                if not closing then
                    closing = true
                    status = "closing child"
                    if ready then
                        assert(viewport:send({type = "close"}))
                    else
                        assert(process.terminate(child))
                    end
                    deadline = time.after("3s")
                    draw()
                end
```

ループは子の終了をライフサイクルイベントで監視し、それが決して来ない場合に備えて期限チャネルも監視します:

```lua
        elseif selected.channel == lifecycle then
            local event = selected.value
            if event.kind == process.event.EXIT and event.from == child then break end
        elseif deadline and selected.channel == deadline then
            assert(process.terminate(child))
            deadline = nil
```

内側から外側へ順に片付けます。閲覧者をデタッチし、プレゼンテーションリースを解放し、最後に入力を停止します。

```lua
    assert(viewport:close())
    assert(surface:close())
    assert(tty.stop())
```

ビューポートを閉じてもデタッチされるのはその閲覧者だけで、生成側が終了させられることはありません。サーフェスを閉じると、取得したターミナルモード（代替画面とカーソル）が復元されます。

## 完成したシェル

`src/shell.lua`:

```lua
local channel = require("channel")
local process = require("process")
local time = require("time")
local tty = require("tty")

local BODY_X, BODY_Y = 2, 3
local CHROME_ROWS = 5

local header_style = tty.style():bold():foreground("#eceff4"):background("#5e81ac")
local border_style = tty.style():foreground("#4c566a")
local status_style = tty.style():foreground("#a3be8c")
local hint_style = tty.style():faint()

local function fit(text, width)
    local clipped = tty.text.truncate(text, width)
    return clipped .. string.rep(" ", math.max(0, width - tty.text.width(clipped)))
end

local function main()
    local events = assert(tty.events())
    local lifecycle = assert(process.events())
    assert(tty.start())
    assert(tty.mouse(true))

    local surface = assert(tty.surface({
        alternate_screen = true,
        hide_cursor = true,
        synchronized_output = true,
    }))

    local width, height = tty.screen_size()
    width = math.max(20, math.floor(width or 80))
    height = math.max(8, math.floor(height or 24))
    local inner_width = math.max(1, width - 2)
    local inner_height = math.max(1, height - CHROME_ROWS)
    local canvas = tty.canvas(width, height)

    local viewport = assert(tty.viewport({width = inner_width, height = inner_height}))
    local updates = assert(viewport:updates())
    local child = assert(process.with_options({terminal = assert(viewport:grant())})
        :spawn_monitored("app:child", "app:workers", "/bin/bash --noprofile --norc"))

    local frame = {rows = {}}
    local revision = -1
    local ready, closing = false, false
    local status = "starting child"
    local deadline

    local function draw()
        canvas:clear()
        canvas:put(1, 1, header_style:render(fit(" wippy shell — Ctrl+Q to quit ", width)))
        canvas:put(1, 2, border_style:render("┌" .. string.rep("─", inner_width) .. "┐"))
        for row = 1, inner_height do
            canvas:put(1, BODY_Y + row - 1, border_style:render("│"))
            canvas:put(width, BODY_Y + row - 1, border_style:render("│"))
        end
        canvas:put_rows(BODY_X, BODY_Y, frame.rows, inner_width)
        canvas:put(1, BODY_Y + inner_height,
            border_style:render("└" .. string.rep("─", inner_width) .. "┘"))
        canvas:put(1, height - 1, status_style:render(fit(" " .. status, width)))
        canvas:put(1, height, hint_style:render(fit(
            string.format(" child viewport %dx%d", inner_width, inner_height), width)))

        local cursor = {x = 1, y = height, visible = false}
        if frame.cursor then
            cursor = {
                x = math.min(width, BODY_X + frame.cursor.x - 1),
                y = math.min(height, BODY_Y + frame.cursor.y - 1),
                visible = frame.cursor.visible,
            }
        end
        assert(surface:present(canvas:rows(), {cursor = cursor}))
    end

    local function translate(event)
        if event.type ~= "mouse" then
            return event
        end
        local x, y = event.x - BODY_X + 1, event.y - BODY_Y + 1
        if x < 1 or y < 1 or x > inner_width or y > inner_height then
            return nil
        end
        return {
            type = "mouse", action = event.action, button = event.button,
            x = x, y = y, alt = event.alt, ctrl = event.ctrl, shift = event.shift,
        }
    end

    draw()
    while true do
        local cases = {
            events:case_receive(),
            lifecycle:case_receive(),
            updates:case_receive(),
        }
        if deadline then
            cases[#cases + 1] = deadline:case_receive()
        end

        local selected = channel.select(cases)
        if not selected.ok then break end

        if selected.channel == updates then
            local next_frame = viewport:snapshot(revision)
            if next_frame then
                frame, revision = next_frame, next_frame.revision
                if #frame.rows > 0 then ready = true end
                if not closing then
                    status = "child running"
                end
                draw()
            end
        elseif selected.channel == lifecycle then
            local event = selected.value
            if event.kind == process.event.EXIT and event.from == child then break end
        elseif deadline and selected.channel == deadline then
            assert(process.terminate(child))
            deadline = nil
        else
            local event = selected.value
            if event.type == "resize" then
                width = math.max(20, math.floor(event.width))
                height = math.max(8, math.floor(event.height))
                inner_width = math.max(1, width - 2)
                inner_height = math.max(1, height - CHROME_ROWS)
                canvas = tty.canvas(width, height)
                assert(viewport:resize(inner_width, inner_height))
                surface:invalidate()
                draw()
            elseif event.type == "key" and event.ctrl and event.key == "q" then
                if not closing then
                    closing = true
                    status = "closing child"
                    if ready then
                        assert(viewport:send({type = "close"}))
                    else
                        assert(process.terminate(child))
                    end
                    deadline = time.after("3s")
                    draw()
                end
            elseif not closing and ready and event.type ~= "start" then
                local forwarded = translate(event)
                if forwarded then
                    assert(viewport:send(forwarded))
                end
            end
        end
    end

    assert(viewport:close())
    assert(surface:close())
    assert(tty.stop())
end

return {main = main}
```

## 実行

```bash
wippy init
wippy run shell
```

枠に収まったBashで普通に入力できます。矢印キー、タブ補完、`htop`や`vim`のような全画面プログラムもすべて動作します。子が本物のPTYと会話しているからです。ターミナルウィンドウをリサイズすれば、枠線、ステータスバー、子のジオメトリが追従します。Ctrl+Qを押すと子が閉じ、ターミナルが復元されます。

## 次に進む先

- 2つ目のビューポートを作成し、本文を2つの子で分割して、フォーカスされている方にのみ入力を転送する。
- `viewport:handle()`を呼び出してハンドルを別のプロセスへ渡す。そのプロセスは`tty.attach(handle)`でアタッチし、同じ子を自身のレイアウト内で描画する。
- Bashの子を、自分でサーフェスを描画するLuaプロセスに置き換える。ビューポートが両者の間の唯一の契約であるため、シェルは変更不要です。

## 関連項目

- [TTY](lua/system/tty.md) — イベント、サーフェス、キャンバス、ビューポート、スタイル、テキストユーティリティ
- [コマンド実行](lua/dynamic/exec.md) — PTYのオプション、`attach_terminal`、ターミナルセッション
- [ターミナル](system/terminal.md) — ターミナルホストの設定と合成可能なターミナルモデル
- [プロセス](lua/core/process.md) — スポーンのオプション、モニタリング、ライフサイクルイベント
- [CLIアプリケーション](tutorials/cli.md) — 行指向のターミナルプログラム
