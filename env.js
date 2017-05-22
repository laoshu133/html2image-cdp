/**
 * global env
 */

const fs = require('fs');

const userEnvFile = `${__dirname}/.env`;
const globalEnvFile = `${__dirname}/.env.example`;

const envFilePath = fs.existsSync(userEnvFile) ? userEnvFile : globalEnvFile;

// global env
require('dotenv-safe').load({
    allowEmptyValues: true,
    sample: globalEnvFile,
    path: envFilePath
});
