import { parseZW, ZWNode, ZWListItem } from '../parser';

describe('parseZW', () => {
  test('basic root-level parsing', () => {
    const input = [
      'ZW-ROOT:',
      '  field1: value1',
      '  field2: value2'
    ].join('\n');
    const parsed = parseZW(input);
    const value = parsed?.value as ZWNode[];
    expect(parsed?.key).toBe('ZW-ROOT');
    expect(value).toEqual([
      { key: 'field1', value: 'value1', depth: 1 },
      { key: 'field2', value: 'value2', depth: 1 }
    ]);
  });

  test('nested sections', () => {
    const input = [
      'ZW-NESTED:',
      '  section1:',
      '    sub1: a',
      '    sub2: b',
      '  section2:',
      '    subsection:',
      '      sub3: c'
    ].join('\n');
    const parsed = parseZW(input);
    const sections = parsed?.value as ZWNode[];
    expect(sections[0].key).toBe('section1');
    expect(((sections[0].value as ZWNode[])[0]).key).toBe('sub1');
    expect(((sections[1].value as ZWNode[])[0] as ZWNode).key).toBe('subsection');
    const subnodes = ((sections[1].value as ZWNode[])[0] as ZWNode).value as ZWNode[];
    expect(subnodes[0].key).toBe('sub3');
  });

  test('non-default delimiter', () => {
    const input = [
      'ZW-DELIM:',
      '  field1=value1',
      '  section:',
      '    nested=value2'
    ].join('\n');
    const parsed = parseZW(input, { delimiter: '=' });
    const children = parsed?.value as ZWNode[];
    expect(children[0]).toEqual({ key: 'field1', value: 'value1', depth: 1 });
    const nested = (children[1].value as ZWNode[])[0];
    expect(nested).toEqual({ key: 'nested', value: 'value2', depth: 2 });
  });

  test('list items with custom prefix', () => {
    const input = [
      'ZW-LIST:',
      '  * item1',
      '  * key=value'
    ].join('\n');
    const parsed = parseZW(input, { delimiter: '=', listItemPrefix: '*' });
    const items = parsed?.value as ZWListItem[];
    expect(items[0]).toEqual({ value: 'item1', depth: 1 });
    expect(items[1]).toEqual({ value: 'value', depth: 1, isKeyValue: true, itemKey: 'key' });
  });
});
