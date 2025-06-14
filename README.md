# ZW Transformer v2.0

ZW Transformer is a semantic middleware toolkit for turning creative narrative into structured data and back again. It provides utilities for:

- **Narrative ⇄ ZW ⇄ JSON** transformations
- **JSON ⇄ ZW** round‑trip conversion
- A visual editor built with **React**, **TypeScript** and **Vite**

ZW ("Ziegelwagga") is a human‑readable protocol for describing gameplay state and other structured concepts. This repository focuses on a modular architecture so the parser and converters can be used independently from the web UI.

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) 18 or newer
- (Optional) [Ollama](https://ollama.ai/) running locally for offline AI generation
- (Optional) a Gemini API key for Google's hosted models

### Install & Run
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create an `.env.local` file and set your Gemini API key:
   ```bash
   GEMINI_API_KEY=your-key-here
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
   Vite will start on <http://localhost:5173> by default.

To build a production bundle use `npm run build` and then `npm run preview` to serve it.

## Repository Overview

- **index.html** – HTML entry point with basic styles and import map
- **index.tsx** – main React application with tabs for creating, validating, visualising and exporting ZW content
- **zwParser.ts** – core parser turning ZW text into a tree of nodes
- **jsonToZw.ts** / **zwToJson.ts** – helpers for converting between JSON and ZW
- **zwToGodotScript.ts** – convert a parsed ZW tree into Godot GDScript
- **ZWSyntaxHighlighter.tsx** – syntax highlighted preview component
- **ZWTemplateVisualizer.tsx** – tree visualizer for ZW packets
- **AutoCompleteDropdown.tsx**, **CopyButton.tsx** – small UI utilities
- **package.json**, **vite.config.ts**, **tsconfig.json** – project configuration files

## AI Integration

The Create tab includes optional AI helpers that can convert natural language prompts into ZW packets and refine existing templates. You can choose between:

- **Ollama** – run `ollama serve` locally (default URL `http://localhost:11434`)
- **Gemini** – provide a `GEMINI_API_KEY` via `.env.local`

The provider and model can be selected from the app's **AI Configuration** panel.

## Example Round‑Trip

```ts
import { convertJsonToZwString } from './jsonToZw';
import { convertZwToJsonObject } from './zwToJson';

const data = {
  base: "Echo",
  location: "Hoth",
  defenses: ["ion cannon", "shield generator"]
};

const zw = convertJsonToZwString(JSON.stringify(data), 'ZW-BASE');
console.log(zw);
// =>
// ZW-BASE:
//   base: Echo
//   location: Hoth
//   defenses:
//     - ion cannon
//     - shield generator

const back = convertZwToJsonObject(zw);
console.log(JSON.stringify(back, null, 2));
```

Running the above will print the ZW representation and then the JSON object produced from that ZW string, demonstrating round‑trip safety.

## Status

Version 2.0 is a complete rewrite replacing previous files. The system is still evolving – feedback and contributions are welcome!
