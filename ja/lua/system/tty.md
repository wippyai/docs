---
title: "TTY"
description: "ターミナルの入力イベント、スタイル付き出力、プレゼンテーションサーフェス、ローカルな仮想ビューポート。"
---

# TTY
<secondary-label ref="process"/>
<secondary-label ref="io"/>

ターミナルの入力イベント、スタイル付き出力、プレゼンテーションサーフェス、ローカルな仮想ビューポート。

<note>
すべての関数は、呼び出し元のプロセスフレームにアタッチされたターミナルポートを解決します。<a href="system/terminal.md">ターミナルホスト</a>上のプロセスは物理ターミナルを所有します。通常の <code>process.host</code> 上の <code>process.lua</code> は、ビューポートグラント付きでスポーンされた場合に仮想ターミナルを所有します。どちらのアタッチもない場合、このモジュールは "no terminal context" を返します。
</note>

## ロード

```lua
local tty = require("tty")
```

## モデル

**サーフェス**は、1つのプロセスがそのターミナルポートに対して持つ排他的なプレゼンテーションリースです。完全な行スナップショットを公開し、差分計算とターミナルの復旧はバックエンドが担います。1つのポートで同時に開けるサーフェスは1つだけです。

**キャンバス**は、プロセス内のスタイル付きセルの合成バッファです。セル境界でクリップし、独自のターミナル制御コマンドを送出することはありません。

**ビューポート**は、バイトストリームを共有せずに1つのプロセスが別のプロセスのサーフェスをホストできるようにする、ローカルで構造化されたターミナル境界です。シェルはビューポートの内容をどこに表示するかを決め、入力を子プロセスの座標系へ変換します。子プロセスは通常のターミナルポートを見ており、自身が全画面なのか、タイル表示なのか、タブ内なのか、非表示なのかを知りません。

ビューポートは1つのランタイムノード内にローカルです。グラントとハンドルは不透明なローカルケーパビリティであり、シリアライズ可能なネットワーク参照ではありません。

## 入力ループ

入力配信を開始し、イベントを購読し、ループで処理します：

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

最初のイベントが届いたときに受信側が準備できているよう、`events()` は `start()` より前に呼び出してください。仮想ポートでは `start()` がビューアからプロデューサーへのイベント配信を開き、`stop()` がそれを閉じます。この区間の外での `Viewport:send()` は、入力を黙って破棄するのではなく失敗します。リサイズの配信は入力状態とは独立しています。

## 入力制御

### tty.start()

現在のポートの入力配信を開始します。物理ターミナルは生モードへ切り替わります。

```lua
local ok, err = tty.start()
```

**戻り値:** `boolean, error`

### tty.stop()

入力配信を停止し、ターミナルを通常モードへ戻します。

```lua
local ok, err = tty.stop()
```

**戻り値:** `boolean, error`

### tty.events()

ポートのターミナルイベントを購読し、チャネルを返します。イベントは `type` フィールドを持つテーブルとして配信されます。購読は一度だけ行い、チャネルを再利用してください。

```lua
local events, err = tty.events()
```

**戻り値:** `EventChannel, error`

`EventChannel` は `receive()` と `case_receive()` を持つため、`channel.select` と組み合わせられます。

### tty.screen_size()

現在のターミナルの大きさを問い合わせます。

```lua
local width, height, err = tty.screen_size()
```

**戻り値:** `number, number, error`

### tty.mouse(enable)

マウスイベントトラッキングを有効化または無効化します。

