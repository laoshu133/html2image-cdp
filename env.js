/**
 * global env
 */

// global env
require('dotenv-safe').load({
    allowEmptyValues: true,
    path: `${__dirname}/.env`,
    sample: `${__dirname}/.env.example`
});
