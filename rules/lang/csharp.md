---
name: csharp-rules
description: C#/RhinoCommon implementation and security floor. Loads only when a .cs/.csproj file is touched.
paths: ["**/*.cs", "**/*.csproj"]
---

# C#

## Language-Specific

- **C#**: .NET 6+/RhinoCommon, `<Nullable>enable</Nullable>`, `IDisposable`+`using` for geometry/
  unmanaged resources, PascalCase public/`_camelCase` private. Full reference:
  `python-rhino-grasshopper`.

## Security Floor

- **C#**: never `BinaryFormatter` — `System.Text.Json`. No dynamic assembly loading from user paths.

## LSP

`csharp-lsp` (Claude Code plugin) is a bare OmniSharp/`csharp-ls` PATH lookup — no-ops silently
if not installed (`hfo1_lsp-os-docs_1`).