```lua
local ok, err = tty.mouse(true)
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `enable` | boolean | 有効化する場合は `true`、無効化する場合は `false` |

**戻り値:** `boolean, error`

## サーフェス

サーフェスはポートのプレゼンテーションリースです。取得し、完全なフレームを公開し、終わったら閉じます。

### tty.surface(options?)

```lua
local surface, err = tty.surface({
    alternate_screen = true,
    hide_cursor = true,
    synchronized_output = true,
})
```

| オプション | 型 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `alternate_screen` | boolean | false | ターミナルの代替スクリーンバッファ上に表示する |
| `hide_cursor` | boolean | false | サーフェスが開いている間、ターミナルカーソルを隠す |
| `synchronized_output` | boolean | false | 各フレームを同期出力マーカーで囲む |

**戻り値:** `Surface, error`

すでにサーフェスがあるポートで2つ目のサーフェスを開くと失敗します。仮想ポートはこれらのオプションをサーフェスのメタデータとして保持し、物理ポートはターミナルモードへ変換してクローズ時に復元します。

### surface:present(rows, options?)

行文字列の完全な配列を公開します。行 `1` が最上行です。

```lua
local stats, err = surface:present(rows, {
    cursor = {x = 12, y = 3, visible = true},
})
```

| パラメータ | 型 | 説明 |
|-----------|------|-------------|
| `rows` | string[] | 完全なフレーム。最大 16384 行 |
| `options.cursor` | table | 1始まりのサーフェス座標での `{x, y, visible}` |

`cursor` を省略すると、最後に明示されたカーソル状態が維持されます。`cursor` を指定する場合、3つのフィールドすべてが必要です。

**戻り値:** `stats, error` — `rows`、`changed_rows`、`bytes_written` を持つイミュータブルなレコード。直前と同一の物理フレームは何も書き込みません。

### surface:invalidate()

論理フレームを消すことなく、バックエンドのプレゼンテーション状態を忘れます。次の `present` は行が変化していなくてもコミットされます。外側のターミナルがリサイズされた後や、別の所有者が物理状態を乱した可能性がある場合に使用します。

**戻り値:** `boolean`

### surface:close()

リースを解放します。冪等で、以降の呼び出しは最初のクローズ結果を返します。物理バックエンドはターミナルモードを復元します。

**戻り値:** `boolean, error`

## キャンバス

キャンバスは、フレームを表示前に合成するための、境界を持つスタイル付きセルバッファです。

### tty.canvas(width, height)

```lua
local canvas = tty.canvas(width, height)
```

幅は 16384 カラム、高さは 16384 行、面積は 262,144 セルが上限です。範囲外の引数は引数エラーを発生させます。

**戻り値:** `Canvas`

描画はターミナルコマンドではなく、スタイル付きテキストを受け付けます。SGR カラーと OSC 8 リンクは保持されます。消去やカーソル移動などの制御専用の出力は送出されません。各配置はグラフィムの幅を考慮してセル境界で個別にクリップされるため、クリップされたエスケープシーケンスが隣接するコンテンツへ漏れることはありません。

### canvas:clear(fill?)

すべてのセルをクリアします。オプションのスタイル付き `fill` 文字列は各行にわたって繰り返されます。

```lua
canvas:clear()
canvas:clear(tty.style():background("#1a1a1a"):render(" "))
```

**戻り値:** `boolean`

### canvas:put(x, y, text, width?)

1始まりの `x`、`y` にスタイル付きの1行を配置し、`width` セル（デフォルトはキャンバス幅）にクリップします。座標は負の値や端を越えた値でもよく、その場合は拒否されるのではなくクリップされます。改行はその行を終端するため、複数行のコンテンツには `put_rows` を使用してください。

```lua
canvas:put(3, 1, tty.style():bold():render("Title"), 40)
```

**戻り値:** `boolean`

### canvas:put_rows(x, y, rows, width?)

`x`、`y` を起点に、スタイル付きの行の配列を1行ずつ下方向に配置します。描画開始前にすべての要素が検証されます。

```lua
canvas:put_rows(2, 2, child_rows, inner_width)
```

**戻り値:** `boolean`

### canvas:rows()

`surface:present` に渡せる完全な行配列をレンダリングします。

**戻り値:** `string[]`

## ビューポート

ビューポートは仮想ターミナルポートです。作成したプロセスが最初のビューアであり、そのグラントで受け入れられたプロセスがプロデューサーです。

### tty.viewport(options?)

```lua
local view, err = tty.viewport({width = 80, height = 24})
```

| オプション | 型 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `width` | number | 80 | カラム数（1〜65535）|
| `height` | number | 24 | 行数（1〜65535）|

面積は 262,144 セルが上限です。

**戻り値:** `Viewport, error`

### tty.attach(handle)

既存のビューポートにローカルなビューアを追加します。ハンドルが与えるのは閲覧権のみで、プレゼンテーションの所有権ではありません。また、他のノードでは無効です。

```lua
local view, err = tty.attach(handle)
```

**戻り値:** `Viewport, error`

### viewport:grant()

ワンショットのプロデューサーケーパビリティを返します。`terminal` スポーンオプションとして渡します：

```lua
local grant = assert(view:grant())
local child = assert(process.with_options({terminal = grant})
    :spawn_monitored("app:child", "app:workers"))
