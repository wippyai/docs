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

For a local application, `wippy run` repairs a stale lock before any runtime service starts. It loads the source dependency declarations, and when the lock already satisfies them it re-resolves the graph from local and installed evidence only (verified-offline access, no network). If that offline resolution matches the lock, boot continues unchanged. If it succeeds but differs, it becomes the candidate graph; the hub is asked to resolve only when the offline pass fails or the lock no longer satisfies the source declarations. Packs the candidate graph is missing are downloaded and verified, and only then is `wippy.lock` rewritten. A lock that selects a deployment root is authoritative and is never re-resolved.

`--exec` blocks until the launched process produces its result, then propagates the process exit code as the CLI exit code. Ctrl-C during `--exec` cancels the running process and the runtime still shuts down gracefully; a second signal forces exit.

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

## wippy artifacts

Work with build-time filesystem artifacts.

### wippy artifacts materialize

Validate and materialize one artifact filesystem out of an existing pack.

```bash
wippy artifacts materialize snapshot.wapp app:package_fs
wippy artifacts materialize snapshot.wapp app:package_fs --root build
```

| Flag | Default | Description |
|------|---------|-------------|
| `--root` | `.wippy` | Materialization root |

The resource is addressed by its full `namespace:name`, must declare `meta.artifact.format`, and that format must be registered in the CLI. The command resolves no module dependencies, does not mutate `wippy.lock`, invokes no package managers, and takes no part in runtime composition. See [Build-time artifacts](guides/artifacts.md#materializing-explicitly).

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

The output file is written atomically: the pack is built into a temporary file in the destination directory, synced, verified, and only then renamed over the target, inheriting the existing file's permissions when one is present. A failed pack leaves the previous file untouched. Naming an output that is also one of the pack's inputs — the same path, or a hard link or symlink resolving to the same file — is refused rather than truncating the input mid-read.

`--meta` cannot write reserved metadata. The key `registry`, and anything under the `wippy.` or `system.` prefixes, is owned by the pack format and rejected.

Resources declaring `meta.artifact.format` are validated while packing, so a malformed artifact fails here rather than in a consumer. See [Build-time artifacts](guides/artifacts.md).

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
| `--registry-meta` | | Include registry-owned metadata (`owner`, `root`) in JSON or YAML output; requires `--json` or `--yaml` |
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

`wippy run list` accepts `--profile` and `--set` so the listing reflects the same merged runtime config `wippy run` would use.

### Command Metadata Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Command name used with `wippy run <name>` |
| `short` | No | Short description shown in `wippy run list` |
| `main` | No | Mark this entry as the default entrypoint. When a pack or hub module is run without a command name, the single `main` entry of that use case is executed; a lone entrypoint is picked even without `main`, and several entrypoints with no `main` is an error |
| `use_case` | No | Entrypoint category, default `run`. The entry declaring `use_case: test` is what `wippy test` executes |
| `security` | No | Security context the command runs under when launched from the CLI |

Any process entry kind works (`process.lua`, `process.wasm`). Command names are not checked for uniqueness; when several loaded entries declare the same name, the first match in registry order runs. Arguments after the command name are passed to the process as string payloads.

### Command security

A command entry declares the actor and policy scope its CLI launch runs under:

```yaml
entries:
  - name: migrate_runner
    kind: process.lua
    meta:
      command:
        name: migrate
        short: Run database migrations
        security:
          actor:
            id: system.migrations
            meta:
              role: operator
          policies:
            - app.security:migrations_policy
          groups:
            - app.security:operators
    source: file://runner.lua
    method: main
```

| Field | Description |
|-------|-------------|
| `actor.id` | Actor identity for the launched process |
| `actor.meta` | Actor attributes evaluated by policies |
| `policies` | Registry IDs (`namespace:name`) of individual policies added to the scope |
| `groups` | Registry IDs of policy groups whose policies are added to the scope |

The block lives inside `meta.command` because it applies only to the CLI launch path — the operator started the command on their own deployment, which is the trust anchor. It has no effect on ordinary spawns of the same process entry; those follow the entry's own [`security:` block](guides/entry-kinds.md#process-security).

Declaration is fail-closed and validated before the process starts:

- Unknown fields inside `security` are rejected.
- An empty `security` block (no actor, no policies, no groups) is rejected.
- `security` without a `name` is rejected — a command must be nameable to be launched.
- A policy or group that cannot be resolved refuses the launch; resolution is atomic, so a partial scope is never installed.

When the block omits `actor`, the caller's actor is inherited. When it omits both `policies` and `groups`, the caller's scope is inherited.

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
  stream_to_events: true

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
