# Changelog

这里维护截图服务主要版本更新日志。

<!--NEW_LOG_INJECT_HERE-->

### `V2.0.1` - 2018-10-15

##### 变更

- 将桥接部分改为更高阶的 `Puppeteer` 实现，以减少桥接部分复杂度
- 基于类重构 actions 实现，对外提供更优雅接口和流程控制
- 添加 `shotpdf` action，实现 pdf 导出
- 截图失败时，记录 `window.onerror` 信息
- 提供 `SHOT_HOSTS_MAP` 配置，实现内网映射能力，加速页面载入
- 建议将 `Chrome headless` 更换为 `Browserless` 库，以实现更好的队列和资源控制

### `V1.2.0` - 2018-08-15

V1.x 之后截图服务改为基于 Chrome headless 实现，桥接部分基于较底层的 `chrome-remote-interface` 实现。


### `V0.3.0` - 2017-12-11

第一个稳定用于生产环境版本，基于 Phantomjs 实现，现已不再维护，仓库地址：

[html2img](https://github.com/laoshu133/html2img)

