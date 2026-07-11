# util-record-steps

打开目标网页并记录人工操作。初始页面以及每次点击、输入/选择完成、按下 Enter 或 Escape 后都会自动截图，记录持续写入 `steps.json`。

## 使用

```bash
npm install
npx playwright install chromium
npm run dev -- http://localhost:5173
```

也可以指定输出目录：

```bash
npm run dev -- http://localhost:5173 ./my-recording
```

完成操作后关闭浏览器或在终端按 `Ctrl+C`。默认输出位于 `recordings/<时间>/`：

```text
recordings/<时间>/
├── steps.json
└── screenshots/
    ├── 001.png
    └── 002.png
```

`steps.json` 的结构与 `john-agent/src/types.d.ts` 一致：

```json
[
  {
    "desc": "打开网页 http://localhost:5173/",
    "screenshotPath": "screenshots/001.png"
  },
  {
    "desc": "点击 button「登录」",
    "screenshotPath": "screenshots/002.png"
  }
]
```
