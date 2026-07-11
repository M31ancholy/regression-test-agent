# john-agent

一个以“录制 → 回放 → 断言 → 报告”为主链路的回归测试 Agent。

## 项目结构

```text
cmd/john-agent/       CLI 入口
internal/app/         应用编排与命令路由
internal/config/      环境配置
internal/runner/      用例执行核心
internal/store/       用例持久化
internal/report/      测试报告输出
pkg/model/            可复用的领域模型
```

`runner.Driver` 是自动化能力的边界。后续可以分别接入浏览器、桌面或移动端驱动，不需要修改执行编排。

## 开始使用

```bash
make test
make build
./bin/john-agent help
```

默认运行数据写入 `.john/`。可通过 `JOHN_DATA_DIR` 和 `JOHN_ARTIFACT_DIR` 修改路径。

## 下一阶段

- 实现 `record` 命令与录制器
- 接入首个浏览器自动化 Driver
- 实现截图基线与视觉差异比较
- 输出 HTML 测试报告
