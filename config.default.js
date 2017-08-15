module.exports = {
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
};
