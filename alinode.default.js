const fs = require('fs');
const exec = require('child_process').exec;

const {
    APP_ID,
    APP_SECRET,
    NODE_LOG_DIR = '/tmp',
    HOME,
    APP_DIR,
    ALINODE_CONFIG = 'alinode-conf.json'
} = process.env;

const defaults = {
    // server: 'wss://agentserver.node.aliyun.com:8080',
    appid: APP_ID,
    secret: APP_SECRET,
    // heartbeatInterval: 60,
    // reconnectDelay: 10,
    // reportInterval: 60,
    logdir: NODE_LOG_DIR,
    error_log: [],
    packages: []
};

if(fs.existsSync(`${APP_DIR}/package.json`)) {
    defaults.packages.push(`${APP_DIR}/package.json`);
}

let custom = {};

// load /app/alinode-conf.json
if(fs.existsSync(`${APP_DIR}/${ALINODE_CONFIG}`)) {
    custom = require(`${APP_DIR}/${ALINODE_CONFIG}`);
}

if(!custom.appid && defaults.appid) {
    delete custom.appid;
}
if(!custom.secret && defaults.secret) {
    delete custom.secret;
}

const config = Object.assign(defaults, custom);

if(config.appid && config.secret) {
    const cfgPath = `${HOME}/agenthub-running.json`;

    fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2));

    exec(`agenthub start ${cfgPath}`, {
        env: Object.assign({}, process.env)
    }, err => {
        if(err) {
            console.log('alinode error:', err.stack || err.message);
        }
    });
}
