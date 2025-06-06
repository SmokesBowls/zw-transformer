import assert from 'assert';
import { parseZW } from '../ZWParser.js';

// Test nested parsing
const nestedInput = `ZW-REQUEST:
  USER:
    NAME: Alice
    DETAILS:
      - AGE: 30
      - CITY: Boston`;

const parsed = parseZW(nestedInput);
assert(parsed && parsed.key === 'ZW-REQUEST');
assert(Array.isArray(parsed.value));
const userNode = (parsed.value as any[]).find(n => n.key === 'USER');
assert(userNode && Array.isArray(userNode.value));
const detailsNode = (userNode.value as any[]).find(n => n.key === 'DETAILS');
assert(detailsNode && Array.isArray(detailsNode.value));
assert.strictEqual((detailsNode.value as any[]).length, 2);

// Test custom delimiter and list prefix
const customInput = `PACKET=
  FIELD=Value
  LIST=
    * item1
    * item2`;

const parsedCustom = parseZW(customInput, { delimiter: '=', listPrefix: '*' });
assert(parsedCustom && parsedCustom.key === 'PACKET');
const listNode = (parsedCustom.value as any[]).find(n => n.key === 'LIST');
assert(listNode && Array.isArray(listNode.value));
assert.strictEqual((listNode.value as any[]).length, 2);

console.log('All tests passed');
