# Installation

Matryoshka-Harness provides multiple distribution channels designed for diverse developer workflows, automated CI/CD pipelines, and airgapped enterprise environments.

Whether you prefer zero-install on-demand execution, standalone static binaries with zero external dependencies, or conventional package manager installations, all distribution methods provide 100% feature parity.

---

## ⚡ 1. Zero-Install Execution (Recommended)

The fastest way to run Matryoshka without installing anything permanently onto your machine is via `bunx` or `npx`.

### Using `bunx` (Sub-15ms Startup)
```bash
# Run any command directly:
bunx @maiquelleonel/matryoshka <command>

# Example: Run AST antipattern verification
bunx @maiquelleonel/matryoshka wrap
```

### Using `npx`
```bash
# Run with Node.js npx:
npx @maiquelleonel/matryoshka <command>

# Example: Run maturity audit with SVG badge export
npx @maiquelleonel/matryoshka scan --badge ./badges/harness.svg
```

---

## 🚀 2. Standalone Compiled Binaries (Airgapped & Zero-Runtime)

For airgapped production environments, secure Docker containers, or developers who do not have Node.js or Bun installed in their host environment, Matryoshka is distributed as standalone, statically compiled native executables.

Each binary embeds Tree-sitter WebAssembly grammar runtimes and executes with zero external dependencies.

### Supported Platforms & Targets

| Target OS & Architecture | Binary Artifact Name | Direct Download URL |
| :--- | :--- | :--- |
| **Linux x86_64** | `baba-linux-x64` | `https://github.com/maiquelleonel/matryoshka-harness/releases/latest/download/baba-linux-x64` |
| **Linux ARM64 / AArch64** | `baba-linux-arm64` | `https://github.com/maiquelleonel/matryoshka-harness/releases/latest/download/baba-linux-arm64` |
| **macOS Apple Silicon (M1/M2/M3/M4)** | `baba-darwin-arm64` | `https://github.com/maiquelleonel/matryoshka-harness/releases/latest/download/baba-darwin-arm64` |
| **macOS Intel (x86_64)** | `baba-darwin-x64` | `https://github.com/maiquelleonel/matryoshka-harness/releases/latest/download/baba-darwin-x64` |
| **Windows x86_64** | `baba-windows-x64.exe` | `https://github.com/maiquelleonel/matryoshka-harness/releases/latest/download/baba-windows-x64.exe` |

### Installation via cURL

#### Linux (x64)
```bash
curl -sSL https://github.com/maiquelleonel/matryoshka-harness/releases/latest/download/baba-linux-x64 -o /usr/local/bin/baba
chmod +x /usr/local/bin/baba
```

#### Linux (ARM64)
```bash
curl -sSL https://github.com/maiquelleonel/matryoshka-harness/releases/latest/download/baba-linux-arm64 -o /usr/local/bin/baba
chmod +x /usr/local/bin/baba
```

#### macOS Apple Silicon (ARM64)
```bash
curl -sSL https://github.com/maiquelleonel/matryoshka-harness/releases/latest/download/baba-darwin-arm64 -o /usr/local/bin/baba
chmod +x /usr/local/bin/baba
```

#### macOS Intel (x64)
```bash
curl -sSL https://github.com/maiquelleonel/matryoshka-harness/releases/latest/download/baba-darwin-x64 -o /usr/local/bin/baba
chmod +x /usr/local/bin/baba
```

### Cryptographic Checksum Verification

Every release publishes a `checksums.txt` file containing SHA-256 hashes generated during the CI build matrix. Always verify checksum integrity before executing binaries in production:

```bash
# Download binary and official checksums:
curl -sSL https://github.com/maiquelleonel/matryoshka-harness/releases/latest/download/checksums.txt -o checksums.txt
curl -sSL https://github.com/maiquelleonel/matryoshka-harness/releases/latest/download/baba-linux-x64 -o baba-linux-x64

# Verify cryptographic hash:
sha256sum --check checksums.txt --ignore-missing
# Or on macOS:
shasum -a 256 --check checksums.txt
```

---

## 📦 3. Global & Local Package Managers

If you work within the JavaScript/TypeScript ecosystem, install Matryoshka globally using your favorite package manager:

### Bun
```bash
# Global installation:
bun add -g @maiquelleonel/matryoshka

# Project-local installation (dev dependency):
bun add -d @maiquelleonel/matryoshka
```

### npm
```bash
# Global installation:
npm install -g @maiquelleonel/matryoshka

# Project-local installation (dev dependency):
npm install --save-dev @maiquelleonel/matryoshka
```

### pnpm & Yarn
```bash
# pnpm:
pnpm add -g @maiquelleonel/matryoshka

# Yarn:
yarn global add @maiquelleonel/matryoshka
```

---

## 🪆 4. Triple Binary Aliases & Protective Shells

To maximize terminal ergonomics while preserving namespace integrity, Matryoshka installs three executable aliases with byte-for-byte behavioral parity:

* **`baba`** — 4-letter ergonomic command representing the Slavic matriarch of nesting dolls. Eliminates typos and speeds up everyday terminal workflows.
* **`bbyg`** — Baba-Yaga mythology shorthand, ideal for automated silicon agent sandboxes.
* **`matryoshka`** — The canonical formal package name recommended for corporate CI/CD pipelines.

```bash
# All three invocations are 100% equivalent:
baba --version
bbyg --version
matryoshka --version
```

### Protective Forwarding Shells (Anti-Typosquatting)

To protect the community against supply-chain attacks and frequent typos, the LeonelLabs ecosystem publishes official forwarding shells under the verified `@maiquelleonel` scope:

* `@maiquelleonel/baba` — Direct forwarding shell for `baba`
* `@maiquelleonel/bbyg` — Direct forwarding shell for `bbyg`
* `@maiquelleonel/matrioska` — Typosquatting defense for "i" spelling
* `@maiquelleonel/matryoska` — Typosquatting defense for missing "h" spelling

Each protective shell wraps `@maiquelleonel/matryoshka` and provides identical execution capabilities.

---

## ✅ 5. Verification & Sanity Check

Verify that your installation is functional by inspecting the version and available commands:

```bash
# Print global help menu:
baba --help

# Verify installed version:
baba --version

# Perform a quick stack detection on your current repository:
baba detect
```

---

## ⏭️ Next Steps

Now that you have Matryoshka installed, proceed to the [5-Minute Quickstart](quickstart.md) to inspect your repository, score maturity, compile ultra-lean `AGENTS.md` instructions, and integrate with AI coding assistants.