```

アドミッションはグラントをトランザクショナルに消費します。起動が拒否された場合は未解決のグラントが復元され、ポートを解決したプロセスはグラントを恒久的に消費します。ターミナルのアタッチをサポートしないホストは、オプションを破棄するのではなくスポーンを拒否します。[プロセス](lua/core/process.md#spawner-with-options)を参照してください。

**戻り値:** `string, error`

### viewport:handle()

`tty.attach` 用のローカルビューアハンドルを返します。

**戻り値:** `string`

### viewport:snapshot(after_revision?)

現在の寸法、行、カーソル、リビジョンを読み取ります。`after_revision` を指定すると、リビジョンが変化していない場合は `nil` を返します。

```lua
local frame = view:snapshot(revision)
if frame then
    revision = frame.revision
    canvas:put_rows(2, 2, frame.rows, inner_width)
end
```

**戻り値:** `snapshot` または `nil`

| フィールド | 型 | 説明 |
|-----------|------|-------------|
| `revision` | number | このフレームの単調増加リビジョン |
| `width` | number | ビューポートのカラム数 |
| `height` | number | ビューポートの行数 |
| `rows` | string[] | プロデューサーが最後に公開した行 |
| `cursor` | table | 1始まり座標での `{x, y, visible}`。プロデューサーが明示的なカーソル状態を公開するまでは存在しない |

### viewport:updates()

まとめられたリビジョンのウォーターマークのチャネルを返します。`receive()` はリビジョン番号を返し、`case_receive()` は `channel.select` と組み合わせられます。

```lua
local updates = assert(view:updates())
```

更新は境界のあるヒントであり、イベントログではありません。遅いビューアは最新のウォーターマークのみを受け取り、状態を得るには `snapshot()` を呼び出す必要があります。表示とリサイズが遅いビューアによってブロックされることはありません。

**戻り値:** `ViewportUpdateChannel, error`

### viewport:send(event)

検証済みのイベントレコードをプロデューサーへ転送します。プロデューサーが `tty.start()` を呼び出している必要があります。そうでない場合、この呼び出しはイベントを破棄するのではなく失敗します。

```lua
assert(view:send(event))
assert(view:send({type = "close"}))
```

**戻り値:** `boolean, error`

### viewport:resize(width, height)

ビューポートのジオメトリを更新します。サイズが変化すると、ビューアは新しいリビジョンを受け取り、プロデューサーは `resize` イベントを受け取ります。

**戻り値:** `boolean, error`

### viewport:close()

このビューアのみをデタッチします。最後のビューアを閉じても稼働中のプロデューサーは終了せず、プロデューサーのポートを閉じてもビューアが残っている限り状態は破棄されません。

**戻り値:** `boolean, error`

## イベント種別

イベントは `type` フィールドを持つテーブルで、それによってどの他のフィールドが存在するかが決まります。座標は1始まりです。同じレコードを `viewport:send()` が受け付けます。

### キーイベント

```lua
{
    type = "key",
    key = "a",           -- 印刷可能文字またはキー名
    key_type = "runes",  -- 印刷可能の場合は "runes"、または特殊キー名
    action = "press",    -- "press" または "release"
    alt = false,
    ctrl = false,
    shift = false
}
```

### マウスイベント

`tty.mouse(true)` が必要です。

```lua
{
    type = "mouse",
    action = "press",    -- "press"、"release"、"motion"、"wheel"
    button = "left",     -- ボタン名
    x = 10,
    y = 5,
    alt = false,
    ctrl = false,
    shift = false
}
```

### リサイズイベント

```lua
{type = "resize", width = 120, height = 40}
```

### スタートイベント

`tty.start()` 後に初期サイズとともに 1 度だけ送出されます。

```lua
{type = "start", width = 120, height = 40}
```

### フォーカスイベント

キーボードの所有権を報告します。

```lua
{type = "focus", focused = true}
```

### 可視性イベント

再描画に意味があるかどうかを報告します。アプリケーションのライフサイクルやバックグラウンド計算を規定するものではありません。

```lua
{type = "visibility", visible = true}
```

### ペーストイベント

```lua
{type = "paste", text = "pasted content"}
```

### クローズイベント

プロデューサーにシャットダウンを要求します。シェルは `viewport:send` を通じてこれを送り、子プロセスのグレースフルな終了を要求します。

```lua
{type = "close"}
```

## キーバインディング

キーイベントに照合する再利用可能なキーバインディングを作成します：

```lua
local quit = tty.bind({
    keys = {"q", "ctrl+c"},
    help = {key = "q/ctrl+c", desc = "quit"}
})

