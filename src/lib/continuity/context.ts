import { buildAliasIndex, defaultTextNormalizer, mergeAliasIndexes } from './normalize'
import type {
  AliasTarget,
  ContinuityContext,
  ContinuityDocument,
  ContinuityEngineConfig,
  NamedResolution,
  SceneFact,
  StoryEntity,
  StoryEntityMention,
  StoryLocation,
  StoryLocationMention,
} from './types'

const EMPTY_FACTS: readonly SceneFact[] = []

export function buildContinuityContext(
  document: ContinuityDocument,
  config: Pick<ContinuityEngineConfig, 'normalizeText'> = {},
): ContinuityContext {
  const normalizeText = config.normalizeText ?? defaultTextNormalizer
  const entitiesById = new Map(document.entities.map((entity) => [entity.id, entity]))
  const locationsById = new Map(
    document.locations.map((location) => [location.id, location]),
  )
  const povEntityIds = new Set(document.povs.map((entry) => entry.entityId))
  const entityAliases = buildAliasIndex(document.entities, 'entity', normalizeText)
  const locationAliases = buildAliasIndex(document.locations, 'location', normalizeText)
  const aliasTargets = mergeAliasIndexes(entityAliases, locationAliases)

  const context: ContinuityContext = {
    document,
    normalizeText,
    entitiesById,
    locationsById,
    povEntityIds,
    entityAliases,
    locationAliases,
    aliasTargets,
    resolveEntityMention: (mention) =>
      resolveMention(mention, entitiesById, entityAliases, normalizeText),
    resolveLocationMention: (mention) =>
      resolveMention(mention, locationsById, locationAliases, normalizeText),
    getChapterFacts: (chapter) => chapter.facts ?? EMPTY_FACTS,
    getSceneFacts: (chapter, scene) => {
      const chapterFacts = chapter.facts ?? EMPTY_FACTS
      const sceneFacts = scene.facts ?? EMPTY_FACTS

      return chapterFacts.length === 0
        ? sceneFacts
        : chapterFacts.concat(sceneFacts)
    },
  }

  return context
}

function resolveMention<T extends StoryEntity | StoryLocation>(
  mention: StoryEntityMention | StoryLocationMention,
  registry: ReadonlyMap<string, T>,
  aliasIndex: ReadonlyMap<string, readonly AliasTarget[]>,
  normalizeText: (value: string) => string,
): NamedResolution<T> {
  const lookupId =
    'entityId' in mention
      ? mention.entityId
      : 'locationId' in mention
        ? mention.locationId
        : undefined

  if (lookupId) {
    const directMatch = registry.get(lookupId)

    if (directMatch) {
      return {
        status: 'resolved',
        value: directMatch,
        via: 'id',
        rawText: mention.rawText,
        lookupId,
      }
    }

    return {
      status: 'missing',
      rawText: mention.rawText,
      lookupId,
    }
  }

  const key = normalizeText(mention.rawText)

  if (!key) {
    return {
      status: 'missing',
      rawText: mention.rawText,
    }
  }

  const candidates = aliasIndex.get(key) ?? []

  if (candidates.length === 1) {
    const candidate = candidates[0]
    const value = registry.get(candidate.id)

    if (value) {
      return {
        status: 'resolved',
        value,
        via: candidate.source,
        rawText: mention.rawText,
      }
    }
  }

  if (candidates.length > 1) {
    return {
      status: 'ambiguous',
      rawText: mention.rawText,
      candidates,
    }
  }

  return {
    status: 'missing',
    rawText: mention.rawText,
  }
}
