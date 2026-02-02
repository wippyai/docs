# CLI Reference

Command-line interface for the Wippy runtime.

## Global Flags

Available on all commands:

| Flag | Short | Description |
|------|-------|-------------|
| `--config` | | Config file (default: .wippy.yaml) |
| `--verbose` | `-v` | Enable debug logging |
| `--very-verbose` | | Debug with stack traces |
| `--console` | `-c` | Colorful console logging |
| `--silent` | `-s` | Disable console logging |
| `--event-streams` | `-e` | Stream logs to event bus |
| `--profiler` | `-p` | Enable pprof on localhost:6060 |
| `--memory-limit` | `-m` | Memory limit (e.g., 1G, 512M) |

Memory limit priority: `--memory-limit` flag > `GOMEMLIMIT` env > 1GB default.

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
wippy run                                    # Start runtime
wippy run list                               # List available commands
wippy run test                               # Run tests
wippy run snapshot.wapp                      # Run from pack file
wippy run acme/http                          # Run module
wippy run --exec app:processes/app:worker   # Execute single process
```

| Flag | Short | Description |
|------|-------|-------------|
| `--override` | `-o` | Override entry values (namespace:entry:field=value) |
| `--exec` | `-x` | Execute process and exit (host/namespace:entry) |
| `--host` | | Host for execution |
| `--registry` | | Registry URL |

## wippy lint

Check Lua code for type errors and warnings.

```bash
wippy lint
wippy lint --level warning
```

Validates all Lua entries: `function.lua.*`, `library.lua.*`, `process.lua.*`, `workflow.lua.*`.

| Flag | Description |
|------|-------------|
| `--level` | Minimum severity level to report |

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
wippy install
wippy install --force
wippy install --repair
```

| Flag | Short | Description |
|------|-------|-------------|
| `--lock-file` | `-l` | Lock file path |
| `--force` | | Bypass cache, always download |
| `--repair` | | Verify hashes, re-download if mismatch |
| `--registry` | | Registry URL |

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
| `--src-dir` | `-d` | . | Source directory |
| `--modules-dir` | | .wippy | Modules directory |
| `--registry` | | | Registry URL |

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
| `--list` | | List fs.directory entries (dry-run) |
| `--exclude-ns` | | Exclude namespaces (patterns) |
| `--exclude` | | Exclude entries (patterns) |
| `--bytecode` | | Compile Lua to bytecode (** for all) |

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
| `--label` | Version label |
| `--release-notes` | Release notes |
| `--registry` | Registry URL |

## wippy search

Search for modules in the hub.

```bash
wippy search http
wippy search "sql driver" --limit 20
wippy search auth --json
```

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON |
| `--limit` | Maximum results |
| `--registry` | Registry URL |

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

## wippy registry

Query and inspect registry entries.

### wippy registry list

```bash
wippy registry list
wippy registry list --kind function.lua
wippy registry list --ns app --json
```

| Flag | Short | Description |
|------|-------|-------------|
| `--kind` | `-k` | Filter by kind |
| `--ns` | `-n` | Filter by namespace |
| `--name` | | Filter by name |
| `--meta` | | Filter by metadata |
| `--json` | | Output as JSON |
| `--yaml` | | Output as YAML |
| `--lock-file` | `-l` | Lock file path |

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

## Examples

### Development Workflow

```bash
# Initialize project
wippy init
wippy add wippy/http wippy/sql
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
wippy run --exec app:processes/app:worker

# With profiler enabled
wippy run -p -v
# Then: go tool pprof http://localhost:6060/debug/pprof/heap
```

### Dependency Management

```bash
# Add new dependency
wippy add acme/http@latest

# Repair corrupted modules
wippy install --repair

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

## Configuration File

Create `.wippy.yaml` for persistent settings:

```yaml
logger:
  mode: development
  level: debug
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