-- イベントループ内
if quit:matches(ev) then
    break
end
```

### tty.bind(config)

| フィールド | 型 | 説明 |
|-------|------|-------------|
| `keys` | string[] | 一致させるキーパターン（例：`"a"`、`"ctrl+c"`、`"enter"`） |
| `help` | table | 任意。ヘルプテキスト用の `{key = "...", desc = "..."}` |

**戻り値:** `KeyBinding`

### KeyBinding メソッド

| メソッド | 戻り値 | 説明 |
|--------|---------|-------------|
| `matches(event)` | boolean | キーイベントがこのバインディングに一致するかをテスト |
| `set_enabled(bool)` | self | バインディングを有効化または無効化 |
| `is_enabled()` | boolean | バインディングが有効かをチェック |
| `help()` | table | `{key, desc}` のヘルプ情報を返す |

## スタイル

lipgloss ベースのスタイリングを使用してスタイル付きテキスト出力を作成します。すべてのスタイルメソッドは新しいスタイルを返します（不変）。

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

新しい空のスタイルを作成します。

**戻り値:** `Style`

### Style メソッド

すべてのメソッドは新しい `Style` を返し、チェーン可能です。

#### テキスト装飾

| メソッド | パラメータ | 説明 |
|--------|-----------|-------------|
| `foreground(color)` | string | テキストカラー（hex `"#FF0000"`、ANSI `"9"`、または名前） |
| `background(color)` | string | 背景色 |
| `bold(enable?)` | boolean | 太字テキスト（デフォルト: true） |
| `italic(enable?)` | boolean | イタリック体テキスト |
| `underline(enable?)` | boolean | 下線付きテキスト |
| `strikethrough(enable?)` | boolean | 取り消し線付きテキスト |
| `faint(enable?)` | boolean | 薄いテキスト |
| `blink(enable?)` | boolean | 点滅テキスト |
| `reverse(enable?)` | boolean | 前景/背景の入れ替え |

#### レイアウト

| メソッド | パラメータ | 説明 |
|--------|-----------|-------------|
| `width(n)` | number | 固定幅 |
| `height(n)` | number | 固定高さ |
| `max_width(n)` | number | 最大幅 |
| `max_height(n)` | number | 最大高さ |
| `padding(...)` | numbers | パディング（CSS スタイル：top、right、bottom、left） |
| `margin(...)` | numbers | マージン（CSS スタイル） |
| `align(pos)` | number | 水平方向の配置 |
| `align_vertical(pos)` | number | 垂直方向の配置 |
| `inline(enable?)` | boolean | インラインレンダリングモード |

#### ボーダー

| メソッド | パラメータ | 説明 |
|--------|-----------|-------------|
| `border(name, ...)` | string, booleans | ボーダースタイル、辺ごとの任意トグル |
| `border_foreground(...)` | strings | ボーダーカラー |
| `border_background(...)` | strings | ボーダー背景色 |

#### その他

| メソッド | 説明 |
|--------|-------------|
| `render(...)` | このスタイルを適用して文字列をレンダリング |
| `copy()` | このスタイルのコピーを作成 |

### ボーダー定数

```lua
tty.borders.NORMAL
tty.borders.ROUNDED
tty.borders.THICK
tty.borders.DOUBLE
tty.borders.HIDDEN
```

### アライメント定数

```lua
tty.align.LEFT    -- 0
tty.align.CENTER  -- 0.5
tty.align.RIGHT   -- 1
```

## テキストユーティリティ

スタイル付きテキスト用のレイアウトと計測関数。`tty.text` の下で利用可能です。

### 計測

```lua
local w = tty.text.width("hello")         -- 印刷可能幅（ANSI 対応）
local h = tty.text.height("a\nb\nc")      -- 行数
local w, h = tty.text.size("hello\nworld") -- 両方
```

### クリッピング

```lua
-- 印刷可能幅で切り詰める。末尾文字列は任意
local head = tty.text.truncate(line, 40)
local head = tty.text.truncate(line, 40, "…")

