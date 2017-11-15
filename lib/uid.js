/**
 * uid
 */

const uid = () => {
    if(!uid._uid) {
        uid._uid = 0;
    }

    return ++uid._uid;
};

module.exports = uid;
