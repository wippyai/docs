# Installation

Download the Wippy binary for your platform.

## Download

Get the latest release from the [Wippy releases page](https://github.com/wippyai/wippy/releases).

### Linux

```bash
# AMD64
curl -L https://github.com/wippyai/wippy/releases/latest/download/wippy-linux-amd64 -o wippy
chmod +x wippy

# ARM64
curl -L https://github.com/wippyai/wippy/releases/latest/download/wippy-linux-arm64 -o wippy
chmod +x wippy
```

### macOS

```bash
# Apple Silicon (M1/M2/M3)
curl -L https://github.com/wippyai/wippy/releases/latest/download/wippy-darwin-arm64 -o wippy
chmod +x wippy

# Intel
curl -L https://github.com/wippyai/wippy/releases/latest/download/wippy-darwin-amd64 -o wippy
chmod +x wippy
```

### Windows

Download `wippy-windows-amd64.exe` from the releases page.

## Install to PATH

Move the binary to a directory in your PATH:

```bash
# Linux/macOS
sudo mv wippy /usr/local/bin/

# Or user-local
mv wippy ~/.local/bin/
```

## Verify Installation

```bash
wippy version
```

## Build from Source

For development or custom builds:

```bash
git clone https://github.com/wippyai/wippy.git
cd wippy
go build -o wippy ./cmd/wippy/
```

Requires Go 1.22+ and a C compiler (for SQLite).

## Next Steps

- [Quickstart](getting-started-quickstart.md) - Create your first project
- [Project Structure](getting-started-structure.md) - Understand the layout
