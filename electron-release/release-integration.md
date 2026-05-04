<!-- Electron Release 集成说明。记录私有触发、公有 CI/Release 迁移合同和缺失 Secret 风险。 -->

# Electron Release 集成

触发链路保持源项目模式：私有应用仓通过 `repository_dispatch` 发送 `ci`、`nightly`、`release`，公有 `Voice-Wise/electron-release` 仓 checkout 私有源码后执行 Electron 验证和打包。

## 稳定契约

- `ci` payload 保留 `sha`、`ref`、`skip_windows`、`sender_repo`。
- `nightly` payload 保留 `ref`、`branch`、`skip_windows`。
- `release` payload 保留 `ref`、`version`、`skip_windows`。
- Release 仓安装命令为 `bun install --frozen-lockfile`。
- Electron CI 验证命令为 `npm run typecheck`、`npm run test`、`npm run test:functional:local`。
- Electron 打包命令为 `npm run build && electron-builder <platform args>`。
- stable manifest 发布到 `https://github.com/Voice-Wise/electron-release/releases/download/stable/latest.json`。
- nightly manifest 发布到 `https://github.com/Voice-Wise/electron-release/releases/download/nightly/latest.json`。
- artifact 命名与 `electron-builder.yml` 保持一致：`LiveType-<version>-macos-<arch>.dmg`、`LiveType-<version>-windows-<arch>-setup.exe`。

## Release 仓库迁移状态

- Release 仓 `ci.yml`、`nightly.yml`、`release.yml` 已切到 `Voice-Wise/voicewise-electron`，不再 checkout 旧 Tauri 仓。
- CI 验证使用 `npm run typecheck`、`npm run test`、`npm run test:functional:local`、`npm run build:unpack`，确保构建和未压缩打包产物都能通过。
- Nightly / stable 打包使用 `npm run build && npx electron-builder <platform args>`，并从 `dist/` 收集 Electron 产物；Windows package job 运行 `npm run test:windows-installed-launch` 静默安装 NSIS 产物后做启动 smoke，manifest 发布后独立 Windows job 从 Release 仓下载安装包，再用同一脚本加 `VOICEWISE_WINDOWS_INSTALLED_UPDATER_MANIFEST_SMOKE=1` 和 `VOICEWISE_WINDOWS_INSTALLED_UPDATER_DOWNLOAD_OPEN_SMOKE=1` 验证已安装 app 消费真实 channel 并下载打开安装器；macOS post-manifest job 从 Release 仓下载对应架构 DMG，运行 `npm run test:macos-installed-launch` 挂载、复制安装、校验签名、启动，并可加 `VOICEWISE_MACOS_INSTALLED_UPDATER_MANIFEST_SMOKE=1` 和 `VOICEWISE_MACOS_INSTALLED_UPDATER_DOWNLOAD_OPEN_SMOKE=1` 验证已安装 app 的 updater 链路。
- Updater manifest 使用 `electron-release/generate-updater-manifest.mjs` 生成 `latest.json`。
- macOS 签名与公证继续使用 Release 仓现有 `APPLE_CERTIFICATE`、`APPLE_CERTIFICATE_PASSWORD`、`APPLE_SIGNING_IDENTITY`、`APPLE_ID`、`APPLE_PASSWORD`、`APPLE_TEAM_ID`。
- Windows 签名所需证书当前 Release YAML 未提供；迁移 Windows 正式包前需要补充 Windows code signing secret，或在 workflow 中明确保留 unsigned 降级。
- Sentry sourcemap/debug symbol 上传继续沿用 Release 仓现有 `SENTRY_AUTH_TOKEN`、`SENTRY_ORG`、`SENTRY_PROJECT`，Electron dSYM/PDB 搜索路径已改到 `dist/`。

## 发布候选验证矩阵

- 本地必过：`npm run typecheck && npm run test && npm run test:functional:local && npm run test:native-smoke && npm run build:unpack && npm run test:packaged-launch && npm run test:packaged-updater-manifest`。
- Release 合同必过：`npm run test -- electron-release`。
- cloud functional：`npm run test:functional:cloud`、`npm run test:functional:cloud:omni-plus-retry` 有凭据和网络时必跑；缺失时记录为云端链路风险。
- updater smoke：`npm run test:packaged-updater-manifest` 必须在 `npm run build:unpack` 后运行；Release Cross-Repo CI 需在 macOS/Windows packaged app 中读取真实 channel `latest.json` 并 HEAD 当前平台安装器 URL；Nightly/stable manifest 发布后需用已安装 Windows app 重跑 manifest smoke，并运行 `npm run test:packaged-updater-download-open` 证明安装后 runtime 能下载真实 installer 并触发 openPath；macOS 需用 `npm run test:macos-installed-launch` 覆盖 DMG 复制安装后的签名、启动、manifest 与下载/openPath probe。
- native smoke：本机 `npm run test:native-smoke` 必跑；Release Windows test job 需运行 `npm run test:native-smoke`，Windows package job 需覆盖安装后启动 smoke；Windows 热键、粘贴、前台应用和真实麦克风采集仍需在交互环境中确认。
- Windows 正式发布：默认沿用 `skip_windows=true`；如果开启 Windows 包，需要先处理 Windows 签名 secret 或接受 unsigned 降级。
