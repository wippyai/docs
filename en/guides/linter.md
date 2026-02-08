# Linter

Wippy includes a built-in linter that performs type checking and static analysis on Lua code. Run it with `wippy lint`.

## Usage

```bash
wippy lint                        # Check all Lua entries
wippy lint --level hint           # Show all diagnostics including hints
wippy lint --json                 # Output in JSON format
wippy lint --ns app               # Check only the app namespace
wippy lint --summary              # Group results by error code
```

## What Gets Checked

The linter validates all Lua entry kinds:

- `function.lua.*` - Functions
- `library.lua.*` - Libraries
- `process.lua.*` - Processes
- `workflow.lua.*` - Workflows

Each entry is parsed, type-checked, and analyzed for correctness issues.

## Severity Levels

Diagnostics have three severity levels:

| Level | Description |
|-------|-------------|
| `error` | Type errors and correctness issues that must be fixed |
| `warning` | Likely bugs or problematic patterns |
| `hint` | Style suggestions and informational notes |

Control which levels appear with `--level`:

```bash
wippy lint --level error          # Errors only
wippy lint --level warning        # Warnings and errors (default)
wippy lint --level hint           # Everything
```

## Error Codes

### Parse Errors

| Code | Description |
|------|-------------|
| `P0001` | Lua syntax error - source cannot be parsed |

### Type Check Errors (E-series)

Type checker errors (`E0001`+) report issues found by the type system: type mismatches, undefined variables, invalid operations, and similar correctness problems. These are always reported as errors.

```lua
local x: number = "hello"         -- E: string not assignable to number

local function add(a: number, b: number): number
    return a + b
end

add("one", "two")                  -- E: string not assignable to number
```

### Lint Rule Warnings (W-series)

Lint rules provide style and quality checks. Enable them with `--rules`:

```bash
wippy lint --rules
```

| Code | Rule | Description |
|------|------|-------------|
| `W0001` | no-empty-blocks | Empty block statements |
| `W0002` | no-global-assign | Assignment to global variables |
| `W0003` | no-self-compare | Comparison of a value with itself |
| `W0004` | no-unused-vars | Unused local variables |
| `W0005` | no-unused-params | Unused function parameters |
| `W0006` | no-unused-imports | Unused import statements |
| `W0007` | no-shadowed-vars | Variable shadowing outer scope |

Without `--rules`, only type checking (P and E codes) is performed.

## Filtering

### By Namespace

Check specific namespaces using `--ns`:

```bash
wippy lint --ns app               # Exact namespace match
wippy lint --ns "app.*"           # All under app
wippy lint --ns app --ns lib      # Multiple namespaces
```

Dependencies of selected entries are loaded for type checking but their diagnostics are not reported.

### By Error Code

Filter diagnostics by code:

```bash
wippy lint --code E0001
wippy lint --code E0001 --code E0004
```

### By Count

Limit the number of diagnostics shown:

```bash
wippy lint --limit 10             # Show first 10 issues
```

## Output Formats

### Table Format (Default)

Each diagnostic is displayed with source context, file location, and the error message. Results are sorted by entry, severity, and line number.

A summary line shows totals:

```
Checked 42 entries: 5 errors, 12 warnings
```

### Summary Format

Group diagnostics by namespace and error code:

```bash
wippy lint --summary
```

```
By namespace:

  app                              15 issues (5 errors, 10 warnings)
  lib                               2 issues (2 warnings)

By error code:

  E0001      [error  ]    5 occurrences
  E0004      [error  ]    3 occurrences

Checked 42 entries: 5 errors, 12 warnings
```

### JSON Format

Machine-readable output for CI/CD integration:

```bash
wippy lint --json
```

```json
{
  "diagnostics": [
    {
      "entry_id": "app:handler",
      "code": "E0001",
      "severity": "error",
      "message": "string not assignable to number",
      "line": 10,
      "column": 5
    }
  ],
  "total_entries": 42,
  "error_count": 5,
  "warning_count": 12,
  "hint_count": 0
}
```

## Caching

The linter caches results to speed up repeated runs. Cache keys are based on source code hash, method name, dependencies, and type system configuration.

Clear the cache if results seem stale:

```bash
wippy lint --cache-reset
```

## CI/CD Integration

Use JSON output and exit codes for automated checks:

```bash
wippy lint --json --level error > lint-results.json
```

The linter exits with code 0 when no errors are found, and non-zero when there are errors.

Example GitHub Actions step:

```yaml
- name: Lint
  run: wippy lint --level warning
```

## Flags Reference

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--level` | | warning | Minimum severity level (error, warning, hint) |
| `--json` | | false | Output in JSON format |
| `--ns` | | | Filter by namespace patterns |
| `--code` | | | Filter by error codes |
| `--limit` | | 0 | Max diagnostics to show (0 = unlimited) |
| `--summary` | | false | Group by error code |
| `--no-color` | | false | Disable colored output |
| `--rules` | | false | Enable lint rules (W-series style/quality checks) |
| `--cache-reset` | | false | Clear cache before linting |
| `--lock-file` | `-l` | wippy.lock | Path to lock file |

## See Also

- [CLI](guides/cli.md) - Full CLI reference
- [Types](lua/types.md) - Type system documentation
- [LSP](guides/lsp.md) - Editor integration with live diagnostics
