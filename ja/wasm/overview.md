# WebAssemblyランタイム

> WASMランタイムは実験的な拡張機能です。設定は安定していますが、ランタイム内部はリリース間で変更される可能性があります。

WippyはWebAssemblyモジュールをLuaコードと並ぶファーストクラスのレジストリエントリとして実行します。WASM関数とプロセスは同一のスケジューラ内で実行され、同一のセキュリティモデルを共有し、関数レジストリを通じてLuaと相互運用されます。

## エントリ種別

| Kind | 説明 |
|------|------|
| `function.wat` | YAMLで定義されたインラインWebAssembly Textフォーマット関数 |
| `function.wasm` | ファイルシステムエントリからロードされるプリコンパイル済みWASMバイナリ |
| `process.wasm` | プロセスとして実行されるWASMバイナリ（CLIコマンドまたは長時間実行） |

## 動作の仕組み

1. WASMモジュールは`_index.yaml`でレジストリエントリとして宣言されます
2. 起動時にモジュールがコンパイルされ、ワーカープールに配置されます
3. Lua（または他のWASM）コードが`funcs.call()`経由でそれらを呼び出します
4. 引数と戻り値はLuaテーブルとWIT型の間で自動的にマッピングされます
5. 非同期操作（I/O、スリープ、HTTP）はLuaと同様にディスパッチャを通じてyieldされます

## コンポーネントモデル

WippyはWIT（WebAssembly Interface Types）を持つWebAssemblyコンポーネントモデルをサポートしています。コンポーネントモジュールはホストとゲスト間の完全な型マッピングを得られます:

- レコードは名前付きフィールドを持つLuaテーブルにマッピングされます
- リストはLua配列にマッピングされます
- ResultはLuaの`(value, error)`の戻り値タプルにマッピングされます
- プリミティブ（`s32`、`f64`、`string`など）は直接マッピングされます

明示的なWITシグネチャを持つRaw/コアWASMモジュールもサポートされています。

## LuaからのWASM呼び出し

WASM関数はレジストリ内の他の関数と同じ方法で呼び出されます:

```lua
local funcs = require("funcs")

-- No arguments
local result, err = funcs.call("myns:answer_wat")

-- With arguments
local result, err = funcs.call("myns:compute", 6, 7)

-- With complex data
local users = {
    {id = 1, name = "Alice", tags = {"admin"}, active = true},
    {id = 2, name = "Bob", tags = {"user"}, active = false},
}
local transformed, err = funcs.call("myns:transform_users", users)
```

## セキュリティ

WASM実行はデフォルトで呼び出し元のセキュリティコンテキストを継承します:

- アクターIDが継承されます
- スコープが継承されます
- リクエストコンテキストが継承されます

ホスト機能は明示的なインポートによるオプトイン方式です。各エントリは必要なWASIインターフェース（`wasi:cli`、`wasi:filesystem`など）を正確に宣言し、モジュールのアクセス範囲を制限します。

## 関連項目

- [関数](wasm/functions.md) - WASM関数エントリの設定
- [ホスト関数](wasm/hosts.md) - 利用可能なWASIおよびWippyホストインターフェース
- [プロセス](wasm/processes.md) - WASMを長期間実行プロセスとして実行する
