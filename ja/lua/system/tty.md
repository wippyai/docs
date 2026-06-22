# TTY
<secondary-label ref="process"/>
<secondary-label ref="io"/>

生の入力イベント、スタイル付き出力、レイアウトユーティリティ用のターミナル UI モジュール。

<note>
このモジュールはターミナルコンテキスト内でのみ動作します。通常の関数からは使用できません — <a href="system/terminal.md">ターミナルホスト</a>上で実行されているプロセスからのみ使用してください。
</note>

## ロード

```lua
local tty = require("tty")
```

## 入力ループ

生の入力リーダーを起動し、イベントを購読し、ループで処理します：

```lua
local tty = require("tty")
local io = require("io")

local function handler()
    tty.start()
    local events = tty.events()

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

## 入力制御

### tty.start()

生のターミナル入力モードを有効にします。ターミナルは生モードへ切り替わり、イベントの送出を開始します。

```lua
local ok, err = tty.start()
```

**戻り値:** `boolean, error`

### tty.stop()

生の入力を無効にし、ターミナルを通常モードへ戻します。

```lua
local ok, err = tty.stop()
```

**戻り値:** `boolean, error`

### tty.events()

ターミナルイベントを購読し、チャネルを返します。イベントは `type` フィールドを持つテーブルとして配信されます。

```lua
local events = tty.events()
```

**戻り値:** `EventChannel, error`

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

## イベント種別

イベントは `type` フィールドを持つテーブルで、それによってどの他のフィールドが存在するかが決まります。

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

```lua
{type = "focus", focused = true}
```

### ペーストイベント

```lua
{type = "paste", text = "pasted content"}
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

## 関連項目

- [ターミナル I/O](lua/system/io.md) — stdin/stdout/stderr 操作
- [ターミナルホスト](system/terminal.md) — ターミナルホスト設定
