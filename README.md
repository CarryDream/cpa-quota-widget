<div align="center">

<img src="./src-tauri/icons/128x128.png" alt="cpa-quota-widget" width="96">

# CPA Quota Widget

[![Release](https://img.shields.io/github/v/release/CarryDream/cpa-quota-widget?style=flat-square)](https://github.com/CarryDream/cpa-quota-widget/releases/latest)
[![License](https://img.shields.io/github/license/CarryDream/cpa-quota-widget?style=flat-square&color=blue)](LICENSE)
[![Stars](https://img.shields.io/github/stars/CarryDream/cpa-quota-widget?style=flat-square&label=stars)](https://github.com/CarryDream/cpa-quota-widget/stargazers)

A lightweight cross-platform desktop quota HUD and floating widget for **CPA (CLIProxyAPI)** and **CPAMP (CPA Manager Plus)**.

Monitor multi-platform credentials, remaining percentages, and reset countdowns right from your desktop with zero disruption to your workflow.

[中文文档](README_CN.md) ｜ [English](README.md) ｜ [Download Releases](https://github.com/CarryDream/cpa-quota-widget/releases)

</div>

---

## Screenshots

<div align="center">

| Light Mode (Expanded) | Dark Mode (Expanded) |
| :---: | :---: |
| <img src="./img/desktop-light.png" alt="Light Mode" width="400"> | <img src="./img/desktop-dark.png" alt="Dark Mode" width="400"> |

| Compact Mini Capsule | In-Window Settings Overlay |
| :---: | :---: |
| <img src="./img/desktop-mini.png" alt="Compact Capsule" width="400"> | <img src="./img/desktop-settings.png" alt="Settings Overlay" width="400"> |

*Screenshots illustrate the user interface with fictional demo data.*

</div>

---

## Key Features

- **Multi-Platform Quota Tracking**: Instant tabs for Google, Codex/OpenAI, xAI/Grok, Claude, and more. View 5-hour, weekly, and monthly quota windows with reset countdowns.
- **Smart Magnetic Docking (吸附效果)**: Smoothly snaps to screen borders (avoiding the Windows taskbar) and automatically docks to adjacent application windows (VS Code, Chrome, etc.).
- **Automatic Filter for Disabled Credentials**: Inactive or disabled accounts in CPA are completely omitted from the panel and quota metrics.
- **Privacy Name Masking (One-Click Toggle)**: Click the eye icon in the header to instantly mask sensitive account emails, phone numbers, and identifier names (ideal for screencasts and screenshots).
- **Light & Dark Theme Synchronization**: Native window icon, taskbar group, system tray, and header logo seamlessly adapt between daylight and night themes.
- **Compact Floating Capsule**: Switch between a space-saving mini capsule with dual-tone progress bars and the comprehensive expanded view via double-click.
- **Always-on-Top & Opacity Adjustment**: Keep the widget pinned above other windows and customize background opacity with real-time preview.
- **System Tray Integration**: Closing the window hides it quietly to the system tray; restore with a left-click or quit via the native right-click menu.

---

## Quick Start & Installation

### Option 1: Pre-built Binaries (Recommended)

Download the latest version from [GitHub Releases](https://github.com/CarryDream/cpa-quota-widget/releases):

| Platform | Format | Description |
|---|---|---|
| **Windows** | `cpa-quota-widget-*-windows-x64-portable.zip` | **Portable (No installation)** — extract and run directly |
| **Windows** | `cpa-quota-widget_*_x64_en-US.msi` / `-setup.exe` | Standard Windows installer |
| **macOS** | `cpa-quota-widget-*-macOS.zip` / `.dmg` | Apple Silicon & Intel macOS app |
| **Linux** | `*.AppImage` / `*.deb` | Linux portable binary or Debian package |

---

### Option 2: Build from Source

#### Prerequisites

1. **Node.js**: `v20` or `v22+`
2. **Rust**: Stable toolchain (`rustup default stable`)
3. **Platform Dependencies**:
   - **Windows**: Microsoft C++ Build Tools & WebView2 Runtime
   - **macOS**: Xcode Command Line Tools
   - **Linux**: `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`

```bash
# Clone the repository
git clone https://github.com/CarryDream/cpa-quota-widget.git
cd cpa-quota-widget

# Install dependencies
npm install

# Run in desktop development mode (with Hot Reload)
npm run tauri dev

# Build production executable & installer bundles
npm run tauri build
```

Compiled binaries will be generated in `src-tauri/target/release/`.

---

## Connecting to Your CPA Service

Open the widget's **Settings** (gear icon or tray menu) and enter your service endpoint:

| Connection Target | Default Address | Key Required |
|---|---|---|
| **Direct CPA (CLIProxyAPI)** | `http://127.0.0.1:8317` | **CPA Management Key** (`remote-management.key` in `config.yaml`) |
| **CPAMP (CPA Manager Plus)** | `http://127.0.0.1:18317` | **CPAMP Admin Key** (generated during server startup) |

> ⚠️ **Notice**: Do not enter model inference API keys (e.g. `sk-...`). The widget connects exclusively to Management APIs (`/v0/management/auth-files` and `/v0/management/api-call`).

1. Click **"Test Connection"** to verify connectivity with your CPA server.
2. Click **"Save Settings"** to store your configuration and immediately refresh quota metrics.

---

## Privacy & Security

- **Local Storage Only**: Configurations and Management Keys are saved strictly within the local WebView's `localStorage`. No cloud telemetry, analytics SDKs, or external trackers are included.
- **Direct Communication**: All network requests route exclusively to your specified CPA / CPAMP endpoint.
- **Privacy Masking Mode**: Built-in name masking ensures that sensitive credential emails and IDs remain hidden during screen shares and screenshots.

---

## Acknowledgements

- [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI) — Powerful multi-platform AI API proxy and management center.
- [CPA-Manager-Plus](https://github.com/seakee/CPA-Manager-Plus) — Self-hosted CPA management and AI gateway observability platform.
- [Tauri](https://tauri.app/) — Lightweight, secure desktop application framework.

---

## License

[MIT](LICENSE) — Copyright (c) 2026 CarryDream.
