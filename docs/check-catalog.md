# 检查规则目录

当前内置规则位于 `src/lib/continuity/rules.ts`，全部由本地 TypeScript 引擎执行。

## 已实现

### `ALIAS_CONFLICT`

含义：

- 同一个归一化别名指向多个已注册对象

价值：

- 避免 story bible 在查询和上下文拼装时发生歧义

### `UNKNOWN_ENTITY`

含义：

- 场景中的实体 mention 无法解析到已注册实体

价值：

- 帮助作者发现缺失角色卡、组织卡或命名漂移

### `CHAPTER_TIMELINE_REVERSED`

含义：

- 同一时间线里的章节顺序前进了，但时间线 order 值反而倒退

价值：

- 适合抓重排章节、插叙标注不清、修文后时间线失衡

### `POV_UNREGISTERED`

含义：

- 章节或场景引用了未在 POV 注册表中的实体

价值：

- 帮助团队明确“谁可以作为 POV”这一条创作约束

### `LOCATION_UNREGISTERED`

含义：

- 场景地点或地点 mention 无法解析到已注册地点

价值：

- 帮助把随手写出来的新地点及时沉淀进 story bible

### `LORE_RULE_HIT`

含义：

- 场景或章节事实命中了声明式 lore 规则中的 `forbid`，或缺失 `require`

价值：

- 让世界观约束可以用结构化规则表达，而不是只靠人工记忆

## 严重度分级

当前分级：

- `error`: 明确冲突或注册失败
- `warning`: 高风险但可能允许的偏移
- `info`: 提醒型问题

## 误报处理原则

建议后续按以下方式演进：

- 支持 issue 忽略列表
- 支持按项目保存基线
- 支持按规则配置 severity
- 支持对单章或单场景临时豁免

## 推荐下一批规则

- 角色状态漂移
- 道具持有状态冲突
- 关系变化未回写
- 伏笔未回收
- POV 声音漂移
- 系列级 canon diff
