# html2image

A screenshot server base on Chrome Debugging Protocol interface.

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


## 使用非常非常简单

比如对某个网站截图

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
curl -H "Content-type: application/json" -X POST -d '{"url":"http://meiyaapp.com","wrapSelector":"body","imageSize":{"type":21,"width":1200,"height":800},"viewport":[1200,800]}' http://shot.huanleguang.cn
```

## 完整配置参数

服务接受 Get 或者 Post 请求，参数一致，个别参数只能 POST 发送

```javascript
{
    url: null, // 待截图的 URL，如果指定 content 此参数无效
    content: '', // 如果指定 content ，将自动根据 htmlTpl 构建 HTML
    action: 'makeshot', // 动作， 默认 makeshot
    dataType: 'json', // 返回的数据类型，支持 json 和 image

    wrapSelector: 'body', // 截图区域 CSS 选择器，默认 body
    wrapFindTimeout: 16000, // 等待截图区域出现最大等待时间，默认 16000ms
    wrapMinCount: 1, // 要求截图区域最小数量
    wrapMaxCount: 0, // 要求截图区域最大数量

    imageType: 'png', // 生成图片类似，支持 png, jpg
    imageQuality: 90, // 图片质量 1-100
    imageSize: null, // 图片大小，裁剪策略 {width, height, strategy}

    viewport: null, // 视图宽度，格式 [width, height], 默认 null
    backgroundColor: null, // 视图背景色, 默认 null
    renderDelay: 32 // 截图前等待时间，默认 32ms
}
```

### imageSize

默认值 null，不对目标图片进行缩放裁剪

配置如下：

```json
{
    "imageSize": {
        "type": 10,
        "width": 1200,
        "height": 800
    }
}
```

`imageSize.type` 取值如下

- 10 - 长边适应，圆点中心，不足补白
- 11 - 长边适应，圆点左上，不足补白
- 20 - 短边适应，圆点中心
- 21 - 短边适应，圆点左上


## 返回值

返回值类型由 `dataType` 配置决定，支持 `json`, `image`，默认为 `json`

如果为 `image`，默认只截取一张图片，且直接返回图片

如果为 `json` 返回值各字段说明：

```json
{
    // 第一张图片
    "image": "http://shot.huanleguang.cn/file/makeshot_1463680442328_1/out.png",
    // 截图的图片列表
    "images": ["http://shot.huanleguang.cn/file/makeshot_1463680442328_1/out.png", "http://shot.huanleguang.cn/file/makeshot_1463680442328_1/out-2.png", "http://shot.huanleguang.cn/file/makeshot_1463680442328_1/out-3.png", "http://shot.huanleguang.cn/file/makeshot_1463680442328_1/out-4.png", "http://shot.huanleguang.cn/file/makeshot_1463680442328_1/out-5.png"],
    // 元数据
    "metadata": {
        // 截图的区域大小
        "crops": [{
            "width": 400,
            "height": 565.359375,
            "left": 0,
            "top": 617.765625
        }, {
            "width": 400,
            "height": 565.359375,
            "left": 0,
            "top": 1183.125
        }, {
            "width": 400,
            "height": 565.359375,
            "left": 0,
            "top": 1748.484375
        }, {
            "width": 400,
            "height": 565.359375,
            "left": 0,
            "top": 2313.84375
        }, {
            "width": 400,
            "height": 565.359375,
            "left": 0,
            "top": 2879.203125
        }]
    },
    // 截图耗时，毫秒
    "elapsed": 2182
}
```


## 贡献代码

@TODO


## License (MIT)

And of course:

MIT: http://rem.mit-license.org
