import type {
  ContinuityContext,
  ContinuityIssue,
  ContinuityRule,
  FactPattern,
  FactValue,
  LoreRule,
  SceneFact,
  StoryChapter,
} from './types'

export const aliasConflictRule: ContinuityRule = {
  id: 'alias-conflict',
  description: 'Finds collisions in normalized aliases across registered entries.',
  run: (context) => {
    const issues: ContinuityIssue[] = []

    for (const [aliasKey, targets] of context.aliasTargets.entries()) {
      if (targets.length < 2) {
        continue
      }

      const evidence = targets.map(
        (target) => `${target.namespace}:${target.canonicalName} (${target.id})`,
      )

      issues.push({
        code: 'ALIAS_CONFLICT',
        severity: 'warning',
        message: `Alias "${aliasKey}" resolves to multiple registered entries.`,
        aliasKey,
        evidence,
        data: { targets: evidence },
      })
    }

    return issues
  },
}

export const unknownEntityRule: ContinuityRule = {
  id: 'unknown-entity',
  description: 'Flags scene mentions that cannot be resolved to a registered entity.',
  run: (context) => {
    const issues: ContinuityIssue[] = []

    for (const chapter of context.document.chapters) {
      for (const scene of chapter.scenes) {
        for (const mention of scene.entityMentions ?? []) {
          const resolution = context.resolveEntityMention(mention)

          if (resolution.status !== 'missing') {
            continue
          }

          issues.push({
            code: 'UNKNOWN_ENTITY',
            severity: 'error',
            message: buildUnknownEntityMessage(mention.rawText, resolution.lookupId),
            chapterId: chapter.id,
            sceneId: scene.id,
            evidence: compactEvidence([
              mention.rawText ? `text:${mention.rawText}` : undefined,
              resolution.lookupId ? `entityId:${resolution.lookupId}` : undefined,
            ]),
          })
        }
      }
    }

    return issues
  },
}

export const timelineReverseRule: ContinuityRule = {
  id: 'timeline-reversed',
  description: 'Checks that chapter chronology does not move backward unless allowed.',
  run: (context) => {
    const issues: ContinuityIssue[] = []
    const groups = new Map<string, StoryChapter[]>()

    for (const chapter of context.document.chapters) {
      if (!chapter.timeline) {
        continue
      }

      const timelineId = chapter.timeline.timelineId ?? 'main'
      const bucket = groups.get(timelineId) ?? []
      bucket.push(chapter)
      groups.set(timelineId, bucket)
    }

    for (const [timelineId, chapters] of groups.entries()) {
      chapters.sort((left, right) => left.sequence - right.sequence)

      for (let index = 1; index < chapters.length; index += 1) {
        const previous = chapters[index - 1]
        const current = chapters[index]

        if (!previous.timeline || !current.timeline) {
          continue
        }

        if (
          current.timeline.order >= previous.timeline.order ||
          current.timeline.allowOutOfOrder
        ) {
          continue
        }

        issues.push({
          code: 'CHAPTER_TIMELINE_REVERSED',
          severity: 'error',
          message: `Chapter "${current.title}" moves timeline "${timelineId}" backward after "${previous.title}".`,
          chapterId: current.id,
          evidence: [
            `previous:${formatTimelinePoint(previous)}`,
            `current:${formatTimelinePoint(current)}`,
          ],
          data: {
            timelineId,
            previousOrder: previous.timeline.order,
            currentOrder: current.timeline.order,
          },
        })
      }
    }

    return issues
  },
}

export const povRegistrationRule: ContinuityRule = {
  id: 'pov-unregistered',
  description: 'Ensures chapter and scene POVs are registered in the POV registry.',
  run: (context) => {
    const issues: ContinuityIssue[] = []

    for (const chapter of context.document.chapters) {
      if (chapter.povEntityId && !context.povEntityIds.has(chapter.povEntityId)) {
        issues.push(
          buildPovIssue({
            context,
            chapterId: chapter.id,
            entityId: chapter.povEntityId,
            label: `Chapter "${chapter.title}"`,
          }),
        )
      }

      for (const scene of chapter.scenes) {
        if (!scene.povEntityId || context.povEntityIds.has(scene.povEntityId)) {
          continue
        }

        issues.push(
          buildPovIssue({
            context,
            chapterId: chapter.id,
            sceneId: scene.id,
            entityId: scene.povEntityId,
            label: `Scene "${scene.title ?? scene.id}"`,
          }),
        )
      }
    }

    return issues
  },
}