-- 印刷可能セル範囲 [left, right) を取り出す
local middle = tty.text.cut(line, 10, 30)
```

どちらも ANSI の状態とグラフィム境界を保持するため、スタイル付きテキストをエスケープシーケンスを壊さずにクリップしたり継ぎ合わせたりできます。`truncate` は幅が 0 以下の場合に空文字列を返します。`cut` は `right` が `left` より大きくない場合に空文字列を返します。

### 結合

```lua
-- 横並びに結合、上揃え
local row = tty.text.join_horizontal(tty.text.position.TOP, left, right)

-- 縦に積む、中央揃え
local col = tty.text.join_vertical(tty.text.position.CENTER, top, bottom)
```

### 最大寸法

```lua
local w = tty.text.max_width({"short", "a longer string"})   -- 最も広いもの
local h = tty.text.max_height({"one\ntwo", "single"})         -- 最も高いもの
```

### 配置

指定された寸法のボックス内に文字列を配置します：

```lua
-- 80x24 のボックスの中央に配置
local out = tty.text.place(80, 24, tty.text.position.CENTER, tty.text.position.CENTER, content)

-- 水平方向のみ
local out = tty.text.place_horizontal(80, tty.text.position.RIGHT, content)

-- 垂直方向のみ
local out = tty.text.place_vertical(24, tty.text.position.BOTTOM, content)
```

### ポジション定数

```lua
tty.text.position.TOP      -- 0
tty.text.position.LEFT     -- 0
tty.text.position.CENTER   -- 0.5
tty.text.position.BOTTOM   -- 1
tty.text.position.RIGHT    -- 1
```

## 権限

このモジュール自体はポリシーアクションを強制しません。ターミナルへのアクセスはフレームから得られます。ターミナルホストが物理ポートをアタッチし、`process.with_options({terminal = grant})` がビューポートをアタッチします。後者はスポーンする側に `process.context` を必要とします。

## 関連項目

- [ターミナルUI](tutorials/tty.md) — ビューポートで子プロセスをホストするシェルを構築する
- [ターミナル I/O](lua/system/io.md) — stdin/stdout/stderr 操作
- [ターミナルホスト](system/terminal.md) — ターミナルホスト設定
- [コマンド実行](lua/dynamic/exec.md) — PTY プロセスとターミナルセッション
- [プロセス](lua/core/process.md) — スポーンオプション、モニタリング、ライフサイクルイベント
