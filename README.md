<p align="center">
    <a href="https://wippy.ai" target="_blank">
        <picture>
            <source media="(prefers-color-scheme: dark)" srcset="https://github.com/wippyai/.github/blob/main/logo/wippy-text-dark.svg?raw=true">
            <img width="30%" align="center" src="https://github.com/wippyai/.github/blob/main/logo/wippy-text-light.svg?raw=true" alt="Wippy logo">
        </picture>
    </a>
</p>

<h1 align="center">Documentation</h1>

<p align="center">
    <em>Source content for the Wippy documentation, served at <a href="https://wippy.ai/en/">wippy.ai/en/</a></em>
</p>

This repository holds the documentation source for the Wippy platform. It is
**not** a standalone site — the content is consumed by the documentation engine
in [`wippy/puiblic-website-and-documentation`](https://git.wippy.ai/wippy/puiblic-website-and-documentation),
which syncs this repository on every push to `main` and renders it at
`https://wippy.ai/<lang>/`.

A commit landing on `main` triggers a re-sync and the change appears at
`wippy.ai/en/` (and every other supported locale).

## Layout

```
languages.json          # locale code -> content directory (e.g. "en" -> "en")
en/manifest.json        # navigation tree for English
en/start/about.md       # markdown page (frontmatter: title, description)
en/.../*.md
de/ es/ ja/ ko/ pt/ ru/ zh/   # one directory per supported locale
```

Each locale directory contains a `manifest.json` (the navigation tree, with
`title` / `path` / `children`) and the markdown pages it references. Pages may
use YAML frontmatter (`title`, `description`, `keywords`); mermaid code fences
and admonitions are supported by the engine.

## Contributing

We welcome contributions to improve our documentation! Please read the
[Contributing Guide](https://github.com/wippyai/.github/blob/main/CONTRIBUTING.md)
to get started.
