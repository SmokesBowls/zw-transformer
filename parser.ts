export interface ZWNode {
  key: string;
  value?: string | ZWNode[] | ZWListItem[];
  depth: number;
}

export interface ZWListItem {
  value: string | ZWNode[];
  isKeyValue?: boolean;
  itemKey?: string;
  depth: number;
}

export interface ParseOptions {
  delimiter?: string;
  listItemPrefix?: string;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function parseZW(input: string, opts: ParseOptions = {}): ZWNode | null {
  if (!input.trim()) return null;

  const delimiter = opts.delimiter ?? ':';
  const listPrefix = opts.listItemPrefix ?? '-';

  const lines = input
    .split(/\n/)
    .filter(l => l.trim() !== '' && !l.trim().startsWith('#'));
  if (lines.length === 0) return null;

  const rootMatch = lines[0].match(/^([A-Z0-9_-]+(?:-[A-Z0-9_-]+)*):\s*$/i);
  if (!rootMatch) {
    return {
      key: 'Error: Invalid Root',
      value: 'Packet must start with a type (e.g., ZW-REQUEST:)',
      depth: 0,
    };
  }

  const root: ZWNode = { key: rootMatch[1], value: [], depth: 0 };
  const stack: ZWNode[] = [root];
  const kvRegex = new RegExp(`^([A-Za-z0-9_]+)${escapeRegex(delimiter)}\\s*(.*)$`);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const indent = line.match(/^(\s*)/)?.[0].length ?? 0;
    const depth = indent / 2;

    while (stack.length > 1 && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }
    const parent = stack[stack.length - 1];

    if (trimmed.startsWith(`${listPrefix} `)) {
      if (!Array.isArray(parent.value)) parent.value = [];
      const content = trimmed.slice(listPrefix.length + 1).trim();
      const item: ZWListItem = { value: content, depth };
      const kv = content.match(kvRegex);
      if (kv) {
        item.isKeyValue = true;
        item.itemKey = kv[1];
        item.value = kv[2] || '';
      }
      (parent.value as ZWListItem[]).push(item);
      continue;
    }

    const sectionMatch = trimmed.match(/^([A-Za-z0-9_]+):\s*$/);
    const kvMatch = trimmed.match(kvRegex);

    if (!Array.isArray(parent.value)) parent.value = [];

    if (sectionMatch) {
      const node: ZWNode = { key: sectionMatch[1], value: [], depth };
      (parent.value as ZWNode[]).push(node);
      stack.push(node);
    } else if (kvMatch) {
      const node: ZWNode = { key: kvMatch[1], value: kvMatch[2] || '', depth };
      (parent.value as ZWNode[]).push(node);
    }
  }

  return root;
}
