# Workflow 轻量 Todo 状态机设计

## 1. 目标

当前回归测试不是让 Agent 自由探索页面，而是回放一组事先录制好的测试步骤。每个 workflow 需要持有一份有序 todo 清单，用一个轻量状态对象记录当前步骤、步骤结果和整体结果。

本设计不引入正式状态机框架。状态机只是一个在 workflow 内存中存活的 TypeScript 对象，负责按顺序推进 todo，并阻止 Agent 跳步或重复完成步骤。

## 2. 已确认的执行方式

- 一次 workflow 使用一次 Agent 会话执行整张清单。
- 录制步骤通过 `startWorkFlow` 的参数传入，workflow 不自行读取固定 JSON 文件。
- Agent 必须使用专用 todo 工具更新步骤状态，不能只在最后的文本结果中声称已完成。
- 任意一个步骤失败后立即结束 workflow，不继续执行后续步骤，也不自动重试。
- 录制时的 `screenshotPath` 作为该步骤的参考图提供给 Agent。
- `prompt` 保留为可选的整体测试说明，todo 清单才是操作顺序的唯一来源。
- 每个步骤记录状态、简短说明和执行后的证据截图路径。
- workflow 启动前必须验证所有参考截图可读。只要有一张缺失，就不启动浏览器和 Agent。

## 3. 数据结构

录制器产生的原始步骤结构保持不变：

```ts
export type OverallStepDesc = SingleStepDesc[];

export type SingleStepDesc = {
  desc: string;
  screenshotPath: string;
};
```

`startWorkFlow` 的目标输入结构：

```ts
export type WorkFlowOptions = {
  readyToTestURL: string;
  steps: OverallStepDesc;
  prompt?: string;
};
```

workflow 内部使用的 todo 结构：

```ts
export type TodoStatus = 'pending' | 'running' | 'passed' | 'failed';

export type TodoItem = {
  // 第几步骤
  index: number;
  // 操作动作描述
  desc: string;
  // 操作后参考图片路径
  referenceScreenshotPath: string;
  // 该步骤目前状态
  status: TodoStatus;
  // ai 给出的总结
  summary?: string;
  // 步骤结束后的截屏路径
  evidenceScreenshotPath?: string;
};
```

workflow 的目标返回结构：

```ts
export type WorkFlowResult = {
  runId: string;
  status: 'PASS' | 'FAIL';
  summary: string;
  todos: TodoItem[];
  agentSteps: number;
};
```

## 4. 轻量状态推进规则

1. workflow 创建时，第一个 todo 设为 `running`，其余 todo 设为 `pending`。
2. 状态机只接受对当前 `running` 步骤的更新。
3. 不允许跳过当前步骤更新后续步骤。
4. 不允许重复更新已经 `passed` 或 `failed` 的步骤。
5. 当前步骤设为 `passed` 后，状态机自动将下一个 `pending` 步骤设为 `running`。
6. 当前步骤设为 `failed` 后，workflow 进入失败终态，后续步骤保持 `pending`。
7. 所有步骤都为 `passed` 时，workflow 进入成功终态。
8. 空清单、越界索引、非法状态转换和无效步骤内容都应当明确报错。

## 5. Agent 与工具行为

新增一个独立 todo 工具，继续保持“一个工具一个文件”：

```ts
updateTodo({
  index: number,
  status: 'passed' | 'failed',
  summary: string,
});
```

`updateTodo` 不接受 `pending` 或 `running`，这两个状态由状态机自动管理。

screenshot 工具每次成功保存截图后，同时把图片路径记录为 workflow 最近一次截图。`updateTodo` 在完成步骤时自动绑定该路径，而不信任 Agent 手动传入任意路径。

当前步骤开始后如果没有产生新的页面截图，`updateTodo` 必须拒绝将它设为 `passed` 或 `failed`。

Agent 对每个 todo 必须按以下流程执行：

