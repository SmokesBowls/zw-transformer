import { parseZW } from '../parser';

describe('parseZW', () => {
  test('parses root-level key value pairs', () => {
    const input = `ZW-PACKET:\n  foo: bar\n  baz: qux`;
    const parsed = parseZW(input);
    expect(parsed).toEqual({
      key: 'ZW-PACKET',
      value: [
        { key: 'foo', value: 'bar', depth: 1 },
        { key: 'baz', value: 'qux', depth: 1 }
      ],
      depth: 0
    });
  });

  test('handles nested sections with multiple indentation levels', () => {
    const input = `ZW-PACKET:\n  section1:\n    field1: value1\n  section2:\n    nested:\n      inner: val`;
    const parsed = parseZW(input);
    expect(parsed).toEqual({
      key: 'ZW-PACKET',
      value: [
        {
          key: 'section1',
          value: [ { key: 'field1', value: 'value1', depth: 2 } ],
          depth: 1
        },
        {
          key: 'section2',
          value: [ {
            key: 'nested',
            value: [ { key: 'inner', value: 'val', depth: 3 } ],
            depth: 2
          } ],
          depth: 1
        }
      ],
      depth: 0
    });
  });

  test('supports custom delimiter', () => {
    const input = `ZW-PACKET =\n  foo = bar`;
    const parsed = parseZW(input, { delimiter: '=' });
    expect(parsed).toEqual({
      key: 'ZW-PACKET',
      value: [ { key: 'foo', value: 'bar', depth: 1 } ],
      depth: 0
    });
  });

  test('parses list items with custom prefix', () => {
    const input = `ZW-PACKET:\n  items:\n    * first\n    * second`;
    const parsed = parseZW(input, { listPrefix: '*' });
    expect(parsed).toEqual({
      key: 'ZW-PACKET',
      value: [ {
        key: 'items',
        value: [
          { value: 'first', depth: 2 },
          { value: 'second', depth: 2 }
        ],
        depth: 1
      } ],
      depth: 0
    });
  });
});
