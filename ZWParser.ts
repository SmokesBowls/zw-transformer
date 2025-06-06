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

  const lines = zwString
    .split('\n')
    .filter((line) => line.trim() !== '' && !line.trim().startsWith('#'));
  if (lines.length === 0) return null;

  const escDelim = escapeRegex(delimiter);
  const rootRegex = new RegExp(`^([A-Z0-9_-]+(?:-[A-Z0-9_-]+)*)${escDelim}\s*$`, 'i');

  const rootMatch = lines[0].match(rootRegex);
  if (!rootMatch) {
    return {
      key: 'Error: Invalid Root',
      value: `Packet must start with a type (e.g., ZW-REQUEST${delimiter})`,
      depth: 0,
    };
  }

  const rootNode: ZWNode = { key: rootMatch[1], value: [], depth: 0 };
  const stack: ZWNode[] = [rootNode];

  const sectionRegex = new RegExp(`^([A-Za-z0-9_]+)${escDelim}\s*$`);
  const keyValueRegex = new RegExp(`^([A-Za-z0-9_]+)${escDelim}\s*(.*)$`);
  const listPrefixWithSpace = `${listPrefix} `;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    const currentIndent = getIndentation(line);
    const depth = currentIndent / 2;

    while (stack.length > 1 && depth <= stack[stack.length - 1].depth) {
      stack.pop();
    }

    const parentNode = stack[stack.length - 1];

    if (trimmedLine.startsWith(listPrefixWithSpace)) {
      const itemContent = trimmedLine.substring(listPrefixWithSpace.length).trim();
      if (!Array.isArray(parentNode.value)) {
        parentNode.value = [];
      }
      const listItem: ZWListItem = { value: itemContent, depth };
      const kvMatch = itemContent.match(keyValueRegex);
      if (kvMatch) {
        listItem.isKeyValue = true;
        listItem.itemKey = kvMatch[1];
        listItem.value = kvMatch[2] || '';
      }
      (parentNode.value as ZWListItem[]).push(listItem);
      continue;
    }

    const secMatch = trimmedLine.match(sectionRegex);
    const kvMatch = trimmedLine.match(keyValueRegex);

    if (!Array.isArray(parentNode.value)) {
      parentNode.value = [];
    }

    if (secMatch) {
      const newNode: ZWNode = { key: secMatch[1], value: [], depth };
      (parentNode.value as ZWNode[]).push(newNode);
      stack.push(newNode);
    } else if (kvMatch) {
      const newNode: ZWNode = { key: kvMatch[1], value: kvMatch[2] || '', depth };
      (parentNode.value as ZWNode[]).push(newNode);
    } else if (
      trimmedLine &&
      Array.isArray(parentNode.value) &&
      parentNode.value.length > 0
    ) {
      const lastItem = parentNode.value[parentNode.value.length - 1];
      if (lastItem && !('key' in lastItem) && typeof lastItem.value === 'string') {
        (lastItem as ZWListItem).value += `\n${trimmedLine}`;
      } else if (parentNode.value.every((item) => !('key' in item) && 'value' in item)) {
        (parentNode.value as ZWListItem[]).push({ value: trimmedLine, depth });
      }
    }
  }

  return rootNode;
};
