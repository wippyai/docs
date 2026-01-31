# Installation

## Quick Install

```bash
curl -fsSL https://hub.wippy.ai/install.sh | bash
```

Or download directly from [hub.wippy.ai/releases](https://hub.wippy.ai/releases).

## Verify

```bash
wippy version
```

## Quick Start

```bash
# Create a new project
mkdir myapp && cd myapp
wippy init

# Add dependencies
wippy add wippy/http
wippy install

# Run
wippy run
```

## Commands Overview

| Command | Description |
|---------|-------------|
| `wippy init` | Initialize a new project |
| `wippy run` | Start the runtime |
| `wippy lint` | Check code for errors |
| `wippy add` | Add a dependency |
| `wippy install` | Install dependencies |
| `wippy update` | Update dependencies |
| `wippy pack` | Create a snapshot |
| `wippy publish` | Publish to hub |
| `wippy search` | Search for modules |
| `wippy auth` | Manage authentication |
| `wippy version` | Print version info |

See [CLI Reference](guides/cli.md) for full documentation.

## Next Steps

- [Hello World](tutorials/hello-world.md) - Create your first project
- [Project Structure](start/structure.md) - Understand the layout
- [CLI Reference](guides/cli.md) - All commands and options
