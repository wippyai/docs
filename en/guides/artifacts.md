---
title: "Build-Time Artifacts"
description: "Declare, validate, publish, and materialize format-aware filesystem artifacts for consuming projects."
---

# Build-Time Artifacts

A module can ship a directory that consumers use **at build time** rather than
at runtime, such as a package that other modules compile against. Wippy calls
these **artifacts**: WAPP filesystem resources marked with
`meta.artifact.format`.

Artifacts allow a shared package to travel with a module across repository
boundaries, where a repository-local path alias cannot resolve it.

[The Design Layer](../frontend/design-layer.md) explains *what* belongs in such
a package and what does not; this page is the mechanism that ships it.

## Declaring an Artifact

The producer declares a normal `fs.directory` and marks it with a format:

```yaml
# src/_index.yaml
entries:
  - name: package_fs
    kind: fs.directory
    meta:
      comment: The npm package consumers materialize at build time.
      artifact:
        format: node-package
    directory: ./package
```

The resource is packed into the WAPP as usual. Declared
artifacts are **validated during module publish and application pack**, so a
malformed one fails at publish rather than in a consumer.

## Formats

A format adapter decides how a directory is validated, what identity it has,
and where it lands. Wippy ships one built-in:

| Format | Owns subtree | Validates |
|---|---|---|
| `node-package` | `npm/` | `package.json` |

`node-package` requires a `name` and a semantic `version`, and **rejects
`preinstall`, `install`, `postinstall` and `prepare` lifecycle scripts** — a
materialized package may not execute anything on install. It writes to
`npm/<package name>` under the materialization root.

The format must be registered in the binary doing the work. Hosts may register
additional formats; duplicate names and overlapping roots are rejected.

## Materialization

Materialized outputs are reconciled automatically during:

- full and targeted `wippy install` and `wippy update`
- cold boot
- Hub-backed dynamic install, update and uninstall

Full install, update, cold boot and runtime dependency reconciliation are
*exact*: stale outputs are pruned. A **targeted** install overlays only the
selected modules and preserves outputs belonging to modules it did not select.

Local module replacements go through the same validation and materialization
lifecycle as packed resources, so a replaced module's artifact behaves like a
published one.

### Explicit Materialization

For a build step that needs the artifact before the runtime is involved, the
CLI exposes it directly:

```bash
wippy artifacts materialize <pack.wapp> <namespace:name> [--root <directory>]
```

`--root` defaults to `.wippy`. The resource must declare `meta.artifact.format`
and that format must be registered in this CLI.

This command does **not**
resolve module dependencies, does not mutate `wippy.lock`, does not invoke
package managers, and does not participate in runtime composition. It validates
one artifact out of one WAPP and writes it to disk.

### Output Location

`artifact.materialization_root` configures the application-owned output root.
Its default is the parent of the dependency vendor directory. Each format owns
a non-overlapping subtree beneath it, so `node-package` output is always under
`<root>/npm/`.

Materialization is transactional. Content is validated and staged, managed
roots are swapped atomically under a process lock, a failure rolls back with
the surrounding registry transaction, and an interrupted swap is recovered on
the next run.

## Worked Example: A Shared Frontend Package

A producer module can publish a package without serving a runtime resource:

```yaml
# platform/ui-kit/src/_index.yaml
version: "1.0"
namespace: kickside.ui_kit

entries:
  - name: package_fs
    kind: fs.directory
    meta:
      artifact:
        format: node-package
    directory: ./package
```

A consumer materializes it into its own tree before installing dependencies:

```bash
wippy artifacts materialize kickside-ui-kit-1.5.0.wapp \
  kickside.ui_kit:package_fs --root ./.wippy
```

That writes `./.wippy/npm/@kickside/ui-kit`. The consumer picks it up with an
ordinary workspaces glob, so resolution is plain node resolution from there on:

```json
{
  "workspaces": ["./.wippy/npm/@*/*"]
}
```

```bash
npm install
```

This arrangement has two important properties:

- **The package is its own module, not a directory inside a bigger one.** The
  artifact carries its own `package.json` version, and tying it to a module
  that changes for unrelated reasons forces a release of one every time the
  other moves.
- **The consumer resolves it as a normal dependency.** Once materialized there
  is no Wippy-specific import path, which is what lets the same source build
  inside the monorepo and outside it.

## End-to-End Workflow

### Authoring the Producer

For a package artifact, the directory itself can be the deliverable. A CSS
vocabulary package consists of its files and manifest:

```text
platform/ui-kit/
├── src/_index.yaml      # declares package_fs as the artifact
└── package/             # the directory that becomes the npm package
    ├── package.json
    ├── kx-card.css
    └── kx-state.css
```

