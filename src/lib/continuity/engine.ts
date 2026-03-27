import { buildContinuityContext } from './context'
import { builtinContinuityRules } from './rules'
import type {
  ContinuityDocument,
  ContinuityEngine,
  ContinuityEngineConfig,
  ContinuityIssue,
  ContinuityIssueCode,
  ContinuityReport,
  ContinuityRule,
} from './types'

const ISSUE_CODES: readonly ContinuityIssueCode[] = [
  'UNKNOWN_ENTITY',
  'ALIAS_CONFLICT',
  'CHAPTER_TIMELINE_REVERSED',
  'POV_UNREGISTERED',
  'LOCATION_UNREGISTERED',
  'LORE_RULE_HIT',
]

export function createContinuityEngine(
  config: ContinuityEngineConfig = {},
): ContinuityEngine {
  const rules = resolveRules(config)

  return {
    rules,
    analyze: (document) => analyzeWithRules(document, rules, config),
  }
}

export function analyzeManuscript(
  document: ContinuityDocument,
  config: ContinuityEngineConfig = {},
): ContinuityReport {
  return createContinuityEngine(config).analyze(document)
}

function analyzeWithRules(
  document: ContinuityDocument,
  rules: readonly ContinuityRule[],
  config: ContinuityEngineConfig,
): ContinuityReport {
  const context = buildContinuityContext(document, config)
  const issues = rules.flatMap((rule) => rule.run(context))

  return {
    issues,
    stats: buildStats(document, issues),
    rulesRun: rules.map((rule) => rule.id),
  }
}

function resolveRules(config: ContinuityEngineConfig): readonly ContinuityRule[] {
  const mergedRules = [
    ...(config.includeDefaultRules === false ? [] : builtinContinuityRules),
    ...(config.rules ?? []),
  ]
  const byId = new Map<string, ContinuityRule>()

  for (const rule of mergedRules) {
    byId.set(rule.id, rule)
  }

  return Array.from(byId.values())
}

function buildStats(
  document: ContinuityDocument,
  issues: readonly ContinuityIssue[],
) {
  const issuesByCode = createIssueCountMap()

  for (const issue of issues) {
    issuesByCode[issue.code] += 1
  }

  return {
    chaptersChecked: document.chapters.length,
    scenesChecked: document.chapters.reduce(
      (total, chapter) => total + chapter.scenes.length,
      0,
    ),
    issuesByCode,
  }
}

function createIssueCountMap(): Record<ContinuityIssueCode, number> {
  return ISSUE_CODES.reduce<Record<ContinuityIssueCode, number>>(
    (counts, code) => {
      counts[code] = 0
      return counts
    },
    {
      UNKNOWN_ENTITY: 0,
      ALIAS_CONFLICT: 0,
      CHAPTER_TIMELINE_REVERSED: 0,
      POV_UNREGISTERED: 0,
      LOCATION_UNREGISTERED: 0,
      LORE_RULE_HIT: 0,
    },
  )
}
