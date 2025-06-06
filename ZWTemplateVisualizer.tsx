
import React from 'react';

interface ZWNode {
  key: string;
  value?: string | ZWNode[] | ZWListItem[];
  depth: number;
}

interface ZWListItem {
  value: string | ZWNode[]; // Can be a simple string or nested ZWNodes if parser is enhanced
  isKeyValue?: boolean;
  itemKey?: string;
  depth: number;
}

const getIndentation = (line: string): number => {
  const match = line.match(/^(\s*)/);
  return match ? match[0].length : 0;
};

// This is the detailed parser used by the Visualizer.
// A simpler version might be used by the main App for basic validation tasks.
const parseZWForVisualizer = (zwString: string): ZWNode | null => {
  if (!zwString.trim()) {
    return null;
  }

  const lines = zwString.split('\n').filter(line => line.trim() !== '' && !line.trim().startsWith('#'));
  if (lines.length === 0) return null;

  const rootMatch = lines[0].match(/^([A-Z0-9_-]+(?:-[A-Z0-9_-]+)*):\s*$/i);
  if (!rootMatch) {
    // Try to find the first valid root line if there's leading non-comment, non-empty text
    const firstSemanticLineIndex = lines.findIndex(l => l.match(/^([A-Z0-9_-]+(?:-[A-Z0-9_-]+)*):\s*$/i));
    if (firstSemanticLineIndex === -1 || firstSemanticLineIndex > 0) { // If not found or not the true first line after filtering
         return { key: 'Error: Invalid Root', value: 'Packet must start with a valid type (e.g., ZW-REQUEST:). Check for leading text or ensure the first semantic line is a ZW type.', depth: 0 };
    }
    //This case should not be hit if lines are filtered and lines[0] is used.
    //Keeping the original robust check just in case.
    return { key: 'Error: Invalid Root', value: 'Packet must start with a type (e.g., ZW-REQUEST:)', depth: 0 };
  }

  const rootNode: ZWNode = { key: rootMatch[1], value: [], depth: 0 };
  const stack: Array<ZWNode> = [rootNode];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    const currentIndent = getIndentation(line);
    const depth = currentIndent / 2; 

    while (stack.length > 1) {
        const currentParentOnStack = stack[stack.length - 1];
        if (depth > currentParentOnStack.depth) {
            break;
        }
        stack.pop();
    }
    
    const parentNode = stack[stack.length - 1];

    if (trimmedLine.startsWith('- ')) {
      const itemContent = trimmedLine.substring(2).trim();
      if (!Array.isArray(parentNode.value)) {
          parentNode.value = []; // Initialize as ZWListItem[]
      }
      
      const listItem: ZWListItem = { value: itemContent, depth: depth };
      const kvMatch = itemContent.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
      if(kvMatch){
        listItem.isKeyValue = true;
        listItem.itemKey = kvMatch[1];
        listItem.value = kvMatch[2] || ''; 
      }
      (parentNode.value as ZWListItem[]).push(listItem);

    } else {
      const sectionMatch = trimmedLine.match(/^([A-Za-z0-9_]+):\s*$/); 
      const keyValueMatch = trimmedLine.match(/^([A-Za-z0-9_]+):\s*(.*)$/);

      if (!Array.isArray(parentNode.value)) {
        parentNode.value = []; // Initialize as ZWNode[]
      }

      if (sectionMatch) { 
        const newNode: ZWNode = { key: sectionMatch[1], value: [], depth: depth };
        (parentNode.value as ZWNode[]).push(newNode);
        stack.push(newNode);
      } else if (keyValueMatch) { 
        const newNode: ZWNode = { key: keyValueMatch[1], value: keyValueMatch[2] || '', depth: depth };
        (parentNode.value as ZWNode[]).push(newNode);
      } else if (trimmedLine && Array.isArray(parentNode.value) && parentNode.value.length > 0) {
          const lastItemInParentValue = parentNode.value[parentNode.value.length - 1];
          // Check if last item is a ZWListItem and its value is string (for multi-line string list items)
          if (lastItemInParentValue && !('key' in lastItemInParentValue) && typeof lastItemInParentValue.value === 'string') {
             (lastItemInParentValue as ZWListItem).value += `\n${trimmedLine}`; // Append to existing list item value
          } else {
            // If parent is holding ZWListItems, this is a new simple list item (unkeyed)
            if (parentNode.value.every(item => !('key' in item) && 'value' in item)){
                 (parentNode.value as ZWListItem[]).push({value: trimmedLine, depth: depth });
            }
            // Otherwise, it's an unhandled line or needs specific ZW spec for plain text under sections
          }
      }
    }
  }
  return rootNode;
};

