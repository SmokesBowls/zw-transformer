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
  listPrefix?: string;
}

const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getIndentation = (line: string): number => {
  const match = line.match(/^(\s*)/);
  return match ? match[0].length : 0;
};

export const parseZW = (
  zwString: string,
  options: ParseOptions = {}
): ZWNode | null => {
  const delimiter = options.delimiter ?? ':';
  const listPrefix = options.listPrefix ?? '-';
  if (!zwString.trim()) {
    return null;
  }
  const delimRegex = escapeRegex(delimiter);
  const lines = zwString
    .split('\n')
    .filter((line) => line.trim() !== '' && !line.trim().startsWith('#'));
  if (lines.length === 0) return null;

  const rootRegex = new RegExp(`^([A-Z0-9_-]+(?:-[A-Z0-9_-]+)*)\s*${delimRegex}\s*$`, 'i');
  const rootMatch = lines[0].trim().match(rootRegex);
  if (!rootMatch) {
    return {
      key: 'Error: Invalid Root',
      value: `Packet must start with a type and delimiter \"${delimiter}\"`,
      depth: 0,
    };
  }
  const rootNode: ZWNode = { key: rootMatch[1], value: [], depth: 0 };
  const stack: ZWNode[] = [rootNode];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const indent = getIndentation(line);
    const depth = indent / 2;

    while (stack.length > 1 && depth <= stack[stack.length - 1].depth) {
      stack.pop();
    }
    const parent = stack[stack.length - 1];
    const kvRegex = new RegExp(`^([A-Za-z0-9_]+)\s*${delimRegex}\s*(.*)$`);
    const sectionRegex = new RegExp(`^([A-Za-z0-9_]+)\s*${delimRegex}\s*$`);

    if (trimmed.startsWith(listPrefix + ' ')) {
      if (!Array.isArray(parent.value)) parent.value = [];
      const itemContent = trimmed.slice(listPrefix.length + 1).trim();
      const kv = itemContent.match(kvRegex);
      const item: ZWListItem = { value: itemContent, depth };
      if (kv) {
        item.isKeyValue = true;
        item.itemKey = kv[1];
        item.value = kv[2] || '';
      }
      (parent.value as ZWListItem[]).push(item);
      continue;
    }

    const section = trimmed.match(sectionRegex);
    if (section) {
      if (!Array.isArray(parent.value)) parent.value = [];
      const node: ZWNode = { key: section[1], value: [], depth };
      (parent.value as ZWNode[]).push(node);
      stack.push(node);
      continue;
    }

    const kv = trimmed.match(kvRegex);
    if (kv) {
      if (!Array.isArray(parent.value)) parent.value = [];
      const node: ZWNode = { key: kv[1], value: kv[2] || '', depth };
      (parent.value as ZWNode[]).push(node);
      continue;
    }
  }
  return rootNode;
};
