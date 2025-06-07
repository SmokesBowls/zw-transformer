
export interface ZWNode {
  key: string;
  value?: string | ZWNode[] | ZWListItem[];
  depth: number;
  parent?: ZWNode; 
  delimiter?: string; // Store the delimiter used for this node's children if applicable
}

export interface ZWListItem {
  value: string | ZWNode[];
  isKeyValue?: boolean;
  itemKey?: string;
  depth: number;
  delimiter?: string; // Store the delimiter if it's a list of KVs
}

const getIndentation = (line: string): number => {
  const match = line.match(/^(\s*)/);
  return match ? match[0].length : 0;
};

const escapeRegExp = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
};

export const parseZW = (zwString: string, options?: { delimiter?: string }): ZWNode | null => {
  if (!zwString || !zwString.trim()) {
    return null;
  }

  const stripMarkdownFences = (input: string): string => {
    const trimmed = input.trim();
    const lines = trimmed.split('\n');
    if (lines.length >= 2 && /^```(?:zw)?\s*$/i.test(lines[0]) && lines[lines.length - 1].trim() === '```') {
      return lines.slice(1, -1).join('\n');
    }
    return input;
  };

  zwString = stripMarkdownFences(zwString);

  const lines = zwString.split('\n').filter(line => line.trim() !== '' && !line.trim().startsWith('#'));
  if (lines.length === 0) return null;

  // Root node type always uses ':', as per ZW convention for packet types.
  const rootLineRegex = /^([A-Z0-9_-]+(?:-[A-Z0-9_-]+)*):\s*$/i;
  const rootMatch = lines[0].match(rootLineRegex);

  if (!rootMatch) {
    return {
      key: 'Error: Invalid Root',
      value: `Packet must start with a ZW Type (e.g., ZW-REQUEST:). First line encountered: "${lines[0]}"`,
      depth: 0
    };
  }
  
  const effectiveDelimiter = options?.delimiter || ':';
  const escapedDelimiter = escapeRegExp(effectiveDelimiter);

  const rootNode: ZWNode = { key: rootMatch[1], value: [], depth: 0, delimiter: effectiveDelimiter };
  const stack: Array<ZWNode> = [rootNode];

  // Regexes using the effective delimiter for children
  const sectionRegex = new RegExp(`^([A-Za-z0-9_]+)${escapedDelimiter}\\s*$`);
  const keyValueRegex = new RegExp(`^([A-Za-z0-9_]+)${escapedDelimiter}\\s*(.*)$`);


  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    const currentIndent = getIndentation(line);
    // Assuming 2 spaces for indentation depth, adjust if ZW spec allows others
    const depth = Math.max(1, currentIndent / 2); 

    while (stack.length > 1) {
        const currentParentOnStack = stack[stack.length - 1];
        if (depth > currentParentOnStack.depth) {
            break; 
        }
        stack.pop();
    }
    
    const parentNode = stack[stack.length - 1];
    // Ensure parentNode.value is initialized as an array if it's meant to hold children
    if (parentNode.value === undefined || typeof parentNode.value === 'string') {
        parentNode.value = [];
    }


    if (trimmedLine.startsWith('- ')) {
      const itemContent = trimmedLine.substring(2).trim();
      if (!Array.isArray(parentNode.value)) {
         // This case should ideally be prevented by initialization above,
         // but as a safeguard:
         console.warn("Parent node value is not an array for list item:", parentNode);
         parentNode.value = [];
      }
      
      const listItem: ZWListItem = { value: itemContent, depth: depth, delimiter: effectiveDelimiter };
      // Regex for key-value list items, also uses the effectiveDelimiter
      const listItemKvRegex = new RegExp(`^([A-Za-z0-9_]+)${escapedDelimiter}\\s*(.*)$`);
      const kvMatch = itemContent.match(listItemKvRegex);

      if(kvMatch){
        listItem.isKeyValue = true;
        listItem.itemKey = kvMatch[1];
        listItem.value = kvMatch[2] || ''; 
      }
      (parentNode.value as ZWListItem[]).push(listItem);

    } else {
      const sectionMatch = trimmedLine.match(sectionRegex); 
      const keyValueMatch = trimmedLine.match(keyValueRegex);

      if (!Array.isArray(parentNode.value)) {
         // Safeguard, similar to above
         console.warn("Parent node value is not an array for node item:", parentNode);
         parentNode.value = [];
      }

      if (sectionMatch) { 
        const newNode: ZWNode = { key: sectionMatch[1], value: [], depth: depth, delimiter: effectiveDelimiter };
        (parentNode.value as ZWNode[]).push(newNode);
        stack.push(newNode);
      } else if (keyValueMatch) { 
        const newNode: ZWNode = { key: keyValueMatch[1], value: keyValueMatch[2] || '', depth: depth, delimiter: effectiveDelimiter };
        (parentNode.value as ZWNode[]).push(newNode);
      } else if (trimmedLine && Array.isArray(parentNode.value) && parentNode.value.length > 0) {
          // Handling multi-line string values for the last item
          const lastChild = parentNode.value[parentNode.value.length - 1];
          
          if (lastChild && typeof lastChild.value === 'string') { // Applies to both ZWNode and ZWListItem with string value
             (lastChild.value as string) += `\n${trimmedLine}`;
          } else {
            // This could be an error or unformatted text. For now, we'll ignore it if it doesn't match known patterns.
            // console.warn(`Unhandled line in ZW parsing: "${trimmedLine}" under parent:`, parentNode.key);
          }
      } else if (trimmedLine) {
        // Line with content that doesn't fit other patterns and no clear last child to append to.
        // console.warn(`Orphaned line in ZW parsing: "${trimmedLine}"`);
      }
    }
  }
  return rootNode;
};