1. 查看当前步骤的录制参考图和 `desc`。
2. 调用 screenshot 工具获取当前页面。
3. 根据截图使用坐标类工具执行该步骤。
4. 操作后再次调用 screenshot 工具验证结果。
5. 调用 `updateTodo`，把当前步骤标记为 `passed` 或 `failed`。
6. 只有状态机已经推进后，才能处理下一步。

## 6. startWorkFlow 调用链

```text
POST /agent
  -> BrowserManager.start()
  -> startWorkFlow(options, browser)
     -> 验证 todo 清单和所有参考截图
     -> 生成 UUID runId
     -> 创建 TodoStateMachine
     -> 创建独立 BrowserContext 和 Page
     -> 打开 readyToTestURL
     -> createCheckAgent(agentOptions, todoStateMachine)
     -> 一次 Agent 会话按顺序执行整张清单
     -> todo 失败或全部成功后停止
     -> 生成 WorkFlowResult
     -> 关闭 BrowserContext
```

Agent 的停止条件包含：

- 状态机进入成功终态。
- 状态机进入失败终态。
- 达到预设的最大模型循环次数，作为防止无限执行的安全限制。

如果 Agent 因模型循环上限停止，但 todo 仍未进入终态，workflow 应当返回执行错误，不能把它当作测试 `FAIL`。

## 7. HTTP API 调整

`POST /agent` 的请求体增加 `steps`，`prompt` 改为可选。待测 URL 第一版继续使用服务端现有的硬编码地址。

```json
{
  "prompt": "可选的整体测试说明",
  "steps": [
    {
      "desc": "点击登录按钮",
      "screenshotPath": "recordings/login/001.png"
    }
  ]
}
```

成功执行后返回：

```json
{
  "runId": "uuid",
  "status": "PASS",
  "summary": "所有录制步骤执行成功",
  "todos": [],
  "agentSteps": 8
}
```

错误语义保持区分：

- todo 清单或参考图无效：请求参数错误，Agent 不启动。
- 待测页面无法打开：HTTP 502，返回对应 `runId`。
- 业务步骤执行失败：正常返回 workflow `FAIL` 报告。
- 模型、工具或状态机内部异常：执行错误，不冒充业务 `FAIL`。

## 8. 测试与验收标准

- 多步 todo 只能按索引顺序推进。
- 第一步成功后第二步自动从 `pending` 变为 `running`。
- 跳步、重复提交、越界索引和更新非当前步骤必须被拒绝。
- 没有当前步骤的新验证截图时，不能完成该 todo。
- 任意步骤失败后，后续 todo 保持 `pending`，Agent 循环停止。
- 所有步骤成功时返回 `PASS`，并且每步都有 `summary` 和 `evidenceScreenshotPath`。
- 空清单、空步骤描述或缺失参考图在 Agent 启动前失败。
- 状态转换逻辑需要独立单元测试，不依赖真实浏览器和模型。
- 完成每个实现阶段后运行 `npm run typecheck`。

## 9. 分步实施顺序

后续实现严格按以下顺序进行，每一步都可以单独检查和确认：

1. 定义 todo 和 workflow 的公共类型。
2. 实现不依赖 Agent 和 Playwright 的 `TodoStateMachine`。
3. 为所有状态转换和非法操作编写单元测试。
4. 实现独立 `updateTodo` 工具。
5. 让 screenshot 工具向 workflow 记录最近的证据截图。
6. 将 todo 状态机、步骤文本和参考图接入 `createCheckAgent`。
7. 改造 `startWorkFlow` 的输入、预检、停止条件和返回报告。
8. 更新 HTTP API 的请求校验和响应结构。
9. 更新 README 请求示例和返回示例。
10. 运行类型检查、单元测试和最终调用链验证。

## 10. 第一版明确不做的内容

- 不持久化 workflow 状态。
- 不支持暂停后恢复。
- 不支持多 Agent 并行执行一张清单。
- 不支持步骤失败后自动重试。
- 不支持失败后继续执行后续步骤。
- 不引入 XState 等正式状态机库。
