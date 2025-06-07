
const JSON_TO_ZW_INDENT_SPACES = 2;

const formatZwKey = (key: string): string => {
  // Basic sanitization: ZW keys typically don't have spaces or special chars other than _ and -
  // For now, we'll just use the JSON key as is, assuming it's reasonably ZW-compatible.
  // More aggressive sanitization (e.g., replacing spaces with underscores) could be added.
  return key;
};

const convertValueToZw = (
  value: any,
  currentIndentLevel: number,
  isInsideListSpecialSyntax: boolean = false // True if we are formatting children of a list of objects
): string => {
  const indent = ' '.repeat(currentIndentLevel * JSON_TO_ZW_INDENT_SPACES);
  const nextIndentLevel = currentIndentLevel + 1;

  if (value === null) {
    return 'null'; // Or represent as empty string if preferred: ""
  }
  if (typeof value === 'string') {
    // Handle multi-line strings: subsequent lines need indentation
    const lines = value.split('\\n'); // JSON newlines are literal \n
    if (lines.length > 1) {
      return lines.map((line, index) => 
        index === 0 ? `"${line}"` : `${indent}${line}` // Only first line gets quotes directly from here
      ).join('\\n'); // Keep as literal \n for ZW parser to potentially handle if needed, or ensure ZW values are single line.
      // For ZW, multi-line values are typically appended.
      // The ZW parser handles subsequent non-keyed lines as part of the previous value.
      // So, for now, ensure quotes are correct for the first line.
      // The ZW parser will handle multi-line text values if they are unquoted.
      // Let's output multi-line strings as actual newlines and let ZW parser handle it.
      // This means if a string in JSON has \n, it becomes a ZW multi-line value.
      const zwLines = value.split('\\n');
      return zwLines.map((l, i) => (i > 0 ? indent + l : l)).join('\n');

    }
    // Escape quotes within the string if we are adding quotes
    // return `"${value.replace(/"/g, '\\"')}"`; 
    // ZW values are often not quoted unless they contain special chars or are empty and need distinction.
    // For simplicity, let's not add extra quotes unless necessary (e.g. empty string)
    return value === "" ? '""' : value;

  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[] # Empty list';
    }
    return value.map(item => {
      // If item is an object, it's a list of complex ZW items
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        // Each object in the list becomes a set of key-value pairs under a '-'
        const itemObjectString = convertObjectToZwItems(item, nextIndentLevel, true);
        return `${indent}- ${itemObjectString.trimStart()}`; // remove leading indent from itemObjectString as '-' provides context
      }
      // Simple list item
      return `${indent}- ${convertValueToZw(item, nextIndentLevel)}`;
    }).join('\n');
  }
  if (typeof value === 'object' && value !== null) {
    // This should be an object, convert its key-value pairs
    return convertObjectToZwItems(value, nextIndentLevel, isInsideListSpecialSyntax);
  }
  return String(value); // Fallback
};

const convertObjectToZwItems = (
  obj: Record<string, any>,
  currentIndentLevel: number,
  isInsideListSpecialSyntax: boolean = false
): string => {
  const indent = ' '.repeat(currentIndentLevel * JSON_TO_ZW_INDENT_SPACES);
  const lines: string[] = [];

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      const formattedKey = formatZwKey(key);
      // If the value is an object or an array that's not empty, it's a section or list section.
      // Otherwise, it's a simple key-value.
      if (typeof value === 'object' && value !== null && (Object.keys(value).length > 0 || (Array.isArray(value) && value.length > 0))) {
        lines.push(`${isInsideListSpecialSyntax ? '' : indent}${formattedKey}:`);
        lines.push(convertValueToZw(value, currentIndentLevel + (isInsideListSpecialSyntax ? 0 : 1) )); // if inside list, sub-indent is relative to current object
      } else { // Simple key-value, or empty object/array treated as value
        lines.push(`${isInsideListSpecialSyntax ? '' : indent}${formattedKey}: ${convertValueToZw(value, currentIndentLevel)}`);
      }
    }
  }
  return lines.join('\n');
};

export const convertJsonToZwString = (
  jsonString: string,
  rootZwType?: string
): string => {
  let parsedJson: any;
  try {
    parsedJson = JSON.parse(jsonString);
  } catch (error) {
    const err = error as Error;
    return `# Error: Invalid JSON input.\n# ${err.message}`;
  }

  let zwOutput = "";
  const initialIndentLevel = rootZwType ? 1 : 0;

  if (rootZwType && rootZwType.trim()) {
    zwOutput += `${rootZwType.trim()}:\n`;
  }

  if (typeof parsedJson === 'object' && parsedJson !== null && !Array.isArray(parsedJson)) {
    zwOutput += convertObjectToZwItems(parsedJson, initialIndentLevel);
  } else if (Array.isArray(parsedJson)) {
    // If root is an array, we need a key if there's a rootZwType, or just output the list
     if (rootZwType && rootZwType.trim()) {
        // Cannot directly assign an array to a root type like ZW-FOO: [item1, item2]
        // This needs a key. Let's use a default key like "ROOT_LIST_DATA"
        zwOutput += `${' '.repeat(initialIndentLevel * JSON_TO_ZW_INDENT_SPACES)}ROOT_LIST_DATA:\n`;
        zwOutput += convertValueToZw(parsedJson, initialIndentLevel + 1);
     } else {
        // If no root type, just output the list items directly (might look odd for ZW visualizer expecting a root key)
        // The visualizer typically expects a ZWNode with a key.
        // So, if the root is an array and no rootZwType is given, we might wrap it.
        // For now, let's try to render it as a ZW list directly if no root type.
        // This output won't be a valid single ZW packet for the parser, but can show the list.
        // Or, better, make the visualizer handle this or enforce a root key.
        // Let's enforce a fallback root key if no rootZwType and root is array.
        if (!rootZwType) zwOutput += `JSON_ARRAY_ROOT:\n`;
        zwOutput += convertValueToZw(parsedJson, 1); // Treat as children of the (implicit or explicit) root
     }
  } else {
    // Root is a primitive value
    if (rootZwType && rootZwType.trim()) {
        // Similar to array, need a key
        zwOutput += `${' '.repeat(initialIndentLevel * JSON_TO_ZW_INDENT_SPACES)}ROOT_VALUE: ${convertValueToZw(parsedJson, 0)}`;
    } else {
        // If no root type, and root is primitive, this is not standard ZW.
        // Wrap it with a default key.
        zwOutput += `JSON_PRIMITIVE_ROOT: ${convertValueToZw(parsedJson, 0)}`;
    }
  }

  return zwOutput;
};
