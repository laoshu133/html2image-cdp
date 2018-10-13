module.exports = {
    url: null, // 待截图的 URL，如果指定 content 此参数无效
    content: '', // 如果指定 content ，将自动根据 htmlTpl 构建 HTML
    contentTemplate: 'default', // content 渲染模板，支持 default, empty，默认 default
    dataType: 'json', // 返回的数据类型，支持 json 和 image
    action: 'shot', // 动作，目前支持 ssr, shot, shotpdf， 默认 shot

    wrapSelector: 'body', // 截图区域 CSS 选择器，默认 body
    errorSelector: 'body.is-render-error', // 当页面出现此选择器时表示页面渲染失败
    wrapFindTimeout: 10000, // 等待截图区域出现最大等待时间，默认 10s
    wrapMinCount: 1, // 要求截图区域最小数量
    wrapMaxCount: 0, // 要求截图区域最大数量

    imageType: 'png', // 生成图片类似，支持 png, jpg
    imageQuality: 90, // 图片质量 1-100
    imageSize: null, // 图片大小，裁剪位置 {width, height, position}

    pdfOptions: null, // pdf 导出配置

    viewport: null, // 视图宽度，格式 [width, height], 默认 null
    renderDelay: 0 // 截图前等待时间，默认 0ms
};
