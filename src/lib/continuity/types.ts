export type MetadataValue = string | number | boolean
export type IssueDataValue = MetadataValue | readonly MetadataValue[]
export type TextNormalizer = (value: string) => string

export type EntityKind =
  | 'character'
  | 'organization'
  | 'artifact'
  | 'creature'
  | 'concept'
  | 'other'

export type IssueSeverity = 'error' | 'warning' | 'info'
export type AliasNamespace = 'entity' | 'location'
export type ResolutionSource = 'id' | 'name' | 'alias'
export type LoreRuleScope = 'scene' | 'chapter'

export type StoryEntity = {
  id: string
  name: string
  kind: EntityKind
  aliases?: readonly string[]
  tags?: readonly string[]
  metadata?: Record<string, MetadataValue>
}

export type StoryLocation = {
  id: string
  name: string
  aliases?: readonly string[]
  regionId?: string
  tags?: readonly string[]
  metadata?: Record<string, MetadataValue>
}

export type PovRegistryEntry = {
  id: string
  entityId: string
  label?: string
}

export type TimelineRef = {
  timelineId?: string
  order: number
  label?: string
  allowOutOfOrder?: boolean
}

export type StoryEntityMention = {
  rawText: string
  entityId?: string
  role?: 'primary' | 'secondary' | 'mention'
}

export type StoryLocationMention = {
  rawText: string
  locationId?: string
}

export type FactValue = string | number | boolean

export type SceneFact =
  | {
      type: 'entity-trait'
      entityId: string
      trait: string
      value: FactValue
    }
  | {
      type: 'location-trait'
      locationId: string
      trait: string
      value: FactValue
    }
  | {
      type: 'relationship'
      sourceEntityId: string
      relation: string
      targetEntityId: string
      value?: FactValue
    }
  | {
      type: 'scene-tag'
      key: string
      value: FactValue
    }

export type FactPattern =
  | {
      type: 'entity-trait'
      entityId?: string
      trait: string
      equals?: FactValue
      oneOf?: readonly FactValue[]
    }
  | {
      type: 'location-trait'
      locationId?: string
      trait: string
      equals?: FactValue
      oneOf?: readonly FactValue[]
    }
  | {
      type: 'relationship'
      sourceEntityId?: string
      relation: string
      targetEntityId?: string
      equals?: FactValue
      oneOf?: readonly FactValue[]
    }
  | {
      type: 'scene-tag'
      key: string
      equals?: FactValue
      oneOf?: readonly FactValue[]
    }

export type LoreRule = {
  id: string
  name: string
  scope?: LoreRuleScope
  severity?: IssueSeverity
  when?: readonly FactPattern[]
  require?: readonly FactPattern[]
  forbid?: readonly FactPattern[]
  message: string
}

export type StoryScene = {
  id: string
  sequence: number
  title?: string
  povEntityId?: string
  locationId?: string
  entityMentions?: readonly StoryEntityMention[]
  locationMentions?: readonly StoryLocationMention[]
  facts?: readonly SceneFact[]
  metadata?: Record<string, MetadataValue>
}

export type StoryChapter = {
  id: string
  sequence: number
  number?: number
  title: string
  timeline?: TimelineRef
  povEntityId?: string
  scenes: readonly StoryScene[]
  facts?: readonly SceneFact[]
  metadata?: Record<string, MetadataValue>
}

export type ContinuityDocument = {
  entities: readonly StoryEntity[]
  locations: readonly StoryLocation[]
  povs: readonly PovRegistryEntry[]
  loreRules?: readonly LoreRule[]
  chapters: readonly StoryChapter[]
}

export type AliasTarget = {
  namespace: AliasNamespace
  id: string
  canonicalName: string
  source: 'name' | 'alias'
}

export type NamedResolution<T> =
  | {
      status: 'resolved'
      value: T
      via: ResolutionSource
      rawText?: string
      lookupId?: string
    }
  | {
      status: 'ambiguous'
      rawText: string
      candidates: readonly AliasTarget[]
    }
  | {
      status: 'missing'
      rawText?: string
      lookupId?: string
    }

export type ContinuityIssueCode =
  | 'UNKNOWN_ENTITY'
  | 'ALIAS_CONFLICT'
  | 'CHAPTER_TIMELINE_REVERSED'
  | 'POV_UNREGISTERED'
  | 'LOCATION_UNREGISTERED'
  | 'LORE_RULE_HIT'

export type ContinuityIssue = {
  code: ContinuityIssueCode
  severity: IssueSeverity
  message: string
  chapterId?: string
  sceneId?: string
  entityId?: string
  locationId?: string
  ruleId?: string
  aliasKey?: string
  evidence?: readonly string[]
  data?: Record<string, IssueDataValue>
}

export type ContinuityStats = {
  chaptersChecked: number
  scenesChecked: number
  issuesByCode: Record<ContinuityIssueCode, number>
}

export type ContinuityReport = {
  issues: readonly ContinuityIssue[]
  stats: ContinuityStats
  rulesRun: readonly string[]
}

export type ContinuityContext = {
  document: ContinuityDocument
  normalizeText: TextNormalizer
  entitiesById: ReadonlyMap<string, StoryEntity>
  locationsById: ReadonlyMap<string, StoryLocation>
  povEntityIds: ReadonlySet<string>
  entityAliases: ReadonlyMap<string, readonly AliasTarget[]>
  locationAliases: ReadonlyMap<string, readonly AliasTarget[]>
  aliasTargets: ReadonlyMap<string, readonly AliasTarget[]>
  resolveEntityMention: (mention: StoryEntityMention) => NamedResolution<StoryEntity>
  resolveLocationMention: (
    mention: StoryLocationMention,
  ) => NamedResolution<StoryLocation>
  getChapterFacts: (chapter: StoryChapter) => readonly SceneFact[]
  getSceneFacts: (chapter: StoryChapter, scene: StoryScene) => readonly SceneFact[]
}

export type ContinuityRule = {
  id: string
  description: string
  run: (context: ContinuityContext) => ContinuityIssue[]
}

export type ContinuityEngineConfig = {
  includeDefaultRules?: boolean
  normalizeText?: TextNormalizer
  rules?: readonly ContinuityRule[]
}

export type ContinuityEngine = {
  rules: readonly ContinuityRule[]
  analyze: (document: ContinuityDocument) => ContinuityReport
}
