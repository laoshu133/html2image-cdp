const uuid = require('../lib/uuid');

test('fill', () => {
    expect(uuid(5, false).length).toBe(5);

    expect(uuid(5, true).length).toBe(5 + 2);
});
