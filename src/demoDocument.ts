import type { ContinuityDocument } from './lib'

const baseDemoDocument: ContinuityDocument = {
  entities: [
    {
      id: 'mara-voss',
      name: 'Mara Voss',
      kind: 'character',
      aliases: ['Captain Voss', 'Mara'],
      tags: ['protagonist', 'smuggler'],
      metadata: {
        role: 'Smuggler captain turned reluctant protector',
        canon:
          'Missing left ring finger; owns the Nightwake; never lies about a route twice.',
      },
    },
    {
      id: 'sister-elia',
      name: 'Sister Elia',
      kind: 'character',
      aliases: ['Elia'],
      tags: ['archivist', 'abbey'],
      metadata: {
        role: 'Abbey archivist and canon keeper',
        canon: 'Recites the mirror rites from memory.',
      },
    },
    {
      id: 'ilen-marr',
      name: 'Ilen Marr',
      kind: 'character',
      aliases: ['Ilen'],
      tags: ['informant'],
      metadata: {
        role: 'Dock surveyor and part-time spy',
        canon: 'Wears a copper ear cuff and cannot swim after the furnace collapse.',
      },
    },
    {
      id: 'the-ferryman',
      name: 'The Ferryman',
      kind: 'character',
      aliases: ['Ferryman'],
      tags: ['legend'],
      metadata: {
        role: 'Folkloric guide between mirror passages',
        canon: 'Supposed to appear only at dusk.',
      },
    },
  ],
  locations: [
    {
      id: 'glass-harbor',
      name: 'Glass Harbor',
      aliases: ['Harbor'],
      metadata: {
        canon:
          'A storm-bent trade city lit by candles and mirror salt, not electricity.',
      },
    },
    {
      id: 'candle-district',
      name: 'Candle District',
      aliases: ['Abbey Quarter'],
      metadata: {
        canon: 'All public records are copied by hand in the abbey quarter.',
      },
    },
    {
      id: 'salt-vault',
      name: 'Salt Vault',
      aliases: ['Vault'],
      metadata: {
        canon: 'Smugglers use pulley lifts instead of powered machinery.',
      },
    },
    {
      id: 'mirror-vault',
      name: 'Mirror Vault',
      aliases: ['Vault'],
      metadata: {
        canon: 'An abandoned mirror chamber under the quay.',
      },
    },
  ],
  povs: [
    { id: 'pov-mara', entityId: 'mara-voss', label: 'Mara POV' },
    { id: 'pov-elia', entityId: 'sister-elia', label: 'Elia POV' },
    { id: 'pov-ilen', entityId: 'ilen-marr', label: 'Ilen POV' },
  ],
  loreRules: [
    {
      id: 'no-electricity',
      name: 'No electricity in Glass Harbor',
      severity: 'error',
      scope: 'scene',
      forbid: [{ type: 'scene-tag', key: 'technology', equals: 'electricity' }],
      message:
        'Glass Harbor is candle-lit. Electric infrastructure breaks the current canon.',
    },
    {
      id: 'mirror-at-dusk',
      name: 'Tide mirrors open only at dusk',
      severity: 'warning',
      scope: 'scene',
      forbid: [
        { type: 'scene-tag', key: 'mirror-window', equals: 'noon' },
        { type: 'scene-tag', key: 'mirror-window', equals: 'sunrise' },
      ],
      message:
        'Mirror crossings should happen at dusk unless a chapter explicitly establishes an exception.',
    },
  ],
  chapters: [
    {
      id: 'ch-1',
      sequence: 1,
      number: 1,
      title: 'Ash at Low Tide',
      timeline: {
        timelineId: 'main',
        order: 1,
        label: 'Day 1',
      },
      povEntityId: 'mara-voss',
      metadata: {
        summary:
          'Mara returns to the harbor and learns that the abbey ledger has vanished.',
      },
      scenes: [
        {
          id: 'scene-1',
          sequence: 1,
          title: 'Nightwake Berth',
          povEntityId: 'mara-voss',
          locationId: 'glass-harbor',
          entityMentions: [
            { rawText: 'Mara Voss' },
            { rawText: 'Sister Elia' },
            { rawText: 'Ferryman' },
          ],
          locationMentions: [{ rawText: 'Glass Harbor' }],
          facts: [{ type: 'scene-tag', key: 'mirror-window', value: 'dusk' }],
          metadata: {
            summary:
              'The protagonist docks under the bells and hears a rumor about the stolen ledger.',
            excerpt:
              'Mara Voss eases the Nightwake against the black pilings while Sister Elia waits under a hooded lamp.',
          },
        },
      ],
    },
    {
      id: 'ch-2',
      sequence: 2,
      number: 2,
      title: 'The Ninth Bell',
      timeline: {
        timelineId: 'main',
        order: 3,
        label: 'Day 3',
      },
      povEntityId: 'ilen-marr',
      metadata: {
        summary:
          'Ilen leads Mara into the smugglers hub and reveals a machine that should not exist.',
      },
      scenes: [
        {
          id: 'scene-2',
          sequence: 1,
          title: 'Seawall Lift',
          povEntityId: 'ilen-marr',
          locationId: 'salt-vault',
          entityMentions: [
            { rawText: 'Captain Voss' },
            { rawText: 'Warden Halbrecht' },
            { rawText: 'Silver Choir' },
          ],
          locationMentions: [{ rawText: 'Salt Vault' }],
          facts: [{ type: 'scene-tag', key: 'technology', value: 'electricity' }],
          metadata: {
            summary:
              'A freight elevator and battery lamp throw the setting out of canon.',
            excerpt:
              'A freight elevator rattles toward the seawall while a battery lamp burns over the winch cage.',
          },
        },
        {
          id: 'scene-2b',
          sequence: 2,
          title: 'Hidden Berth',
          povEntityId: 'ilen-marr',
          locationId: 'salt-vault',
          entityMentions: [{ rawText: 'Mara' }, { rawText: 'Ilen Marr' }],
          locationMentions: [{ rawText: 'Salt Vault' }],
          facts: [{ type: 'scene-tag', key: 'mirror-window', value: 'dusk' }],
          metadata: {
            summary:
              'A quieter follow-up scene proves the editor can switch between multiple scenes in one chapter.',
            excerpt:
              'Mara and Ilen trade half-truths in a berth below the seawall while the bells count down to dusk.',
          },
        },
      ],
    },
    {
      id: 'ch-3',
      sequence: 3,
      number: 3,
      title: 'A Map Written in Glass',
      timeline: {
        timelineId: 'main',
        order: 2,
        label: 'Day 2',
      },
      povEntityId: 'seren-vale',
      metadata: {
        summary:
          'An unregistered narrator opens a mirror gate too early in an unknown archive.',
      },
      scenes: [
        {
          id: 'scene-3',
          sequence: 1,
          title: 'Moon Archive',
          povEntityId: 'seren-vale',
          locationId: 'moon-archive',
          entityMentions: [
            { rawText: 'Seren Vale' },
            { rawText: 'Mara' },
            { rawText: 'Silver Choir' },
          ],
          locationMentions: [{ rawText: 'Moon Archive' }],
          facts: [{ type: 'scene-tag', key: 'mirror-window', value: 'noon' }],
          metadata: {
            summary:
              'The timeline jumps backward while a mirror opens at noon and the chapter names untracked canon.',
            excerpt:
              'Seren Vale unfolds a glass map in the Moon Archive and opens the tide mirror at noon.',
          },
        },
      ],
    },
    {
      id: 'ch-4',
      sequence: 4,
      number: 4,
      title: 'Ledger of Returning Tides',
      timeline: {
        timelineId: 'main',
        order: 4,
        label: 'Day 4',
      },
      povEntityId: 'sister-elia',
      metadata: {
        summary:
          'Elia tries to repair the canon after the earlier damage has already spread.',
      },
      scenes: [
        {
          id: 'scene-4',
          sequence: 1,
          title: 'Abbey Scriptorium',
          povEntityId: 'sister-elia',
          locationId: 'candle-district',
          entityMentions: [{ rawText: 'Sister Elia' }, { rawText: 'Ilen Marr' }],
          locationMentions: [{ rawText: 'Candle District' }],
          facts: [{ type: 'scene-tag', key: 'mirror-window', value: 'dusk' }],
          metadata: {
            summary:
              'The canon keeper restores the ledger and turns earlier contradictions into visible notes.',
            excerpt:
              'Sister Elia copies the ruined ledger by hand and circles every false route in red ink.',
          },
        },
      ],
    },
  ],
}

export function createDemoDocument(): ContinuityDocument {
  return structuredClone(baseDemoDocument)
}
