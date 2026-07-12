# util-record-steps

打开目标网页并记录人工操作。初始页面以及每次有意义的操作完成后都会自动截取当前视口，记录持续写入 `steps.json`。

当前支持点击、输入完成、选择、复选框、文件选择、Enter/Escape、表单提交、拖放和滚动。输入与滚动采用 500ms 防抖，连续操作结束后只生成一个步骤；密码内容会被替换为 `[已隐藏]`，文件操作只记录文件名。

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

启动时会等待页面中的录制桥接就绪。如果终端提示“页面录制桥接初始化超时”，说明页面事件没有成功连接到录制进程，应先处理该错误，而不是继续操作浏览器。

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