export const locationRegistrationRule: ContinuityRule = {
  id: 'location-unregistered',
  description: 'Flags scene locations and mentions that are not registered.',
  run: (context) => {
    const issues: ContinuityIssue[] = []

    for (const chapter of context.document.chapters) {
      for (const scene of chapter.scenes) {
        if (scene.locationId && !context.locationsById.has(scene.locationId)) {
          issues.push({
            code: 'LOCATION_UNREGISTERED',
            severity: 'error',
            message: `Scene "${scene.title ?? scene.id}" points at unknown location "${scene.locationId}".`,
            chapterId: chapter.id,
            sceneId: scene.id,
            locationId: scene.locationId,
            evidence: [`locationId:${scene.locationId}`],
          })
        }

        for (const mention of scene.locationMentions ?? []) {
          const resolution = context.resolveLocationMention(mention)

          if (resolution.status !== 'missing') {
            continue
          }

          issues.push({
            code: 'LOCATION_UNREGISTERED',
            severity: 'error',
            message: buildLocationMessage(mention.rawText, resolution.lookupId),
            chapterId: chapter.id,
            sceneId: scene.id,
            evidence: compactEvidence([
              mention.rawText ? `text:${mention.rawText}` : undefined,
              resolution.lookupId ? `locationId:${resolution.lookupId}` : undefined,
            ]),
          })
        }
      }
    }

    return issues
  },
}

export const loreRuleHitRule: ContinuityRule = {
  id: 'lore-rule-hit',
  description: 'Evaluates declarative lore rules against chapter and scene facts.',
  run: (context) => {
    const issues: ContinuityIssue[] = []

    for (const loreRule of context.document.loreRules ?? []) {
      const scope = loreRule.scope ?? 'scene'

      if (scope === 'chapter') {
        for (const chapter of context.document.chapters) {
          const evaluation = evaluateLoreRule(loreRule, context.getChapterFacts(chapter))

          if (!evaluation) {
            continue
          }

          issues.push({
            code: 'LORE_RULE_HIT',
            severity: loreRule.severity ?? 'warning',
            message: loreRule.message,
            chapterId: chapter.id,
            ruleId: loreRule.id,
            evidence: evaluation.evidence,
          })
        }

        continue
      }

      for (const chapter of context.document.chapters) {
        for (const scene of chapter.scenes) {
          const evaluation = evaluateLoreRule(
            loreRule,
            context.getSceneFacts(chapter, scene),
          )

          if (!evaluation) {
            continue
          }

          issues.push({
            code: 'LORE_RULE_HIT',
            severity: loreRule.severity ?? 'warning',
            message: loreRule.message,
            chapterId: chapter.id,
            sceneId: scene.id,
            ruleId: loreRule.id,
            evidence: evaluation.evidence,
          })
        }
      }
    }

    return issues
  },
}

export const builtinContinuityRules: readonly ContinuityRule[] = [
  aliasConflictRule,
  unknownEntityRule,
  timelineReverseRule,
  povRegistrationRule,
  locationRegistrationRule,
  loreRuleHitRule,
]

type LoreEvaluation = {
  evidence: readonly string[]
}

function evaluateLoreRule(
  rule: LoreRule,
  facts: readonly SceneFact[],
): LoreEvaluation | null {
  // Semantics are intentionally asymmetric:
  // - when: all patterns must match before the rule becomes active
  // - require: all patterns must be present once active
  // - forbid: any matching pattern triggers the rule
  if (!hasEveryPattern(rule.when, facts)) {
    return null
  }

  const missingRequired = (rule.require ?? []).filter(
    (pattern) => !facts.some((fact) => factMatchesPattern(fact, pattern)),
  )
  const forbiddenMatches = (rule.forbid ?? []).filter((pattern) =>
    facts.some((fact) => factMatchesPattern(fact, pattern)),
  )

  if (missingRequired.length === 0 && forbiddenMatches.length === 0) {
    return null
  }

  const evidence = [
    ...missingRequired.map(
      (pattern) => `missing required fact: ${describePattern(pattern)}`,
    ),
    ...forbiddenMatches.map(
      (pattern) => `forbidden fact present: ${describePattern(pattern)}`,
    ),
  ]

  return { evidence }
}

function hasEveryPattern(
  patterns: readonly FactPattern[] | undefined,
  facts: readonly SceneFact[],
): boolean {
  return (patterns ?? []).every((pattern) =>
    facts.some((fact) => factMatchesPattern(fact, pattern)),
  )
}

