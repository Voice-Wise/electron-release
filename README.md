# LiveType Electron Release

这个仓库承载 LiveType Electron 版的公有 CI、打包、GitHub Release asset 上传和 updater manifest 发布。

私有应用仓 `Voice-Wise/voicewise-electron` 通过 `repository_dispatch` 触发这里的 `ci`、`nightly` 和 `release` workflow。
