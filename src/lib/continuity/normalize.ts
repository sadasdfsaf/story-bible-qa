import type { AliasNamespace, AliasTarget, TextNormalizer } from './types'

type NamedRegistryRecord = {
  id: string
  name: string
  aliases?: readonly string[]
}

const MULTIPLE_SPACES = /\s+/g

export const defaultTextNormalizer: TextNormalizer = (value) =>
  value.trim().toLocaleLowerCase().replace(MULTIPLE_SPACES, ' ')

export function buildAliasIndex<T extends NamedRegistryRecord>(
  records: readonly T[],
  namespace: AliasNamespace,
  normalizeText: TextNormalizer = defaultTextNormalizer,
): Map<string, AliasTarget[]> {
  const index = new Map<string, AliasTarget[]>()

  for (const record of records) {
    addAlias(index, record.name, namespace, record.id, record.name, 'name', normalizeText)

    for (const alias of record.aliases ?? []) {
      addAlias(
        index,
        alias,
        namespace,
        record.id,
        record.name,
        'alias',
        normalizeText,
      )
    }
  }

  return index
}

export function mergeAliasIndexes(
  ...indexes: ReadonlyArray<ReadonlyMap<string, readonly AliasTarget[]>>
): Map<string, AliasTarget[]> {
  const merged = new Map<string, AliasTarget[]>()

  for (const index of indexes) {
    for (const [key, targets] of index.entries()) {
      const bucket = merged.get(key) ?? []

      for (const target of targets) {
        if (
          !bucket.some(
            (candidate) =>
              candidate.namespace === target.namespace && candidate.id === target.id,
          )
        ) {
          bucket.push(target)
        }
      }

      merged.set(key, bucket)
    }
  }

  return merged
}

function addAlias(
  index: Map<string, AliasTarget[]>,
  value: string,
  namespace: AliasNamespace,
  id: string,
  canonicalName: string,
  source: AliasTarget['source'],
  normalizeText: TextNormalizer,
): void {
  const key = normalizeText(value)

  if (!key) {
    return
  }

  const bucket = index.get(key) ?? []

  if (!bucket.some((target) => target.namespace === namespace && target.id === id)) {
    bucket.push({ namespace, id, canonicalName, source })
  }

  index.set(key, bucket)
}
