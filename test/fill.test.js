const fill = require('../lib/fill');

test('fill', () => {
    expect(fill('1{{x}}3', {
        x: 2
    }))
    .toBe('123');

    expect(fill('a{{x}}{{y}}d', {
        x: 'b',
        y: 'c'
    }))
    .toBe('abcd');
});
