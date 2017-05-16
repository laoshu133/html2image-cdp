/**
 * format-color
 */

module.exports = function(color) {
    return [
        color.r.toString(16),
        color.g.toString(16),
        color.b.toString(16),
        color.a.toString(16)
    ]
    .map(s => {
        if(s.length < 2) {
            s = '0' + s;
        }

        return s;
    })
    .join('');
};