const renderValue = (
  val: ZWNode['value'] | ZWListItem['value'], // val can be string, ZWNode[], or ZWListItem[]
  depth: number
): JSX.Element | null => {
  if (typeof val === 'string') {
    return val.trim() === '' ? null : <span style={{ color: '#27ae60', whiteSpace: 'pre-wrap' }}>{val}</span>;
  }
  if (val === undefined || val === null) {
    return null;
  }
  if (Array.isArray(val) && val.length > 0) {
    const childrenToRender = val.filter(child => child !== undefined && child !== null);
    if (childrenToRender.length === 0) return null;

    return (
      <ul style={{ listStyleType: 'none', paddingLeft: `10px`, margin: '2px 0' }}> {/* Simplified padding for consistent child indent */}
        {childrenToRender.map((child, index) => (
          <li key={index}>
            {/* child is ZWNode or ZWListItem */}
            <RenderNode node={child as ZWNode | ZWListItem} /> 
          </li>
        ))}
      </ul>
    );
  }
  return null;
};

const RenderNode: React.FC<{ node: ZWNode | ZWListItem }> = ({ node }) => {
  // Type guard to check if it's a ZWNode (has a 'key' property)
  if ('key' in node && node.key !== undefined) {
    const zwNode = node as ZWNode;
    const valueOutput = renderValue(zwNode.value, zwNode.depth);

    return (
      <div style={{ marginLeft: `${zwNode.depth * 10 - (zwNode.depth > 0 ? 10:0) }px`}}> {/* Adjust margin based on depth */}
        <strong style={{ color: zwNode.depth === 0 ? '#5D3FD3' : '#c0392b', fontSize: zwNode.depth === 0 ? '1.1em': '1em' }}>
          {zwNode.key}:
        </strong>
        {(typeof zwNode.value === 'string' && zwNode.value.trim() !== '' && valueOutput) ? ' ' : ''}
        {valueOutput}
      </div>
    );
  } else { // It's a ZWListItem
    const listItem = node as ZWListItem;
    const valueElement = renderValue(listItem.value, listItem.depth); 
    
    if (listItem.isKeyValue && listItem.itemKey) {
      return (
        <div style={{ marginLeft: `${listItem.depth * 10 -10 }px`}}>
          <span style={{ fontWeight: 'normal', color: '#2980b9' }}>- </span>
          <strong style={{ color: '#c0392b' }}>{listItem.itemKey}:</strong>
          {(valueElement && typeof listItem.value === 'string' && listItem.value.trim() !== '') ? ' ' : ''}
          {valueElement}
        </div>
      );
    }
    return (
      <div style={{ marginLeft: `${listItem.depth * 10 -10 }px`}}>
        <span style={{ fontWeight: 'normal', color: '#2980b9' }}>- </span>
        {valueElement}
      </div>
    );
  }
};


const ZWTemplateVisualizer: React.FC<{ templateDefinition: string }> = ({ templateDefinition }) => {
  const parsedStructure = parseZWForVisualizer(templateDefinition);

  if (!parsedStructure) {
    return <p style={{color: '#7f8c8d'}}>Type ZW code to see visual preview...</p>;
  }
  
  if (parsedStructure.key.startsWith('Error:')) {
     return <p style={{color: 'red', whiteSpace: 'pre-wrap'}}>{parsedStructure.key} {typeof parsedStructure.value === 'string' ? parsedStructure.value : ''}</p>;
  }

  return (
    <div className="zw-visualizer-tree" style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '0.85em', lineHeight: '1.6' }}>
      <RenderNode node={parsedStructure} />
    </div>
  );
};

export default ZWTemplateVisualizer;
