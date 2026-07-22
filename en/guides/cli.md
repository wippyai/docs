---
title: "CLI Reference"
description: "Command-line interface for the Wippy runtime."
---

# CLI Reference

Command-line interface for the Wippy runtime.

## Global Flags

Available on all commands:

| Flag | Short | Description |
|------|-------|-------------|
| `--config` | | Config file, repeatable; later files override earlier ones (default: .wippy.yaml) |
| `--verbose` | `-v` | Enable debug logging |
| `--very-verbose` | | Debug with stack traces |
| `--console` | `-c` | Colorful console logging |
| `--silent` | `-s` | Disable console logging |
| `--event-streams` | `-e` | Stream logs to event bus |
| `--profiler` | `-p` | Enable pprof on localhost:6060 |
| `--memory-limit` | `-m` | Memory limit (e.g., 1G, 512M) |

Memory limit priority: `--memory-limit` flag > `GOMEMLIMIT` env > 1GB default.

`--config` may be passed multiple times to compose config files. Files merge left to right: later files override matching values and keep everything else. Every explicitly named file must exist; without `--config`, the default `.wippy.yaml` is optional. The first file anchors the directory used to resolve relative paths. Configuration applies in order: file composition, then `--profile` selections, then `--set` overrides. See [Configuration](guides/configuration.md#config-composition).

## wippy init

Create a new lock file.

```bash
wippy init
wippy init --src-dir ./src --modules-dir .wippy
```

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--src-dir` | `-d` | ./src | Source directory |
| `--modules-dir` | | .wippy | Modules directory |
| `--lock-file` | `-l` | wippy.lock | Lock file path |

## wippy run

Start the runtime or execute a command.

```bash
wippy run                                   # Start runtime
wippy run list                              # List available commands
wippy run migrate                           # Run a named custom command
wippy run snapshot.wapp                     # Run from pack file
wippy run acme/http                         # Run module from hub
wippy run acme/http@1.2.3                   # Run specific version
wippy run --exec app:worker                 # Start runtime and execute a single process
```

| Flag | Short | Description |
|------|-------|-------------|
| `--override` | `-o` | Override entry values (`namespace:entry:field=value`); `field` may be `kind` to change the entry kind |
| `--set` | | Override a config value (`section.path=value`, repeatable, takes precedence over the config file) |
| `--exec` | `-x` | Execute process and exit (`namespace:entry`) |
| `--host` | | Terminal host ID for `--exec` (auto-detected if only one `terminal.host` exists) |
| `--registry` | | Registry URL for hub modules |
| `--profile` | | Apply a runtime profile from `.wippy.yaml` or packed runtime metadata (repeatable, applied in order) |

Running a hub module (`wippy run org/module`) resolves it once, records it in `wippy.lock`, and vendors the verified packs locally. Subsequent runs of the same reference start from the lock — no network needed. A version selector that no longer matches the lock is rejected with a hint to run `wippy update`.

`--set` writes any runtime configuration value from the command line, merged over `.wippy.yaml` per leaf:

```bash
wippy run --set cluster.enabled=true \
          --set cluster.membership.join_addrs=node-2:7946,node-3:7946 \
          --set cluster.raft.bootstrap_expect=3
```

Values coerce by shape: `true`/`false` to bool, integers and floats to numbers, everything else stays a string (durations like `5s` are parsed where the option expects one).

## wippy test

Run the test entrypoint: the process entry declaring the `test` use case. The runtime boots, executes that entry, and exits. `wippy run` does not auto-run test entrypoints; testing always goes through `wippy test`.

```bash
wippy test                     # Run tests from the local project
wippy test snapshot.wapp       # Run tests from a pack file
wippy test acme/module@1.2.3   # Run tests from a hub module
```

| Flag | Short | Description |
|------|-------|-------------|
| `--override` | `-o` | Override entry values (`namespace:entry:field=value`) |
| `--host` | | Terminal host ID (auto-detected if only one `terminal.host` exists) |
| `--registry` | | Registry URL for hub modules |
| `--set` | | Override a config value (`section.path=value`, repeatable) |
| `--profile` | | Apply a runtime profile (repeatable, applied in order) |

## wippy lint

Check Lua code for type errors and warnings.

```bash
wippy lint
wippy lint --level warning
wippy lint --json
wippy lint --rules
```

Validates all Lua entries: `function.lua`, `library.lua`, `process.lua`, `workflow.lua` (including their `.bc` variants).

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--lock-file` | `-l` | `wippy.lock` | Lock file path |
| `--level` | | `warning` | Minimum severity: `error`, `warning`, `hint` |
| `--ns` | | | Filter by namespace patterns (e.g. `app`, `lib.*`) |
| `--code` | | | Filter by error codes (e.g. `E0001,E0004`) |
| `--rules` | | `false` | Enable style/quality lint rules |
| `--summary` | | `false` | Group output by error code |
| `--limit` | | `0` | Max diagnostics shown (0 = unlimited) |
| `--json` | | `false` | JSON output |
| `--no-color` | | `false` | Disable colored output |
| `--cache-reset` | | `false` | Clear Lua cache before linting |
| `--profile` | | | Apply a workspace profile from the merged runtime config (repeatable) |
| `--set` | | | Override a merged runtime config value (`section.path=value`, repeatable) |

## wippy add

Add a module dependency.

```bash
wippy add acme/http
wippy add acme/http@1.2.3
wippy add acme/http@latest
```

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--lock-file` | `-l` | wippy.lock | Lock file path |
| `--registry` | | | Registry URL |

## wippy install

Install dependencies from lock file.

```bash
wippy install                            # Install all
wippy install acme/http                  # Install specific module
wippy install --refresh acme/http        # Re-fetch a specific module
```

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--lock-file` | `-l` | wippy.lock | Lock file path |
| `--refresh` | | false | Re-fetch every module, bypassing cache |
| `--force` | | false | Alias for `--refresh` |
| `--repair` | | false | Alias for `--refresh` |
| `--registry` | | | Registry URL |
| `--profile` | | | Apply a workspace profile from the merged runtime config (repeatable) |
| `--set` | | | Override a merged runtime config value (`section.path=value`, repeatable) |

## wippy update

Update dependencies and regenerate lock file.

```bash
wippy update                      # Update all
wippy update acme/http            # Update specific module
wippy update acme/http demo/sql   # Update multiple
```

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--lock-file` | `-l` | wippy.lock | Lock file path |
| `--src-dir` | `-d` | ./src | Source directory |
| `--modules-dir` | | .wippy | Modules directory |
| `--registry` | | | Registry URL |
| `--profile` | | | Apply a workspace profile from the merged runtime config (repeatable) |
| `--set` | | | Override a merged runtime config value (`section.path=value`, repeatable) |

## wippy pack

Create a snapshot pack (.wapp file).

```bash
wippy pack snapshot.wapp
wippy pack release.wapp --description "Release 1.0"
wippy pack app.wapp --embed app:assets --bytecode **
```

| Flag | Short | Description |
|------|-------|-------------|
| `--lock-file` | `-l` | Lock file path |
| `--description` | `-d` | Pack description |
| `--tags` | `-t` | Pack tags (comma-separated) |
| `--meta` | | Custom metadata (key=value) |
| `--embed` | | Embed fs.directory entries (patterns) |
| `--embed-all` | | Embed all fs.directory entries (cannot combine with `--embed`) |
| `--list` | | List fs.directory entries (dry-run) |
| `--exclude-ns` | | Exclude namespaces (patterns) |
| `--exclude` | | Exclude entries (patterns) |
| `--bytecode` | | Compile Lua to bytecode (** for all) |
| `--profile` | | Apply a runtime profile from `.wippy.yaml` before packing (repeatable, applied in order) |

Without `--embed` or `--embed-all`, embed patterns fall back to the `embed:` section of the module manifest `wippy.yaml`. Packing an application also carries embedded resources from its dependency packs, and only the main module's commands are exposed by the resulting pack.

## wippy publish

Publish module to the hub.

```bash
wippy publish
wippy publish --version 1.0.0
wippy publish --dry-run
```

Reads from `wippy.yaml` in current directory.

| Flag | Description |
|------|-------------|
| `--version` | Version to publish |
| `--dry-run` | Validate without publishing |
| `--label` | Publish as mutable label instead of version |
| `--release-notes` | Release notes |
| `--protected` | Mark version as protected |
| `--embed` | Embed fs.directory entries by id or name |
| `--config` | Path to directory containing wippy.yaml (default: .) |
| `--registry` | Registry URL |
| `--create` | Create the module on the registry if it does not yet exist |
| `--module-visibility` | Visibility for newly created modules (`--create` only): `public` or `private` (default: private) |
| `--module-type` | Module type: `library`, `application`, `agent`, or `plugin` (overrides `type:` in wippy.yaml) |
| `--module-display-name` | Display name for newly created modules (`--create` only) |

The module type is normally declared as `type:` in `wippy.yaml` (see [Publishing](guides/publishing.md#wippy-yaml)); `--module-type` overrides it for a single publish. When neither is set, newly created modules default to `application` with a deprecation warning.

## wippy search

Search for modules in the hub.

```bash
wippy search http
wippy search "sql driver" --limit 20
wippy search auth --json
```

| Flag | Default | Description |
|------|---------|-------------|
| `--json` | false | Output as JSON |
| `--limit` | 20 | Maximum results |
| `--registry` | | Registry URL |

## wippy auth

Manage registry authentication.

### wippy auth login

```bash
wippy auth login
wippy auth login --token YOUR_TOKEN
```

| Flag | Description |
|------|-------------|
| `--token` | API token |
| `--registry` | Registry URL |
| `--local` | Store credentials locally |

### wippy auth logout

```bash
wippy auth logout
```

| Flag | Description |
|------|-------------|
| `--registry` | Registry URL |
| `--local` | Remove local credentials |

### wippy auth status

```bash
wippy auth status
wippy auth status --json
```

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON |

## wippy readme

Fetch a module README from the hub.

```bash
wippy readme wippy/terminal
wippy readme wippy/terminal@1.2.3
wippy readme --json wippy/terminal@latest
```

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON |
| `--registry` | Registry URL (default: from credentials) |

## wippy registry

Query and inspect registry entries. Both subcommands accept `--profile` and `--set` to shape the merged runtime config the entries are loaded under.

### wippy registry list

```bash
wippy registry list
wippy registry list --kind "function.lua.*"
wippy registry list --ns "app.*" --json
wippy registry list --meta "type=api" --meta "enabled=true"
```

| Flag | Short | Description |
|------|-------|-------------|
| `--kind` | `-k` | Filter by kind (glob pattern) |
| `--ns` | `-n` | Filter by namespace (glob pattern) |
| `--name` | | Filter by name (glob pattern) |
| `--meta` | | Filter by metadata (repeatable) |
| `--json` | | Output as JSON |
| `--yaml` | | Output as YAML |
| `--lock-file` | `-l` | Lock file path |

Metadata operators for `--meta`:

| Operator | Meaning |
|----------|---------|
| `field=value` | Exact match |
| `field~regex` | Regex match |
| `field*substr` | Contains substring |
| `field^prefix` | Starts with prefix |
| `field$suffix` | Ends with suffix |

### wippy registry show

```bash
wippy registry show app:http:handler
wippy registry show app:config --yaml
```

| Flag | Short | Description |
|------|-------|-------------|
| `--field` | `-f` | Show specific field |
| `--json` | | Output as JSON |
| `--yaml` | | Output as YAML |
| `--raw` | | Raw output |
| `--lock-file` | `-l` | Lock file path |

## wippy version

Print version information.

```bash
wippy version
wippy version --short
```

## Custom Commands

Any `process.lua` or `process.wasm` entry can be registered as a named command by adding `command` metadata:

```yaml
entries:
  - name: migrate_runner
    kind: process.lua
    meta:
      command:
        name: migrate
        short: Run database migrations
    source: file://runner.lua
    method: main
    modules:
      - io
      - registry
      - funcs
```

Run it with:

```bash
wippy run migrate
```

List all available commands:

```bash
wippy run list
```

### Command Metadata Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Command name used with `wippy run <name>` |
| `short` | No | Short description shown in `wippy run list` |
| `main` | No | Mark this entry as the default command (picked automatically by packs and hub modules that ship a single command) |
| `use_case` | No | Entrypoint category, default `run`. The entry declaring `use_case: test` is what `wippy test` executes |

Any process entry kind works (`process.lua`, `process.wasm`). The command name must be unique across all loaded entries. Arguments after the command name are passed to the process as string payloads.

## Examples

### Development Workflow

```bash
# Initialize project
wippy init
wippy add wippy/test wippy/llm
wippy install

# Check for errors
wippy lint

# Run with debug output
wippy run -c -v

# Override config for local dev
wippy run -o app:db:host=localhost -o app:db:port=5432
```

### Production Deployment

```bash
# Create release pack with bytecode
wippy pack release.wapp --bytecode ** --exclude-ns test.**

# Run from pack with memory limit
wippy run release.wapp -m 2G
```

### Debugging

```bash
# Execute single process
wippy run --exec app:worker

# With profiler enabled
wippy run -p -v
# Then: go tool pprof http://localhost:6060/debug/pprof/heap
```

### Dependency Management

```bash
# Add new dependency
wippy add acme/http@latest

# Force re-download
wippy install --force

# Update specific module
wippy update acme/http
```

### Publishing

```bash
# Login to hub
wippy auth login

# Validate module
wippy publish --dry-run

# Publish
wippy publish --version 1.0.0 --release-notes "Initial release"
```

## Environment Variables

| Variable | Effect |
|----------|--------|
| `WIPPY_TOKEN` | Registry auth token; overrides stored credentials (a token pushed via `hub.auth.authenticate` ranks higher still) |
| `WIPPY_REGISTRY` | Default registry URL (overridden by `--registry`) |
| `WIPPY_CACHE_DIR` | Cache directory for hub modules run via `wippy run org/module` (default: `~/.wippy/cache`) |
| `GOMEMLIMIT` | Memory-limit fallback when `--memory-limit` is not set |

Values in `.wippy.yaml` may reference OS environment variables with `${env:NAME}`, resolved at file load; a missing variable fails config loading. Bare `${name}` references resolve from the config's `vars:` section instead.

## Configuration File

Create `.wippy.yaml` for persistent settings:

```yaml
logger:
  encoding: console

logmanager:
  min_level: -1  # debug

profiler:
  enabled: true
  address: localhost:6060

override:
  app:gateway:addr: ":9090"
  app:db:host: "localhost"
```

## See Also

- [Configuration](guides/configuration.md) - Config file reference
- [Observability](guides/observability.md) - Monitoring and logging
