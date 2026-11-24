# tasks/ — 中长任务的三件套

只给**跨会话或决策密度高**的任务建目录；单会话任务不建。

```
tasks/<任务名>/
  AGENT.md           目标 / 边界 / 血规则
  CONTEXT_INDEX.md   当前步 / 下一步 / 文件地图（每步更新）
  handoff/current.md 会话交接，留最近 3 份
```

- 已有 `AGENT.md` → 视为续接：先读三件套再动手，缺件即补。
- 模板与格式见技能 `rp-handoff`。
- `check.mjs` 会提示"有 AGENT.md 缺 CONTEXT_INDEX.md"的目录。

任务结束后不必删除；三个月后回看，这三份文件比聊天记录有用得多。
