// 发布候选验证矩阵。汇总本仓本地验收、Release 仓打包目标和剩余风险。
import { buildElectronWorkflowPlan } from './workflow-contract.mjs'

export const LOCAL_VALIDATION_COMMANDS = [
  'npm run typecheck',
  'npm run test',
  'npm run test:functional:local',
  'npm run test:native-smoke',
  'npm run build:unpack',
  'npm run test:packaged-launch',
  'npm run test:packaged-updater-manifest'
]

export const RELEASE_CANDIDATE_CHECKS = [
  {
    id: 'typecheck',
    layer: 'local',
    command: 'npm run typecheck',
    required: true
  },
  {
    id: 'unit',
    layer: 'local',
    command: 'npm run test',
    required: true
  },
  {
    id: 'functional-local',
    layer: 'local',
    command: 'npm run test:functional:local',
    required: true
  },
  {
    id: 'unpack-build',
    layer: 'local',
    command: 'npm run build:unpack',
    required: true
  },
  {
    id: 'packaged-launch',
    layer: 'local',
    command: 'npm run test:packaged-launch',
    required: true
  },
  {
    id: 'packaged-updater-manifest',
    layer: 'release',
    command: 'npm run test:packaged-updater-manifest',
    required: true
  },
  {
    id: 'packaged-updater-download-open',
    layer: 'release',
    command: 'npm run test:packaged-updater-download-open',
    required: false,
    riskIfMissing: '安装后更新下载与打开安装器入口需要 packaged app 下载真实安装器并触发 openPath smoke。'
  },
  {
    id: 'macos-installed-launch',
    layer: 'release',
    command: 'npm run test:macos-installed-launch',
    required: false,
    riskIfMissing: 'macOS DMG 仍需复制安装后启动、签名校验、消费 updater manifest 并下载打开安装器。'
  },
  {
    id: 'functional-cloud',
    layer: 'cloud',
    command: 'npm run test:functional:cloud',
    required: false,
    riskIfMissing: '真实云端 ASR functional 需要可用凭据和网络；缺失时不能证明云端转写链路。'
  },
  {
    id: 'functional-cloud-omni-plus-retry',
    layer: 'cloud',
    command: 'npm run test:functional:cloud:omni-plus-retry',
    required: false,
    riskIfMissing:
      'Omni Plus 失败恢复与 FunASR 兜底需要可用凭据和网络；缺失时不能证明云端恢复链路。'
  },
  {
    id: 'windows-native-smoke',
    layer: 'native',
    command: 'npm run test:native-smoke',
    required: false,
    riskIfMissing: 'Windows 权限、热键、粘贴和前台应用能力仍需在 Windows 机器上做 native smoke。'
  },
  {
    id: 'windows-installed-launch',
    layer: 'release',
    command: 'npm run test:windows-installed-launch',
    required: false,
    riskIfMissing: 'Windows 安装包仍需静默安装后启动、消费 updater manifest 并下载打开安装器，以覆盖 NSIS 安装路径。'
  }
]

export function buildReleaseCandidatePlan({ skipWindows = true } = {}) {
  const workflow = buildElectronWorkflowPlan({ skipWindows })
  return {
    localValidation: LOCAL_VALIDATION_COMMANDS.join(' && '),
    checks: RELEASE_CANDIDATE_CHECKS,
    releaseWorkflow: {
      repositories: workflow.repositories,
      dispatchContracts: workflow.dispatchContracts,
      packageTargets: workflow.commands.package,
      manifestCommand: workflow.commands.manifest,
      secretTodos: workflow.secrets.missingTodo
    }
  }
}

export function evaluateReleaseCandidateResults(results, { skipWindows = true } = {}) {
  const resultById = new Map(results.map((result) => [result.id, result]))
  const failedRequired = []
  const missingRequired = []
  const risks = []

  for (const check of RELEASE_CANDIDATE_CHECKS) {
    const result = resultById.get(check.id)
    if (!result) {
      if (check.required) missingRequired.push(check.id)
      else if (check.riskIfMissing) risks.push(check.riskIfMissing)
      continue
    }
    if (result.status !== 'pass' && check.required) failedRequired.push(check.id)
    if (result.status !== 'pass' && !check.required && check.riskIfMissing)
      risks.push(check.riskIfMissing)
  }

  const plan = buildReleaseCandidatePlan({ skipWindows })
  for (const todo of plan.releaseWorkflow.secretTodos) risks.push(todo.reason)

  return {
    status:
      failedRequired.length || missingRequired.length
        ? 'blocked'
        : risks.length
          ? 'validated-with-risks'
          : 'validated',
    failedRequired,
    missingRequired,
    risks
  }
}
