import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from 'react'
import './App.css'
import { createDemoDocument } from './demoDocument'
import {
  analyzeManuscript,
  buildContinuityContext,
  type ContinuityDocument,
  type ContinuityIssue,
  type ContinuityIssueCode,
  type IssueSeverity,
  type SceneFact,
  type StoryChapter,
  type StoryScene,
} from './lib'

const STORAGE_KEY = 'story-bible-qa/demo-document'

const severityLabels: Record<IssueSeverity, string> = {
  error: 'Error',
  warning: 'Warning',
  info: 'Info',
}

const severityRank: Record<IssueSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
}

const issueCodeLabels: Record<ContinuityIssueCode, string> = {
  ALIAS_CONFLICT: 'Alias conflict',
  UNKNOWN_ENTITY: 'Unknown entity',
  CHAPTER_TIMELINE_REVERSED: 'Timeline reversal',
  POV_UNREGISTERED: 'POV not registered',
  LOCATION_UNREGISTERED: 'Location not registered',
  LORE_RULE_HIT: 'Lore rule hit',
}

function App() {
  const [initialDocument] = useState<ContinuityDocument>(() =>
    loadInitialDocument(),
  )
  const [document, setDocument] = useState<ContinuityDocument>(initialDocument)
  const [selectedChapterId, setSelectedChapterId] = useState(
    initialDocument.chapters[0]?.id ?? '',
  )
  const [selectedSceneId, setSelectedSceneId] = useState(
    initialDocument.chapters[0]?.scenes[0]?.id ?? '',
  )
  const [severityFilter, setSeverityFilter] = useState<IssueSeverity | 'all'>(
    'all',
  )
  const [query, setQuery] = useState('')

  const deferredQuery = useDeferredValue(query)

  const persistDocument = useEffectEvent((nextDocument: ContinuityDocument) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDocument))
  })

  useEffect(() => {
    persistDocument(document)
  }, [document])

  const report = useMemo(() => analyzeManuscript(document), [document])
  const context = useMemo(() => buildContinuityContext(document), [document])
  const orderedChapters = useMemo(
    () =>
      document.chapters
        .slice()
        .sort((left, right) => left.sequence - right.sequence),
    [document],
  )
  const activeChapter =
    document.chapters.find((chapter) => chapter.id === selectedChapterId) ??
    orderedChapters[0]
  const activeScene =
    activeChapter?.scenes.find((scene) => scene.id === selectedSceneId) ??
    activeChapter?.scenes[0]
  const previousChapter = useMemo(() => {
    if (!activeChapter) {
      return undefined
    }

    const activeIndex = orderedChapters.findIndex(
      (chapter) => chapter.id === activeChapter.id,
    )

    return activeIndex > 0 ? orderedChapters[activeIndex - 1] : undefined
  }, [activeChapter, orderedChapters])

  const chapterIssueCount = useMemo(
    () =>
      report.issues.reduce<Record<string, number>>((counts, issue) => {
        if (issue.chapterId) {
          counts[issue.chapterId] = (counts[issue.chapterId] ?? 0) + 1
        }

        return counts
      }, {}),
    [report],
  )

  const chapterCriticalCount = useMemo(
    () =>
      report.issues.reduce<Record<string, number>>((counts, issue) => {
        if (issue.chapterId && issue.severity === 'error') {
          counts[issue.chapterId] = (counts[issue.chapterId] ?? 0) + 1
        }

        return counts
      }, {}),
    [report],
  )

  const filteredIssues = useMemo(
    () =>
      report.issues
        .filter((issue) => {
          if (severityFilter !== 'all' && issue.severity !== severityFilter) {
            return false
          }

          if (!deferredQuery.trim()) {
            return true
          }

          const haystack = [
            issueCodeLabels[issue.code],
            issue.message,
            ...(issue.evidence ?? []),
          ]
            .join(' ')
            .toLowerCase()

          return haystack.includes(deferredQuery.trim().toLowerCase())
        })
        .sort((left, right) => {
          const severityDiff =
            severityRank[left.severity] - severityRank[right.severity]

          if (severityDiff !== 0) {
            return severityDiff
          }

          return issueCodeLabels[left.code].localeCompare(
            issueCodeLabels[right.code],
          )
        }),
    [deferredQuery, report, severityFilter],
  )

  const activeIssues = useMemo(
    () =>
      activeChapter
        ? report.issues.filter((issue) => issue.chapterId === activeChapter.id)
        : [],
    [activeChapter, report],
  )
  const activeEntityMentions = useMemo(
    () =>
      activeScene
        ? (activeScene.entityMentions ?? []).map((mention) => ({
            mention,
            resolution: context.resolveEntityMention(mention),
          }))
        : [],
    [activeScene, context],
  )
  const activeLocationMentions = useMemo(
    () =>
      activeScene
        ? (activeScene.locationMentions ?? []).map((mention) => ({
            mention,
            resolution: context.resolveLocationMention(mention),
          }))
        : [],
    [activeScene, context],
  )

  const stats = useMemo(
    () => [
      {
        label: 'Open findings',
        value: report.issues.length.toString(),
        tone:
          report.stats.issuesByCode.LORE_RULE_HIT > 0 ||
          report.stats.issuesByCode.CHAPTER_TIMELINE_REVERSED > 0
            ? 'error'
            : report.issues.length > 0
              ? 'warning'
              : 'safe',
        detail: `${countSeverity(report.issues, 'error')} error / ${countSeverity(report.issues, 'warning')} warning`,
      },
      {
        label: 'Chapters at risk',
        value: `${Object.keys(chapterIssueCount).length}/${document.chapters.length}`,
        tone: Object.keys(chapterIssueCount).length > 0 ? 'warning' : 'safe',
        detail: 'Chapter-scoped audit coverage',
      },
      {
        label: 'Canon cards',
        value: `${document.entities.length + document.locations.length}`,
        tone: 'safe',
        detail: 'Characters + locations in the story bible',
      },
      {
        label: 'Rules active',
        value: `${report.rulesRun.length}`,
        tone: 'safe',
        detail: 'Built-in continuity checks running locally',
      },
    ],
    [chapterIssueCount, document, report],
  )

  const selectChapter = (chapterId: string, preferredSceneId?: string) => {
    const nextChapter =
      document.chapters.find((chapter) => chapter.id === chapterId) ??
      orderedChapters[0]

    if (!nextChapter) {
      return
    }

    const nextSceneId =
      preferredSceneId &&
      nextChapter.scenes.some((scene) => scene.id === preferredSceneId)
        ? preferredSceneId
        : nextChapter.scenes[0]?.id ?? ''

    startTransition(() => {
      setSelectedChapterId(nextChapter.id)
      setSelectedSceneId(nextSceneId)
    })
  }

  const selectScene = (sceneId: string) => {
    startTransition(() => {
      setSelectedSceneId(sceneId)
    })
  }

  const resetDemo = () => {
    const freshDocument = createDemoDocument()
    window.localStorage.removeItem(STORAGE_KEY)
    startTransition(() => {
      setDocument(freshDocument)
      setSelectedChapterId(freshDocument.chapters[0]?.id ?? '')
      setSelectedSceneId(freshDocument.chapters[0]?.scenes[0]?.id ?? '')
      setSeverityFilter('all')
      setQuery('')
    })
  }

  const exportDocument = () => {
    try {
      const blob = new Blob([JSON.stringify(document, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const anchor = window.document.createElement('a')
      anchor.href = url
      anchor.download = 'story-bible-qa-demo.json'
      anchor.style.display = 'none'
      window.document.body.append(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      console.error('Failed to export Story Bible QA document.', error)
    }
  }

  const focusFirstIssue = () => {
    const issue = report.issues.find((candidate) => candidate.chapterId)
    if (!issue?.chapterId) {
      return
    }

    selectChapter(issue.chapterId, issue.sceneId)
  }

  const updateChapter = (updater: (chapter: StoryChapter) => StoryChapter) => {
    if (!activeChapter) {
      return
    }

    setDocument((currentDocument) => ({
      ...currentDocument,
      chapters: currentDocument.chapters.map((chapter) =>
        chapter.id === activeChapter.id ? updater(chapter) : chapter,
      ),
    }))
  }

  const updateActiveScene = (updater: (scene: StoryScene) => StoryScene) => {
    if (!activeChapter || !activeScene) {
      return
    }

    updateChapter((chapter) => ({
      ...chapter,
      scenes: chapter.scenes.map((scene) =>
        scene.id === activeScene.id ? updater(scene) : scene,
      ),
    }))
  }

  return (
    <main className="app-shell">
      <section className="hero-panel panel">
        <div className="hero-copy">
          <div className="eyebrow">Open-source continuity QA for long-form fiction</div>
          <h1>Story Bible QA</h1>
          <p className="hero-text">
            A GitHub-ready prototype for the product niche that commercial fiction
            tools keep proving out: story-bible health, chapter preflight, and
            explainable continuity checks. This demo stays local, transparent, and
            versionable instead of pretending to be another all-purpose AI novelist.
          </p>

          <div className="hero-actions">
            <button type="button" className="primary-button" onClick={focusFirstIssue}>
              Jump to first issue
            </button>
            <button type="button" className="ghost-button" onClick={exportDocument}>
              Export JSON
            </button>
            <button type="button" className="ghost-button" onClick={resetDemo}>
              Reset demo
            </button>
          </div>

          <dl className="hero-meta">
            <div>
              <dt>Target user</dt>
              <dd>Novelists, editors, and fiction teams with long-form canon risk</dd>
            </div>
            <div>
              <dt>Commercial wedge</dt>
              <dd>Continuity preflight, not generic text generation</dd>
            </div>
            <div>
              <dt>Local proof point</dt>
              <dd>{report.stats.scenesChecked} scenes audited with a pure frontend engine</dd>
            </div>
          </dl>
        </div>

        <aside className="hero-aside">
          <div className="signal-card">
            <span className="signal-label">Why this project exists</span>
            <p>
              Open-source tools already cover drafting and outlining. The under-built
              layer is canonical QA: catching lore drift, POV mistakes, timeline
              reversals, and missing cards before edits get expensive.
            </p>
          </div>
          <div className="signal-card">
            <span className="signal-label">What this MVP proves</span>
            <ol>
              <li>Story bible data can be explicit and version-friendly.</li>
              <li>Core continuity checks can run without a backend.</li>
              <li>Explainable reports are a better open-source wedge than raw prose generation.</li>
            </ol>
          </div>
        </aside>
      </section>

      <section className="stats-grid">
        {stats.map((stat) => (
          <article key={stat.label} className={`panel stat-card ${stat.tone}`}>
            <span className="stat-label">{stat.label}</span>
            <strong>{stat.value}</strong>
            <p>{stat.detail}</p>
          </article>
        ))}
      </section>

      <section className="workspace-grid">
        <article className="panel canon-panel">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Canon shelf</span>
              <h2>Story bible cards</h2>
            </div>
            <span className="panel-count">
              {document.entities.length + document.locations.length} items
            </span>
          </div>

          <div className="canon-group">
            <div className="group-heading">
              <h3>Characters</h3>
              <span>{document.entities.length}</span>
            </div>
            <div className="card-stack">
              {document.entities.map((entity) => (
                <article key={entity.id} className="canon-card">
                  <div className="canon-card-topline">
                    <strong>{entity.name}</strong>
                    <span>{entity.id}</span>
                  </div>
                  <p>{stringMetadata(entity.metadata, 'role', 'No role recorded yet.')}</p>
                  <div className="chip-row">
                    {[entity.name, ...(entity.aliases ?? [])].map((value) => (
                      <span key={value} className="chip">
                        {value}
                      </span>
                    ))}
                  </div>
                  <p className="canon-note">
                    {stringMetadata(entity.metadata, 'canon', 'No canon notes yet.')}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div className="canon-group">
            <div className="group-heading">
              <h3>Locations</h3>
              <span>{document.locations.length}</span>
            </div>
            <div className="card-stack">
              {document.locations.map((location) => (
                <article key={location.id} className="canon-card">
                  <div className="canon-card-topline">
                    <strong>{location.name}</strong>
                    <span>{location.id}</span>
                  </div>
                  <div className="chip-row">
                    {[location.name, ...(location.aliases ?? [])].map((value) => (
                      <span key={value} className="chip">
                        {value}
                      </span>
                    ))}
                  </div>
                  <p className="canon-note">
                    {stringMetadata(location.metadata, 'canon', 'No canon notes yet.')}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div className="canon-group">
            <div className="group-heading">
              <h3>Lore rules</h3>
              <span>{document.loreRules?.length ?? 0}</span>
            </div>
            <div className="rule-list">
              {(document.loreRules ?? []).map((rule) => (
                <article key={rule.id} className="rule-card">
                  <div className="canon-card-topline">
                    <strong>{rule.name}</strong>
                    <span className={`severity-badge ${rule.severity ?? 'warning'}`}>
                      {severityLabels[rule.severity ?? 'warning']}
                    </span>
                  </div>
                  <p>{rule.message}</p>
                  <p className="canon-note">Rule id: {rule.id}</p>
                </article>
              ))}
            </div>
          </div>
        </article>

        <article className="panel chapter-panel">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Chapter ledger</span>
              <h2>Audit timeline</h2>
            </div>
            <span className="panel-count">{document.chapters.length} chapters</span>
          </div>

          <div className="chapter-list">
            {orderedChapters.map((chapter) => {
                const count = chapterIssueCount[chapter.id] ?? 0
                const tone =
                  (chapterCriticalCount[chapter.id] ?? 0) > 0
                    ? 'error'
                    : count > 0
                      ? 'warning'
                      : 'safe'

                return (
                  <button
                    type="button"
                    key={chapter.id}
                    className={`chapter-card ${
                      chapter.id === activeChapter?.id ? 'active' : ''
                    }`}
                    onClick={() => selectChapter(chapter.id)}
                  >
                    <div className="chapter-card-topline">
                      <span className="chapter-order">
                        Ch {chapter.number ?? chapter.sequence}
                      </span>
                      <span className={`severity-dot ${tone}`}>
                        {count} issues
                      </span>
                    </div>
                    <strong>{chapter.title}</strong>
                    <p>{stringMetadata(chapter.metadata, 'summary', 'No chapter summary yet.')}</p>
                    <dl className="chapter-meta">
                      <div>
                        <dt>Timeline</dt>
                        <dd>{chapter.timeline?.label ?? 'Untracked'}</dd>
                      </div>
                      <div>
                        <dt>POV</dt>
                        <dd>{chapter.povEntityId ?? 'None'}</dd>
                      </div>
                      <div>
                        <dt>Scene</dt>
                        <dd>{chapter.scenes[0]?.title ?? 'Untitled'}</dd>
                      </div>
                    </dl>
                  </button>
                )
              })}
          </div>
        </article>

        <article className="panel report-panel">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Audit console</span>
              <h2>Findings with evidence</h2>
            </div>
            <span className="panel-count">{filteredIssues.length} shown</span>
          </div>

          <div className="filters">
            {(['all', 'error', 'warning', 'info'] as const).map((value) => (
              <button
                type="button"
                key={value}
                className={`filter-chip ${severityFilter === value ? 'active' : ''}`}
                onClick={() => setSeverityFilter(value)}
              >
                {value === 'all' ? 'All severities' : severityLabels[value]}
              </button>
            ))}

            <label className="search-box">
              <span className="sr-only">Search issues</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search issue codes, messages, or evidence"
              />
            </label>
          </div>

          <div className="issue-list">
            {filteredIssues.map((issue, index) => (
              <IssueCard
                key={`${getIssueRenderKey(issue)}::${index}`}
                issue={issue}
                onFocusChapter={selectChapter}
              />
            ))}

            {filteredIssues.length === 0 ? (
              <div className="empty-state">
                <strong>No findings match the current filters.</strong>
                <p>Try another severity filter or clear the search box.</p>
              </div>
            ) : null}
          </div>
        </article>
      </section>

      {activeChapter && activeScene ? (
        <section className="editor-grid">
          <article className="panel editor-panel">
            <div className="panel-header">
              <div>
                <span className="section-kicker">Selected chapter</span>
                <h2>Edit the failing scene</h2>
              </div>
              <span className="panel-count">{activeIssues.length} chapter issues</span>
            </div>

            {activeChapter.scenes.length > 1 ? (
              <div className="scene-tabs">
                {activeChapter.scenes
                  .slice()
                  .sort((left, right) => left.sequence - right.sequence)
                  .map((scene) => (
                    <button
                      type="button"
                      key={scene.id}
                      className={`scene-tab ${
                        scene.id === activeScene.id ? 'active' : ''
                      }`}
                      onClick={() => selectScene(scene.id)}
                    >
                      {scene.title ?? scene.id}
                    </button>
                  ))}
              </div>
            ) : null}

            <div className="editor-fields">
              <label>
                <span>Chapter title</span>
                <input
                  type="text"
                  value={activeChapter.title}
                  onChange={(event) =>
                    updateChapter((chapter) => ({
                      ...chapter,
                      title: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>Timeline order</span>
                <input
                  type="number"
                  value={activeChapter.timeline?.order ?? activeChapter.sequence}
                  onChange={(event) =>
                    updateChapter((chapter) => ({
                      ...chapter,
                      timeline: {
                        ...(chapter.timeline ?? {
                          timelineId: 'main',
                          label: `Day ${chapter.sequence}`,
                          order: chapter.sequence,
                        }),
                        order: Number(event.target.value) || 0,
                      },
                    }))
                  }
                />
              </label>

              <label>
                <span>POV entity id</span>
                <input
                  type="text"
                  list="entity-id-options"
                  value={activeChapter.povEntityId ?? ''}
                  onChange={(event) =>
                    updateChapter((chapter) => ({
                      ...chapter,
                      povEntityId: event.target.value.trim() || undefined,
                    }))
                  }
                />
              </label>

              <label>
                <span>Scene location id</span>
                <input
                  type="text"
                  list="location-id-options"
                  value={activeScene.locationId ?? ''}
                  onChange={(event) =>
                    updateActiveScene((scene) => ({
                      ...scene,
                      locationId: event.target.value.trim() || undefined,
                    }))
                  }
                />
              </label>
            </div>

            <label className="editor-block">
              <span>Chapter summary</span>
              <textarea
                rows={3}
                value={stringMetadata(activeChapter.metadata, 'summary', '')}
                onChange={(event) =>
                  updateChapter((chapter) => ({
                    ...chapter,
                    metadata: {
                      ...(chapter.metadata ?? {}),
                      summary: event.target.value,
                    },
                  }))
                }
              />
            </label>

            <label className="editor-block">
              <span>Scene excerpt</span>
              <textarea
                rows={5}
                value={stringMetadata(activeScene.metadata, 'excerpt', '')}
                onChange={(event) =>
                  updateActiveScene((scene) => ({
                    ...scene,
                    metadata: {
                      ...(scene.metadata ?? {}),
                      excerpt: event.target.value,
                    },
                  }))
                }
              />
            </label>

            <div className="editor-fields mentions-grid">
              <label>
                <span>Entity mentions</span>
                <textarea
                  rows={4}
                  value={serializeEntityMentions(activeScene)}
                  onChange={(event) =>
                    updateActiveScene((scene) => ({
                      ...scene,
                      entityMentions: parseEntityMentions(event.target.value),
                    }))
                  }
                />
              </label>

              <label>
                <span>Location mentions</span>
                <textarea
                  rows={4}
                  value={serializeLocationMentions(activeScene)}
                  onChange={(event) =>
                    updateActiveScene((scene) => ({
                      ...scene,
                      locationMentions: parseLocationMentions(event.target.value),
                    }))
                  }
                />
              </label>

              <label>
                <span>Scene tags (`key=value`)</span>
                <textarea
                  rows={4}
                  value={serializeSceneTags(activeScene)}
                  onChange={(event) =>
                    updateActiveScene((scene) => ({
                      ...scene,
                      facts: replaceSceneTagFacts(scene.facts ?? [], event.target.value),
                    }))
                  }
                />
              </label>
            </div>

            <datalist id="entity-id-options">
              {document.entities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                </option>
              ))}
            </datalist>
            <datalist id="location-id-options">
              {document.locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </datalist>
          </article>

          <article className="panel context-panel">
            <div className="panel-header">
              <div>
                <span className="section-kicker">Scene context</span>
                <h2>What the engine sees</h2>
              </div>
              <span className="panel-count">{activeScene.id}</span>
            </div>

            <div className="context-section">
              <h3>Resolved entity mentions</h3>
              {activeEntityMentions.length ? (
                <div className="chip-row">
                  {activeEntityMentions.map(({ mention, resolution }) => (
                    <span
                      key={`${mention.rawText}-${resolution.status}`}
                      className={`chip ${
                        resolution.status === 'resolved' ? '' : 'warning'
                      }`}
                    >
                      {mention.rawText}
                      {resolution.status === 'resolved'
                        ? ` -> ${resolution.value.name}`
                        : ' -> unresolved'}
                    </span>
                  ))}
                </div>
              ) : (
                <p>No entity mentions in the selected scene.</p>
              )}
            </div>

            <div className="context-section">
              <h3>Resolved location mentions</h3>
              {activeLocationMentions.length ? (
                <div className="chip-row">
                  {activeLocationMentions.map(({ mention, resolution }) => (
                    <span
                      key={`${mention.rawText}-${resolution.status}`}
                      className={`chip ${
                        resolution.status === 'resolved' ? '' : 'warning'
                      }`}
                    >
                      {mention.rawText}
                      {resolution.status === 'resolved'
                        ? ` -> ${resolution.value.name}`
                        : ' -> unresolved'}
                    </span>
                  ))}
                </div>
              ) : (
                <p>No location mentions in the selected scene.</p>
              )}
            </div>

            <div className="context-section">
              <h3>Previous chapter beat</h3>
              {previousChapter ? (
                <>
                  <strong>{previousChapter.title}</strong>
                  <p>{stringMetadata(previousChapter.metadata, 'summary', 'No summary yet.')}</p>
                </>
              ) : (
                <p>This is the first chapter in the current sequence.</p>
              )}
            </div>

            <div className="context-section">
              <h3>Issue code mix</h3>
              <div className="code-grid">
                {Object.entries(report.stats.issuesByCode).map(([code, count]) => (
                  <div key={code} className="code-card">
                    <strong>{count}</strong>
                    <span>{issueCodeLabels[code as ContinuityIssueCode]}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="context-section">
              <h3>Why this is commercially interesting</h3>
              <p>
                This UI demonstrates an open-source layer that is useful on its own:
                structured canon, explainable checks, and chapter-scoped reports. A
                paid layer later could add hosted collaboration, advanced context
                packs, and heavier LLM-based repair suggestions.
              </p>
            </div>
          </article>
        </section>
      ) : null}
    </main>
  )
}

interface IssueCardProps {
  issue: ContinuityIssue
  onFocusChapter: (chapterId: string, sceneId?: string) => void
}

function IssueCard({ issue, onFocusChapter }: IssueCardProps) {
  return (
    <article className={`issue-card ${issue.severity}`}>
      <div className="issue-topline">
        <span className={`severity-badge ${issue.severity}`}>
          {severityLabels[issue.severity]}
        </span>
        {issue.chapterId ? (
          <button
            type="button"
            className="chapter-link"
            onClick={() => onFocusChapter(issue.chapterId!, issue.sceneId)}
          >
            {issue.chapterId}
          </button>
        ) : (
          <span className="issue-scope">Project-wide</span>
        )}
      </div>
      <h3>{issueCodeLabels[issue.code]}</h3>
      <p>{issue.message}</p>
      {issue.evidence?.length ? (
        <ul className="evidence-list">
          {issue.evidence.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      ) : null}
    </article>
  )
}

function countSeverity(
  issues: readonly ContinuityIssue[],
  severity: IssueSeverity,
): number {
  return issues.filter((issue) => issue.severity === severity).length
}

function stringMetadata(
  metadata: StoryChapter['metadata'] | StoryScene['metadata'] | undefined,
  key: string,
  fallback: string,
): string {
  const value = metadata?.[key]
  return typeof value === 'string' ? value : fallback
}

function serializeEntityMentions(scene: StoryScene): string {
  return (scene.entityMentions ?? []).map((mention) => mention.rawText).join(', ')
}

function parseEntityMentions(value: string): StoryScene['entityMentions'] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((rawText) => ({ rawText }))
}

function serializeLocationMentions(scene: StoryScene): string {
  return (scene.locationMentions ?? []).map((mention) => mention.rawText).join(', ')
}

function parseLocationMentions(value: string): StoryScene['locationMentions'] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((rawText) => ({ rawText }))
}

function serializeSceneTags(scene: StoryScene): string {
  return (scene.facts ?? [])
    .filter((fact): fact is Extract<SceneFact, { type: 'scene-tag' }> => fact.type === 'scene-tag')
    .map((fact) => `${fact.key}=${String(fact.value)}`)
    .join(', ')
}

function replaceSceneTagFacts(
  facts: readonly SceneFact[],
  rawValue: string,
): readonly SceneFact[] {
  const otherFacts = facts.filter((fact) => fact.type !== 'scene-tag')
  const sceneTags = rawValue
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((entry) => {
      const [key, rawFactValue] = entry.split('=')
      return {
        type: 'scene-tag' as const,
        key: (key ?? '').trim(),
        value: parseScalarValue(rawFactValue?.trim() ?? ''),
      }
    })
    .filter((fact) => fact.key.length > 0)

  return [...otherFacts, ...sceneTags]
}

function parseScalarValue(value: string): string | number | boolean {
  if (value === 'true') {
    return true
  }

  if (value === 'false') {
    return false
  }

  const asNumber = Number(value)
  if (!Number.isNaN(asNumber) && value !== '') {
    return asNumber
  }

  return value
}

function looksLikeContinuityDocument(
  value: unknown,
): value is ContinuityDocument {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<ContinuityDocument>
  return (
    Array.isArray(candidate.entities) &&
    candidate.entities.every(isStoryEntity) &&
    Array.isArray(candidate.locations) &&
    candidate.locations.every(isStoryLocation) &&
    Array.isArray(candidate.povs) &&
    candidate.povs.every(isPovRegistryEntry) &&
    (candidate.loreRules === undefined ||
      (Array.isArray(candidate.loreRules) &&
        candidate.loreRules.every(isLoreRule))) &&
    Array.isArray(candidate.chapters) &&
    candidate.chapters.every(isStoryChapter)
  )
}

function loadInitialDocument(): ContinuityDocument {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (!saved) {
      return createDemoDocument()
    }

    const parsed = JSON.parse(saved)
    if (!looksLikeContinuityDocument(parsed) || parsed.chapters.length === 0) {
      console.warn('Discarding invalid Story Bible QA local data and restoring demo.')
      window.localStorage.removeItem(STORAGE_KEY)
      return createDemoDocument()
    }

    return parsed
  } catch (error) {
    console.warn('Failed to read Story Bible QA local data. Restoring demo.', error)
    window.localStorage.removeItem(STORAGE_KEY)
    return createDemoDocument()
  }
}

function getIssueRenderKey(issue: ContinuityIssue): string {
  return [
    issue.code,
    issue.chapterId ?? 'project',
    issue.sceneId ?? 'all',
    issue.entityId ?? 'no-entity',
    issue.locationId ?? 'no-location',
    issue.ruleId ?? 'no-rule',
    issue.aliasKey ?? 'no-alias',
    issue.message,
    (issue.evidence ?? []).join('|'),
  ].join('::')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isMetadataValue(value: unknown): value is string | number | boolean {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
}

function isMetadataRecord(
  value: unknown,
): value is Record<string, string | number | boolean> {
  return (
    value === undefined ||
    (isRecord(value) && Object.values(value).every(isMetadataValue))
  )
}

function isStringArray(value: unknown): value is readonly string[] {
  return value === undefined || (Array.isArray(value) && value.every((item) => typeof item === 'string'))
}

function isStoryEntity(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.kind === 'string' &&
    isStringArray(value.aliases) &&
    isStringArray(value.tags) &&
    isMetadataRecord(value.metadata)
  )
}

function isStoryLocation(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    (value.regionId === undefined || typeof value.regionId === 'string') &&
    isStringArray(value.aliases) &&
    isStringArray(value.tags) &&
    isMetadataRecord(value.metadata)
  )
}

function isPovRegistryEntry(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.entityId === 'string' &&
    (value.label === undefined || typeof value.label === 'string')
  )
}

function isStoryEntityMention(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.rawText === 'string' &&
    (value.entityId === undefined || typeof value.entityId === 'string') &&
    (value.role === undefined ||
      value.role === 'primary' ||
      value.role === 'secondary' ||
      value.role === 'mention')
  )
}

function isStoryLocationMention(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.rawText === 'string' &&
    (value.locationId === undefined || typeof value.locationId === 'string')
  )
}

function isFactValue(value: unknown): value is string | number | boolean {
  return isMetadataValue(value)
}

function isSceneFact(value: unknown): boolean {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return false
  }

  switch (value.type) {
    case 'entity-trait':
      return (
        typeof value.entityId === 'string' &&
        typeof value.trait === 'string' &&
        isFactValue(value.value)
      )
    case 'location-trait':
      return (
        typeof value.locationId === 'string' &&
        typeof value.trait === 'string' &&
        isFactValue(value.value)
      )
    case 'relationship':
      return (
        typeof value.sourceEntityId === 'string' &&
        typeof value.relation === 'string' &&
        typeof value.targetEntityId === 'string' &&
        (value.value === undefined || isFactValue(value.value))
      )
    case 'scene-tag':
      return typeof value.key === 'string' && isFactValue(value.value)
    default:
      return false
  }
}

function isFactPattern(value: unknown): boolean {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return false
  }

  const equalsValid = value.equals === undefined || isFactValue(value.equals)
  const oneOfValid =
    value.oneOf === undefined ||
    (Array.isArray(value.oneOf) && value.oneOf.every(isFactValue))

  if (!equalsValid || !oneOfValid) {
    return false
  }

  switch (value.type) {
    case 'entity-trait':
      return (
        (value.entityId === undefined || typeof value.entityId === 'string') &&
        typeof value.trait === 'string'
      )
    case 'location-trait':
      return (
        (value.locationId === undefined || typeof value.locationId === 'string') &&
        typeof value.trait === 'string'
      )
    case 'relationship':
      return (
        (value.sourceEntityId === undefined ||
          typeof value.sourceEntityId === 'string') &&
        typeof value.relation === 'string' &&
        (value.targetEntityId === undefined ||
          typeof value.targetEntityId === 'string')
      )
    case 'scene-tag':
      return typeof value.key === 'string'
    default:
      return false
  }
}

function isLoreRule(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.message === 'string' &&
    (value.scope === undefined ||
      value.scope === 'scene' ||
      value.scope === 'chapter') &&
    (value.severity === undefined ||
      value.severity === 'error' ||
      value.severity === 'warning' ||
      value.severity === 'info') &&
    (value.when === undefined ||
      (Array.isArray(value.when) && value.when.every(isFactPattern))) &&
    (value.require === undefined ||
      (Array.isArray(value.require) && value.require.every(isFactPattern))) &&
    (value.forbid === undefined ||
      (Array.isArray(value.forbid) && value.forbid.every(isFactPattern)))
  )
}

function isTimelineRef(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.order === 'number' &&
    (value.timelineId === undefined || typeof value.timelineId === 'string') &&
    (value.label === undefined || typeof value.label === 'string') &&
    (value.allowOutOfOrder === undefined || typeof value.allowOutOfOrder === 'boolean')
  )
}

function isStoryScene(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.sequence === 'number' &&
    (value.title === undefined || typeof value.title === 'string') &&
    (value.povEntityId === undefined || typeof value.povEntityId === 'string') &&
    (value.locationId === undefined || typeof value.locationId === 'string') &&
    (value.entityMentions === undefined ||
      (Array.isArray(value.entityMentions) &&
        value.entityMentions.every(isStoryEntityMention))) &&
    (value.locationMentions === undefined ||
      (Array.isArray(value.locationMentions) &&
        value.locationMentions.every(isStoryLocationMention))) &&
    (value.facts === undefined ||
      (Array.isArray(value.facts) && value.facts.every(isSceneFact))) &&
    isMetadataRecord(value.metadata)
  )
}

function isStoryChapter(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.sequence === 'number' &&
    (value.number === undefined || typeof value.number === 'number') &&
    typeof value.title === 'string' &&
    (value.timeline === undefined || isTimelineRef(value.timeline)) &&
    (value.povEntityId === undefined || typeof value.povEntityId === 'string') &&
    Array.isArray(value.scenes) &&
    value.scenes.every(isStoryScene) &&
    (value.facts === undefined ||
      (Array.isArray(value.facts) && value.facts.every(isSceneFact))) &&
    isMetadataRecord(value.metadata)
  )
}

export default App