function factMatchesPattern(fact: SceneFact, pattern: FactPattern): boolean {
  if (fact.type !== pattern.type) {
    return false
  }

  switch (fact.type) {
    case 'entity-trait':
      if (pattern.type !== 'entity-trait') {
        return false
      }

      return (
        fact.entityId === (pattern.entityId ?? fact.entityId) &&
        fact.trait === pattern.trait &&
        valueMatches(fact.value, pattern.equals, pattern.oneOf)
      )
    case 'location-trait':
      if (pattern.type !== 'location-trait') {
        return false
      }

      return (
        fact.locationId === (pattern.locationId ?? fact.locationId) &&
        fact.trait === pattern.trait &&
        valueMatches(fact.value, pattern.equals, pattern.oneOf)
      )
    case 'relationship':
      if (pattern.type !== 'relationship') {
        return false
      }

      return (
        fact.sourceEntityId === (pattern.sourceEntityId ?? fact.sourceEntityId) &&
        fact.relation === pattern.relation &&
        fact.targetEntityId === (pattern.targetEntityId ?? fact.targetEntityId) &&
        valueMatches(fact.value, pattern.equals, pattern.oneOf)
      )
    case 'scene-tag':
      if (pattern.type !== 'scene-tag') {
        return false
      }

      return (
        fact.key === pattern.key &&
        valueMatches(fact.value, pattern.equals, pattern.oneOf)
      )
    default:
      return assertNever(fact)
  }
}

function valueMatches(
  actual: FactValue | undefined,
  equals: FactValue | undefined,
  oneOf: readonly FactValue[] | undefined,
): boolean {
  if (equals !== undefined) {
    return actual === equals
  }

  if (oneOf) {
    return actual !== undefined && oneOf.includes(actual)
  }

  return true
}

function describePattern(pattern: FactPattern): string {
  switch (pattern.type) {
    case 'entity-trait':
      return `entity-trait(${pattern.entityId ?? '*'}, ${pattern.trait}, ${describeValuePattern(pattern.equals, pattern.oneOf)})`
    case 'location-trait':
      return `location-trait(${pattern.locationId ?? '*'}, ${pattern.trait}, ${describeValuePattern(pattern.equals, pattern.oneOf)})`
    case 'relationship':
      return `relationship(${pattern.sourceEntityId ?? '*'} -> ${pattern.relation} -> ${pattern.targetEntityId ?? '*'}, ${describeValuePattern(pattern.equals, pattern.oneOf)})`
    case 'scene-tag':
      return `scene-tag(${pattern.key}, ${describeValuePattern(pattern.equals, pattern.oneOf)})`
    default:
      return assertNever(pattern)
  }
}

function describeValuePattern(
  equals: FactValue | undefined,
  oneOf: readonly FactValue[] | undefined,
): string {
  if (equals !== undefined) {
    return `equals:${String(equals)}`
  }

  if (oneOf) {
    return `oneOf:${oneOf.map((value) => String(value)).join('|')}`
  }

  return 'any'
}

function buildUnknownEntityMessage(rawText: string, lookupId: string | undefined): string {
  return lookupId
    ? `Entity mention "${rawText}" references unknown entity id "${lookupId}".`
    : `Entity mention "${rawText}" does not resolve to any registered entity.`
}

function buildLocationMessage(rawText: string, lookupId: string | undefined): string {
  return lookupId
    ? `Location mention "${rawText}" references unknown location id "${lookupId}".`
    : `Location mention "${rawText}" does not resolve to any registered location.`
}

function buildPovIssue(args: {
  context: ContinuityContext
  chapterId: string
  sceneId?: string
  entityId: string
  label: string
}): ContinuityIssue {
  const entityExists = args.context.entitiesById.has(args.entityId)

  return {
    code: 'POV_UNREGISTERED',
    severity: 'error',
    message: `${args.label} uses POV entity "${args.entityId}" that is not registered in the POV registry.`,
    chapterId: args.chapterId,
    sceneId: args.sceneId,
    entityId: args.entityId,
    evidence: compactEvidence([
      `entityId:${args.entityId}`,
      entityExists ? 'entity exists in registry' : 'entity missing from entity registry',
    ]),
  }
}

function formatTimelinePoint(chapter: StoryChapter): string {
  const label = chapter.timeline?.label ?? `order:${chapter.timeline?.order ?? 'n/a'}`
  return `${chapter.title} [sequence:${chapter.sequence}, ${label}]`
}

function compactEvidence(values: ReadonlyArray<string | undefined>): string[] {
  return values.filter((value): value is string => Boolean(value))
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`)
}