```json
{
  "name": "@kickside/ui-kit",
  "version": "1.5.0",
  "type": "module",
  "sideEffects": ["*.css"],
  "exports": {
    "./kx-card.css": "./kx-card.css",
    "./kx-state.css": "./kx-state.css"
  },
  "files": ["kx-card.css", "kx-state.css", "package.json"]
}
```

`sideEffects` matters for a CSS-only package: without it a bundler is free to
treat an imported stylesheet as dead code and drop it.

**The package version must equal the module version.** `wippy publish`
validates this and refuses a mismatch, so bump both together. This is also the
reason to give a shared package its *own* module rather than nesting it inside
a larger one — otherwise every unrelated change to the host module forces a
release of the package, and vice versa.

### Publishing

```bash
# validate without publishing
wippy publish --dry-run --version 1.5.0

# publish
wippy publish --create --module-type library --module-visibility public --version 1.5.0
```

Declared artifacts are validated as part of publish, so a package.json that
fails the format's rules is rejected here rather than in a consumer's build.

### Development Loop

During development, pack the producer locally and point the consumer's
materialization step at that file:

```bash
# from the producer module
wippy pack /tmp/ui-kit-dev.wapp

# consumers materialize from the local pack rather than the published one
UI_KIT_WAPP=/tmp/ui-kit-dev.wapp make ui-kit MOD=workflows
```

Keep the pack-file override as the only difference between development and CI.
An environment variable can select the local pack while leaving downstream
materialization and build steps unchanged.

### Build and CI Integration

Make materialization a **prerequisite of the consumer's build**:

```make
UI_KIT_WAPP ?=

build:
	@case " $(UI_KIT_CONSUMERS) " in *" $(MOD) "*) $(MAKE) ui-kit MOD=$(MOD);; esac
	cd $(call fe_dir,$(MOD)) && npm run build
```

CI can then run the same `make build` without an additional artifact step.
`UI_KIT_WAPP` is unset, so the fetch-and-materialize path runs against the
published version pinned in `build-inputs`. A fresh checkout cannot compile
against a stale or missing package, and a contributor who has never heard of
artifacts still gets a correct build.

## Consumer Integration Steps

Because `wippy artifacts materialize` handles one resource from one pack, a
consumer build must coordinate four steps:

**1. Fetch the `.wapp`.** The command takes a *pack file path*, not a module
reference, and does not resolve dependencies. One approach is a small Wippy
project that pins and downloads the producer:

```yaml
# build-inputs/wippy.lock — a project that exists only to fetch
modules:
  - name: kickside/ui-kit
    version: 1.5.0
    hash: be1eafd5…
```

```bash
( cd build-inputs && wippy install )
wapp=$(ls build-inputs/.wippy/vendor/kickside/ui-kit-*.wapp | grep -v sha256 | sort | tail -1)
```

Pinning it here rather than in the application lock keeps a build-time input
out of the runtime dependency graph.

**2. Materialize once per consumer** into a root the consumer's package
manager can see:

```bash
wippy artifacts materialize "$wapp" kickside.ui_kit:package_fs --root ./ui/.wippy
```

**3. Wire the consumer's `package.json`.** Materializing writes files; it
does not edit manifests. npm links the package only if the consumer declares
*both* the workspace glob and the dependency:

```json
{
  "workspaces": ["./.wippy/npm/@*/*"],
  "dependencies": { "@kickside/ui-kit": "*" }
}
```

The version is `*` because the materialized package carries its own. Automate
this step and make it idempotent. Without the manifest wiring, the build may
later report an `ENOENT` for a stylesheet instead of identifying the missing
dependency configuration.

**4. Run the package manager.** `materialize` does not invoke one, so run
`npm install` after step 3.

Together, in a target that takes the consuming module as a parameter:

```make
ui-kit:
	@set -e; \
	( cd build-inputs && $(WIPPY) install ); \
	wapp=$$(ls build-inputs/.wippy/vendor/kickside/ui-kit-*.wapp | grep -v sha256 | sort | tail -1); \
	test -n "$$wapp" || { echo "no ui-kit .wapp; is the module published?"; exit 1; }; \
	$(WIPPY) artifacts materialize "$$wapp" kickside.ui_kit:package_fs --root $(DIR)/.wippy; \
	cd $(DIR) && node ../../scripts/wire-ui-kit.mjs && npm install --no-audit --no-fund
```

Make the whole target a prerequisite of the consumer's build to prevent a fresh
checkout from compiling against a stale or absent package.

## Out of Scope

Artifacts intentionally do not introduce a second resolver, package registry,
archive format, lock schema, Hub API, or module manifest. Build-only dependency
semantics, redistribution policy and host ABI validation are separate concerns
and are not solved here.

## Related

- [Dependency Management](./dependency-management.md) — resolving modules and
  local replacements
- [Publishing](./publishing.md) — what a published module contains
- [The Design Layer](../frontend/design-layer.md) — why a shared frontend
  vocabulary ships as a package in the first place
