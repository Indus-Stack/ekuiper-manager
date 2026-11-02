# GLOSSARY

术语表。只收录 eKuiper Manager 领域内有歧义、或有多种译法的**术语**，不收录普通 UI 文案。

中文译名以 [eKuiper 官方中文文档](https://ekuiper.org/docs/zh/latest/) 为第一依据；
当官方文档自身不一致时，取本表裁决，并在「说明」列记录取舍原因。

## 核心模型

| 英文 | 中文 | 说明 |
| --- | --- | --- |
| Stream | 流 | 无界的事件序列。不使用「数据流」，避免与 Data 分组混淆。 |
| Table | 表 | 事件序列的快照。子类型保留完整译名：Scan Table → 扫描表；Lookup Table → 查询表。 |
| Source | 源（Source） | 首次出现带英文括注，后续仅用「源」。避免「数据源」——它与 Data Source（连接配置）撞名。 |
| Sink | 目标（Sink） | 官方文档同时出现「数据汇（Sink）」与「Sinks 动作」，本表取「目标」，取 eKuiper 架构定义「源 → SQL → 目标」。 |
| Rule | 规则 | — |
| Action | 动作 | 规则中输出端的动作数组元素。不是 Rule 本身。 |
| Function | 函数 | — |
| Service | 外部服务 | 指 `src/app/services` 的 external service。翻译时必须带「外部」二字，以免与 Node（节点）混淆。 |
| Plugin | 插件 | — |
| Schema | 模式 | 官方文档未统一翻译；「模式」在 eKuiper 社区语境中更常见，且不与 Table 的「表」冲突。 |
| Connection | 连接 / 连接选择器 | Connection Selector → 连接选择器。 |

## 容易撞名的歧义词

| 英文 | 中文 | 说明 |
| --- | --- | --- |
| Node | 节点 | **仅指**被管理的 eKuiper 实例（`src/app/nodes`，多节点管理）。 |
| Flow Node | 画布节点 | 规则设计器画布中的图元，与上面「节点」是两回事。严禁混用「节点」。 |
| Flow | 流程 | 规则的可视化编排产物（`src/app/flows`），与 Rule（规则）区分。 |

## 配置与运行

| 英文 | 中文 | 说明 |
| --- | --- | --- |
| Config Key | 配置组 | 保持 gateway 既有译法（Configuration Key 未直译为「配置键」）。 |
| Template | 模板 | — |
| Sink Template | 目标模板 | 不沿用 gateway 的「传输与存储模板」。 |
| Format | 格式 | — |
| Timestamp | 时间戳 | Timestamp Field → 时间戳字段。 |
| Field | 字段 | — |
| Endpoint | 端点 | — |
| Topic | 主题 | — |
| QoS | QoS | 不翻译。 |
| Concurrency | 并发度 | **不采用** gateway 的「线程数」。eKuiper 是 Go 实现，并发度不等于线程数。 |
| Buffer | 缓存区 / 缓冲区 | Buffer Length → 缓存区长度。 |
| Checkpoint | 检查点 | Check Point Interval → 检查点间隔。 |
| Retry | 重试 | Attempts → 最大重试次数；Multiplier → 重试间隔系数。 |
| Cache | 缓存 | 与 Buffer 区分：Cache 指磁盘/内存落盘缓存。 |

## 运行状态

| 英文 | 中文 | 说明 |
| --- | --- | --- |
| Running | 运行中 | — |
| Stopped | 已停止 | 注意 gateway 原文拼写为 `stoped`，属拼写错误，不继承。 |
| Starting / Stopping / Restarting | 正在启动 / 正在停止 / 正在重启 | 统一「正在 + 动词」句式。 |

## 数据流转

| 英文 | 中文 | 说明 |
| --- | --- | --- |
| Import / Export | 导入 / 导出 | — |
| Upload / Download | 上传 / 下载 | — |
| Deploy | 部署 | — |

## 裁决记录

以下为与 `gateway_things_manager` 既有译法**主动分歧**的项，改写代码时不得回退：

| 英文 | gateway 原译 | 本表译名 | 原因 |
| --- | --- | --- | --- |
| Sink | 传输与存储 | 目标 | 照搬会让用户与 eKuiper 官方文档无法对应 |
| Node | 服务 | 节点 | gateway 的「服务」与 external Service 撞名 |
| Concurrency | 线程数 | 并发度 | eKuiper 为 Go 实现，无「线程数」概念 |
| Flow | 规则图编辑器 | 流程 | gateway 指整个子应用；ekuiper-manager 中 Flow 是资源实体 |
