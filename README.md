# html2image

A screenshot service, base on Chromeheadless and Puppeteer.

## 使用非常简单

对某个网站截图

```
curl http://shot.huanleguang.cn/?url=http://meiyaapp.com
```

直接返回图片

```
curl -I http://shot.huanleguang.cn/?url=http://meiyaapp.com&dataType=image
```

按选择器截图多张图片

```
curl http://shot.huanleguang.cn/?url=http://meiyaapp.com&wrapSelector=.floor
```

自定义宽高以及裁剪方式

```
curl -H "Content-type: application/json" -X POST -d '{"url":"http://meiyaapp.com","wrapSelector":"body","imageSize":{"position":"right top","width":1200,"height":800}}' http://shot.huanleguang.cn
```

## 完整配置参数

服务接受 `GET` 或者 `POST` 请求，参数一致，个别参数只能 POST 发送

```javascript
{
    url: null, // 待截图的 URL，如果指定 content 此参数无效
    content: '', // 如果指定 content ，将自动根据 htmlTpl 构建 HTML
    contentTemplate: 'default', // content 渲染模板，支持 default, empty，默认 default
    dataType: 'json', // 返回的数据类型，支持 json, image, pdf
    action: 'shot', // 动作，目前支持 ssr, shot, shotpdf， 默认 shot

    wrapSelector: 'body', // 截图区域 CSS 选择器，默认 body
    errorSelector: 'body.is-render-error', // 当页面出现此选择器时表示页面渲染失败
    wrapFindTimeout: 10000, // 等待截图区域出现最大等待时间，默认 10s
    wrapMinCount: 1, // 要求截图区域最小数量
    wrapMaxCount: 0, // 要求截图区域最大数量

    screenshotTimeout: 20000, // 单次截图超时时间
    imageBigThreshold: 4800, // 根据此阀值决定是否为大图
    imageChunkSize: 4000, // 如果为大图分片截图时单片大小
    imageType: 'png', // 生成图片类似，支持 png, jpg
    imageQuality: 90, // 图片质量 1-100
    imageSize: null, // 图片大小，裁剪位置 {width, height, position}

    dpi: null, // 输出 DPI，PDF 默认 300，图片默认 72

    pdfOptions: null, // pdf 导出配置，参见 Puppeteer page.pdf 文档

    viewport: null, // 视图宽度，格式 [width, height], 默认 null
    renderDelay: 0 // 截图前等待时间，默认 0ms
}
```

### url

目标页面，服务会打开此页面，并根据 `action` 和 `wrapSelector` 参数进行操作；

### content

`content` 当指定时， `url` 参数无效，服务会自动依据 `content` 构造一个访问页面；

### contentTemplate

仅当指定 `content` 参数时有效，即 `content` 会依照此模板构造 HTML，默认值 `default`, 支持参数如下：

- default 默认 HTML，content 将渲染至 body 标签内
- empty 空文件， content 将作为整个 HTML 内容


### action

目前支持如下动作：

- shot: 截图，用于返回 png/jpg 图像
- shotpdf: 渲染 pdf，用于整页渲染后返回 pdf 文件，同时页面会应用 `print` 媒体样式
- ssr: 服务端渲染，用于快速实现单页应用服务端渲染，主要用于 SEO 等；单页应用时需要等基本数据到位，且 DOM 渲染完成后再添加 `wrapSelector`，已保证蜘蛛抓取到正确的内容

### wrapSelector

用于标记页面需要截取的部分，同时也用来标记是否渲染完成；

意味着页面中至少要有一个 `wrapSelector` 参数给定的 CSS 选择器，否则图片会截取失败；

同时这个参数也应当确认页面内容已经渲染完时才添加此选择器，否则可能出现页面内容截取不全情况，比如图片未载入完成等。

### errorSelector

用于标记页面已渲染失败，用于通知服务快速释放资源，不用等待 `wrapSelector` 查找超时。

强烈建议页面处理内容的渲染状态，当数据出错或加载失败时及时添加 `errorSelector`。

### dataType

返回的数据类型，支持 `json`, `image`, `pdf`；

当指定 `image` 或 `pdf` 时，接口直接返回对应的二进制数据，相关元数据会通过 HTTP Header 返回；

该参数仅当 `action` 为 `shot` 或 `shotpdf` 时有效。

### imageType

返回图片类型，支持 `jpeg`, `png`，当指定 `png` 可以返回透明背景图，需要渲染页面配合处理；

该参数仅当 `action` 为 `shot` 时有效。

### imageSize

默认值 null，不对目标图片进行缩放裁剪；

完整配置如下：

```javascript
{
    imageSize: {
        position: 'top',
        width: 1200,
        height: 800
    }
}
```

`imageSize.position` 取值参考 [CSS position](https://developer.mozilla.org/en-US/docs/Web/CSS/object-position)

# pdfOptions

pdf 导出相关配置，比如宽高边距等， `path` 配置不可用；详见：

[https://pptr.dev/#?product=Puppeteer&version=v1.9.0&show=api-pagepdfoptions](https://pptr.dev/#?product=Puppeteer&version=v1.9.0&show=api-pagepdfoptions)


## 返回值

返回值类型由 `dataType` 配置决定，默认为 `json`

如果为 `image`，默认只截取一张图片，且直接返回图片

如果为 `json` 返回值各字段说明：

```json
{
    // 截图的图片列表
    "images": [
        "http://shot.huanleguang.cn/file/shot_1463680442328_1/out.png", "http://shot.huanleguang.cn/file/shot_1463680442328_1/out-2.png"
    ],
    // 第一张图片
    "image": "http://shot.huanleguang.cn/file/shot_1463680442328_1/out.png",
    // 元数据
    "metadata": {
        // 截图的区域大小
        "crops": [{
            "width": 400,
            "height": 565,
            "left": 0,
            "top": 617
        }, {
            "width": 400,
            "height": 565,
            "left": 0,
            "top": 1183
        }]
    },
    // 截图耗时，毫秒
    "elapsed": 440
}
```

## 安装与启动

1. 安装依赖

    ```
    npm i
    ```

2. 基础配置

    复制基本配置

    ```
    cp .env.example .env
    ```

    配置服务器域名，将文件内 `WWW_HOST` 改为自己的域名或 IP

    ```
    vim .env

    ```

3. 启动

    ```
    npm start
    ```

## 贡献代码

欢迎各类 PR。


## License

MIT
