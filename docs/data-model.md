# 数据模型

`Story Bible QA` 当前采用纯前端、可序列化的 `ContinuityDocument` 作为核心输入格式。

## 顶层结构

```ts
type ContinuityDocument = {
  entities: StoryEntity[]
  locations: StoryLocation[]
  povs: PovRegistryEntry[]
  loreRules?: LoreRule[]
  chapters: StoryChapter[]
}
```

这个结构的目标是：

- 能直接保存为 JSON，便于版本控制
- 能映射到未来的 Markdown/YAML 导入
- 能把“故事事实”与“检查规则”分离

## 实体与地点

### `StoryEntity`

用于角色、组织、道具、生物、概念等故事实体。

关键字段：

- `id`: 稳定 id
- `name`: 主名称
- `kind`: 实体类型
- `aliases`: 别名列表
- `tags`: 标签
- `metadata`: 扩展元数据

### `StoryLocation`

用于地点与地理节点。

关键字段：

- `id`
- `name`
- `aliases`
- `regionId`
- `tags`
- `metadata`

## POV 注册表

### `PovRegistryEntry`

用于声明哪些实体允许作为 POV。

关键字段：

- `id`
- `entityId`
- `label`

这样可以把“角色存在”与“角色可以承载 POV”分开建模。

## 章节与场景

### `StoryChapter`

关键字段：

- `id`
- `sequence`: 在稿件中的顺序
- `number`: 可选展示章节号
- `title`
- `timeline`: 时间线引用
- `povEntityId`: 章节级 POV
- `scenes`: 场景列表
- `facts`: 章节级事实
- `metadata`: 章节说明、摘要等

### `StoryScene`

关键字段：

- `id`
- `sequence`
- `title`
- `povEntityId`
- `locationId`
- `entityMentions`
- `locationMentions`
- `facts`
- `metadata`

## 事实与规则

### `SceneFact`

当前支持四类事实：

- `entity-trait`
- `location-trait`
- `relationship`
- `scene-tag`

当前前端原型主要使用 `scene-tag` 承载简洁的世界规则信号，例如：

- `technology=electricity`
- `mirror-window=noon`

### `LoreRule`

规则结构是声明式的：

- `when`: 规则生效条件
- `require`: 必须存在的事实
- `forbid`: 不允许出现的事实
- `message`: 命中时的人类可读提示

## 示例

```json
{
  "id": "ch-3",
  "title": "A Map Written in Glass",
  "sequence": 3,
  "timeline": { "timelineId": "main", "order": 2, "label": "Day 2" },
  "povEntityId": "seren-vale",
  "scenes": [
    {
      "id": "scene-3",
      "sequence": 1,
      "title": "Moon Archive",
      "locationId": "moon-archive",
      "entityMentions": [{ "rawText": "Seren Vale" }],
      "locationMentions": [{ "rawText": "Moon Archive" }],
      "facts": [{ "type": "scene-tag", "key": "mirror-window", "value": "noon" }]
    }
  ]
}
```

这个例子能触发：

- POV 未注册
- 地点未注册
- 未知实体
- 时间线逆序
- lore 规则命中

## 下一步

推荐后续扩展：

- 引入 `artifact` / `thread` / `event` 的专门 schema
- 引入章节摘要与原文引用的标准字段
- 为 import/export 设计 Markdown/YAML 对应格式
- 给 issue 报告补充稳定锚点和可回链证据位置
