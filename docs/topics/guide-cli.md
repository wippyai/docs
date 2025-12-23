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

Start the runtime from lock file.

```bash
wippy run
wippy run --override app:gateway:addr=:9090
wippy run -o app:db:host=localhost -o app:db:port=5432
wippy run --exec app:processes/app:worker
```

| Flag | Short | Description |
|------|-------|-------------|
| `--override` | `-o` | Override entry values (namespace:entry:field=value) |
| `--exec` | `-x` | Execute process and exit (host/namespace:entry) |
| `--method` | | Method to call on exec process |

## wippy install

Install dependencies from lock file. If lock file is missing, runs `init` then `update`.

```bash
wippy install
wippy install keeper/keeper wippy/relay
wippy install --force
wippy install --repair
```

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--lock-file` | `-l` | wippy.lock | Lock file path |
| `--force` | | | Bypass cache, always download |
| `--repair` | | | Verify hashes, re-download if mismatch |

When module names are provided, only those modules are processed.

## wippy update

Update dependencies and regenerate lock file.

```bash
wippy update
wippy update acme/http
wippy update acme/http demo/sql
```

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--lock-file` | `-l` | wippy.lock | Lock file path |
| `--src-dir` | `-d` | . | Source directory |
| `--modules-dir` | | .wippy | Modules directory |

Without arguments, re-resolves entire dependency graph. With module names, updates only those modules while keeping others locked.

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

## wippy run-pack

Start runtime from pack files.

```bash
wippy run-pack snapshot.wapp
wippy run-pack base.wapp overlay.wapp
```

Multiple packs are loaded in order and merged. No additional flags beyond global flags.

## wippy version

Print version information.

```bash
wippy version
```

## Examples

### Development

```bash
# Initialize project
wippy init
wippy update

# Run with debug output
wippy run -c -v

# Override config for local dev
wippy run -o app:db:host=localhost -o app:db:port=5432
```

### Production

```bash
# Create release pack with bytecode
wippy pack release.wapp --bytecode ** --exclude-ns test.**

# Run from pack with memory limit
wippy run-pack release.wapp -m 2G
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
# Repair corrupted modules
wippy install --repair

# Force re-download
wippy install --force

# Update specific module
wippy update acme/http
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

- [Configuration](guide-configuration.md) - Config file reference
- [Observability](guide-observability.md) - Monitoring and logging
