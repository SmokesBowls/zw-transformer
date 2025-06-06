
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import ZWTemplateVisualizer from './ZWTemplateVisualizer';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Define ZW Parsing logic and types here to be accessible by App and potentially ZWTemplateVisualizer
interface ZWNode {
  key: string;
  value?: string | ZWNode[] | ZWListItem[];
  depth: number;
  parent?: ZWNode; // Optional: for complex parsing/navigation
}

interface ZWListItem {
  value: string | ZWNode[];
  isKeyValue?: boolean;
  itemKey?: string;
  depth: number;
}

const getIndentation = (line: string): number => {
  const match = line.match(/^(\s*)/);
  return match ? match[0].length : 0;
};

const parseSimpleZW = (zwString: string): ZWNode | null => {
  if (!zwString.trim()) return null;
  const lines = zwString.split('\n').filter(line => line.trim() !== '' && !line.trim().startsWith('#'));
  if (lines.length === 0) return null;

  const rootLine = lines[0].trim();
  const rootMatch = rootLine.match(/^([A-Z0-9_-]+(?:-[A-Z0-9_-]+)*):\s*$/i);
  
  if (!rootMatch) {
    return { key: 'Error: Invalid Root', value: 'Packet must start with a valid type (e.g., ZW-REQUEST:)', depth: 0 };
  }
  const rootKey = rootMatch[1];
  const rootNode: ZWNode = { key: rootKey, value: [], depth: 0 };
  let tempValueCollector: ZWNode[] | ZWListItem[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const indent = getIndentation(line);
    const trimmedLine = line.trim();
    if (indent === 2) { 
        const kvMatch = trimmedLine.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
        const sectionMatch = trimmedLine.match(/^([A-Za-z0-9_]+):\s*$/);
        if (kvMatch) {
            (tempValueCollector as ZWNode[]).push({ key: kvMatch[1], value: kvMatch[2] || '', depth: 1 });
        } else if (sectionMatch) {
            (tempValueCollector as ZWNode[]).push({ key: sectionMatch[1], value: [], depth: 1 });
        } else if (trimmedLine.startsWith('- ')) {
            const itemContent = trimmedLine.substring(2).trim();
             const listItemKvMatch = itemContent.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
             if (listItemKvMatch) {
                 (tempValueCollector as ZWListItem[]).push({ itemKey: listItemKvMatch[1], value: listItemKvMatch[2] || '', isKeyValue: true, depth: 1 });
             } else {
                (tempValueCollector as ZWListItem[]).push({ value: itemContent, depth: 1 });
             }
        }
    }
  }
  if (tempValueCollector.length > 0) {
    rootNode.value = tempValueCollector;
  }
  return rootNode;
};


// --- App Component ---
type TabKey = 'projects' | 'create' | 'validate' | 'visualize' | 'export' | 'library';

interface ZWSchemaDefinition {
  id: string;
  name: string;
  definition: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  schemas: ZWSchemaDefinition[];
}

interface ValidationFeedback {
  type: 'success' | 'error' | 'info';
  message: string;
  suggestions?: string[];
}

interface ExportStatus {
  type: 'success' | 'error';
  message: string;
}

// Initialize Gemini API client
// Ensure API_KEY is set in the environment variables
let ai: GoogleGenAI | null = null;
try {
    if (!process.env.API_KEY) {
        console.warn("API_KEY environment variable not set. Gemini API features will be disabled.");
    } else {
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
} catch (error) {
    console.error("Failed to initialize GoogleGenAI:", error);
}


const App = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('projects');
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');

  const [templateDefinition, setTemplateDefinition] = useState('');
  const [nlScenario, setNlScenario] = useState('');
  const [currentSchemaName, setCurrentSchemaName] = useState('');
  const [editingSchemaId, setEditingSchemaId] = useState<string | null>(null);
  
  const [generatedZWPacket, setGeneratedZWPacket] = useState('');
  const [previousGeneratedZWPacketForRefinement, setPreviousGeneratedZWPacketForRefinement] = useState('');
  const [userFeedbackForNL, setUserFeedbackForNL] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const [zwToValidate, setZwToValidate] = useState('');
  const [validationResults, setValidationResults] = useState<ValidationFeedback | null>(null);

  const [zwToVisualize, setZwToVisualize] = useState('');

  const [templateFilename, setTemplateFilename] = useState('template.zw');
  const [generatedPacketFilename, setGeneratedPacketFilename] = useState('generated_packet.zw');
  const [bundleFilename, setBundleFilename] = useState('templates_bundle.zw');
  const [exportStatus, setExportStatus] = useState<ExportStatus | null>(null);


  const activeProject = projects.find(p => p.id === activeProjectId) || null;

  const handleCreateProject = () => {
    if (!newProjectName.trim()) {
      alert("Project name cannot be empty.");
      return;
    }
    const newProject: Project = {
      id: Date.now().toString(),
      name: newProjectName,
      description: newProjectDescription,
      schemas: [],
    };
    setProjects([...projects, newProject]);
    setNewProjectName('');
    setNewProjectDescription('');
    setActiveProjectId(newProject.id);
  };

  const handleLoadSchema = (schema: ZWSchemaDefinition) => {
    setTemplateDefinition(schema.definition);
    setCurrentSchemaName(schema.name);
    setEditingSchemaId(schema.id);
  };

  const handleSaveSchemaToProject = () => {
    if (!activeProject) {
      alert("No active project selected.");
      return;
    }
    if (!currentSchemaName.trim()) {
      alert("Schema name cannot be empty.");
      return;
    }

    const updatedProjects = projects.map(p => {
      if (p.id === activeProjectId) {
        const existingSchemaIndex = p.schemas.findIndex(s => s.id === editingSchemaId);
        let newSchemas: ZWSchemaDefinition[];

        if (editingSchemaId && existingSchemaIndex !== -1) {
          newSchemas = [...p.schemas];
          newSchemas[existingSchemaIndex] = { ...newSchemas[existingSchemaIndex], name: currentSchemaName, definition: templateDefinition };
        } else {
          const newSchemaId = Date.now().toString();
          const newSchema: ZWSchemaDefinition = { id: newSchemaId, name: currentSchemaName, definition: templateDefinition };
          newSchemas = [...p.schemas, newSchema];
          setEditingSchemaId(newSchemaId); 
        }
        return { ...p, schemas: newSchemas };
      }
      return p;
    });
    setProjects(updatedProjects);
    alert(`Template "${currentSchemaName}" saved to project "${activeProject.name}"!`);
  };

  const handleNewTemplate = () => {
    setTemplateDefinition('');
    setCurrentSchemaName('');
    setEditingSchemaId(null);
  };
  
  const handleProjectAwareValidate = () => {
    if (!activeProject) {
      setValidationResults({ type: 'error', message: "No active project. Please select or create a project first." });
      return;
    }
    if (!zwToValidate.trim()) {
      setValidationResults({ type: 'info', message: "Nothing to validate. Please paste ZW content." });
      return;
    }

    const parsedInput = parseSimpleZW(zwToValidate);

    if (!parsedInput || parsedInput.key.startsWith('Error:')) {
      setValidationResults({ type: 'error', message: `Syntax Error: ${parsedInput?.value || 'Invalid ZW structure.'}` });
      return;
    }

    const inputPacketType = parsedInput.key;
    let foundMatch = false;

    for (const schemaDef of activeProject.schemas) {
      const parsedSchema = parseSimpleZW(schemaDef.definition);
      if (parsedSchema && parsedSchema.key === inputPacketType) {
        setValidationResults({
          type: 'success',
          message: `Input ZW conforms to project schema: "${schemaDef.name}" (Type: ${inputPacketType}).`
        });
        foundMatch = true;
        break;
      }
    }

    if (!foundMatch) {
      const suggestions = activeProject.schemas.map(s => `"${s.name}" (Type: ${parseSimpleZW(s.definition)?.key || 'unknown'})`);
      setValidationResults({
        type: 'info',
        message: `Input ZW type "${inputPacketType}" does not match any known schema in project "${activeProject.name}".`,
        suggestions: suggestions.length > 0 ? ["Consider using one of the established project patterns:", ...suggestions, "Or, define this as a new template in the 'Create' tab."] : ["No schemas defined for this project yet. Define templates in the 'Create' tab."]
      });
    }
  };
  
  const downloadFile = (content: string, filename: string, contentType: string = 'text/plain'): boolean => {
    try {
      const blob = new Blob([content], { type: contentType });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      return true;
    } catch (err) {
      console.error('Download failed:', err);
      return false;
    }
  };

  const handleExportAllTemplates = () => {
    if (!activeProject) {
      setExportStatus({ type: 'error', message: 'No active project selected.' });
      return;
    }
    if (activeProject.schemas.length === 0) {
      setExportStatus({ type: 'error', message: 'There are no templates to export.' });
      return;
    }

    try {
      const bundleContent = activeProject.schemas
        .map(s => `# ${s.name}\n${s.definition}`)
        .join('\n\n');
      const success = downloadFile(bundleContent, bundleFilename);
      if (success) {
        setExportStatus({ type: 'success', message: 'Templates exported successfully.' });
      } else {
        setExportStatus({ type: 'error', message: 'Failed to export templates.' });
      }
    } catch (err) {
      console.error('Failed to export templates:', err);
      setExportStatus({ type: 'error', message: 'Failed to export templates.' });
    }
  };

  const handleGenerateZWFromNL = async () => {
    if (!ai) {
        setGenerationError("Gemini API client is not initialized. Check API_KEY.");
        alert("Gemini API client is not initialized. Please ensure the API_KEY is correctly configured in your environment.");
        return;
    }
    if (!nlScenario.trim()) {
      setGenerationError("Please enter a natural language scenario.");
      setGeneratedZWPacket('');
      setPreviousGeneratedZWPacketForRefinement('');
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);
    setGeneratedZWPacket('');
    setUserFeedbackForNL(''); // Clear previous feedback

    let prompt = `You are an expert in the Ziegelwagga (ZW) data interchange format. Your task is to convert the following natural language scenario into a valid ZW packet.

ZW Format Basics:
- Packets start with a capitalized, hyphenated TYPE (e.g., ZW-REQUEST:, ZW-EVENT:, ZW-DATA:).
- Key-value pairs are indented, like "  KEY: value".
- Sections are indented and end with a colon, like "  SECTION:".
- Lists items start with "- " and are indented under their parent key or section.
- Ensure proper indentation (usually 2 spaces per level).

Based on the scenario below, generate a ZW packet. Strive for clarity, logical structure, and adherence to ZW conventions.

Scenario:
"${nlScenario}"

Generated ZW Packet:`;

    let projectTemplatesInfo = "";
    if (activeProject && activeProject.schemas.length > 0) {
        projectTemplatesInfo = activeProject.schemas.map(s => `Template Name: ${s.name}\n${s.definition}`).join('\n\n---\n\n');
        prompt = `You are an expert in the Ziegelwagga (ZW) data interchange format.
The user is working within a project that has the following ZW template(s) defined:
---PROJECT TEMPLATES START---
${projectTemplatesInfo}
---PROJECT TEMPLATES END---

Your task is to convert the following natural language scenario into a valid ZW packet.
If possible, try to make the generated ZW packet conform to one of the provided project templates, or use them as inspiration for the structure. If no template is directly applicable, generate a general, well-structured ZW packet.

ZW Format Basics: (same as above)

Scenario:
"${nlScenario}"

Generated ZW Packet:`;
    }


    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-04-17', 
        contents: prompt,
      });
      const text = response.text;
      setGeneratedZWPacket(text);
      setPreviousGeneratedZWPacketForRefinement(text); // Save for potential refinement
    } catch (error) {
      console.error("Error generating ZW from NL:", error);
      setGenerationError(error instanceof Error ? error.message : "An unknown error occurred during ZW generation.");
      setGeneratedZWPacket('');
      setPreviousGeneratedZWPacketForRefinement('');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefineZWFromNL = async () => {
    if (!ai) {
        setGenerationError("Gemini API client is not initialized. Check API_KEY.");
        return;
    }
    if (!previousGeneratedZWPacketForRefinement.trim() || !userFeedbackForNL.trim()) {
      setGenerationError("Nothing to refine or no feedback provided.");
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);

    let projectTemplatesContext = "";
    if (activeProject && activeProject.schemas.length > 0) {
        const projectTemplates = activeProject.schemas.map(s => `Template Name: ${s.name}\n${s.definition}`).join('\n\n---\n\n');
        projectTemplatesContext = `
The user is working within a project that has the following ZW template(s) defined:
---PROJECT TEMPLATES START---
${projectTemplates}
---PROJECT TEMPLATES END---
When refining, continue to consider these templates if applicable.`;
    }

    const prompt = `You are an expert in the Ziegelwagga (ZW) data interchange format.
The user provided an initial natural language scenario and you generated a ZW packet. Now, the user has provided feedback to refine that packet.

Original Natural Language Scenario:
"${nlScenario}"

Previously Generated ZW Packet:
---
${previousGeneratedZWPacketForRefinement}
---

User's Feedback for Refinement:
"${userFeedbackForNL}"
${projectTemplatesContext}

ZW Format Basics:
- Packets start with a capitalized, hyphenated TYPE (e.g., ZW-REQUEST:, ZW-EVENT:, ZW-DATA:).
- Key-value pairs are indented, like "  KEY: value".
- Sections are indented and end with a colon, like "  SECTION:".
- Lists items start with "- " and are indented under their parent key or section.
- Ensure proper indentation (usually 2 spaces per level).

Based on the original scenario, the previous ZW packet, and the user's feedback, please generate an updated ZW packet.
Incorporate the feedback precisely while maintaining the core intent of the original scenario and adhering to ZW conventions.

Updated ZW Packet:`;

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-04-17',
        contents: prompt,
      });
      const text = response.text;
      setGeneratedZWPacket(text);
      setPreviousGeneratedZWPacketForRefinement(text); // Update for further refinements
      setUserFeedbackForNL(''); // Clear feedback after applying it
    } catch (error) {
      console.error("Error refining ZW from NL:", error);
      setGenerationError(error instanceof Error ? error.message : "An unknown error occurred during ZW refinement.");
      // Optionally, decide if you want to clear generatedZWPacket or keep the old one on error
    } finally {
      setIsGenerating(false);
    }
  };


  const renderTabContent = () => {
    if (activeTab !== 'projects' && activeTab !== 'visualize' && !activeProject) {
      return <p>Please select or create a project in the '🌍 Projects' tab to continue.</p>;
    }

    switch (activeTab) {
      case 'projects':
        return (
          <div>
            <h2>Project Management</h2>
            <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '4px' }}>
              <h3>Create New Project</h3>
              <input type="text" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="Project Name" style={{ marginRight: '10px', padding: '8px' }} />
              <input type="text" value={newProjectDescription} onChange={e => setNewProjectDescription(e.target.value)} placeholder="Project Description" style={{ marginRight: '10px', padding: '8px' }} />
              <button onClick={handleCreateProject} className="action-button">Create Project</button>
            </div>
            <h3>Available Projects</h3>
            {projects.length === 0 && <p>No projects yet. Create one to get started!</p>}
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {projects.map(p => (
                <li key={p.id} style={{ marginBottom: '10px' }}>
                  <button 
                    onClick={() => setActiveProjectId(p.id)}
                    style={{ fontWeight: activeProjectId === p.id ? 'bold' : 'normal', background: activeProjectId === p.id ? '#e0f7fa' : '#f0f0f0', border: '1px solid #ccc', padding: '10px', borderRadius: '4px', width: '100%', textAlign: 'left' }}
                  >
                    <strong>{p.name}</strong><br/>
                    <small>{p.description}</small>
                  </button>
                </li>
              ))}
            </ul>
            {activeProject && <p><strong>Active Project: {activeProject.name}</strong></p>}
          </div>
        );
      case 'create':
        return (
          <div className="create-tab-content">
            {!activeProject && <p>Please select a project to manage templates and generate ZW.</p>}
            {activeProject && (
            <>
            <section className="project-schemas-section" aria-labelledby="project-schemas-heading">
                <h3 id="project-schemas-heading">Templates in Project: {activeProject.name}</h3>
                {activeProject.schemas.length === 0 ? (
                    <p>No templates defined for this project yet.</p>
                ) : (
                    <ul style={{listStyle:'none', padding:0, maxHeight:'150px', overflowY:'auto', border:'1px solid #eee', borderRadius:'4px'}}>
                    {activeProject.schemas.map(schema => (
                        <li key={schema.id} style={{padding:'5px', borderBottom:'1px solid #f0f0f0'}}>
                        <button onClick={() => handleLoadSchema(schema)} style={{background:'none', border:'none', color:'#007bff', cursor:'pointer', textAlign:'left', padding:0}}>
                            {schema.name}
                        </button>
                        </li>
                    ))}
                    </ul>
                )}
            </section>

            <section className="template-designer-section" aria-labelledby="template-designer-heading">
              <h2 id="template-designer-heading">Template Designer</h2>
              <div style={{ marginBottom: '10px' }}>
                <input 
                  type="text" 
                  value={currentSchemaName} 
                  onChange={(e) => setCurrentSchemaName(e.target.value)} 
                  placeholder="Template Name (e.g., DRAGON-MOOD)"
                  style={{ padding: '8px', marginRight: '10px', minWidth: '250px' }}
                  aria-label="Template Name Input"
                />
                <button onClick={handleSaveSchemaToProject} disabled={!activeProject || !currentSchemaName.trim()} className="action-button" style={{marginRight:'10px'}}>
                  {editingSchemaId ? 'Update Template in Project' : 'Save New Template to Project'}
                </button>
                <button onClick={handleNewTemplate} className="action-button secondary">New Template</button>
              </div>
              <div className="hybrid-editor-layout">
                <div className="code-editor-pane">
                  <label htmlFor="zw-template-input" className="sr-only">ZW Template Definition</label>
                  <textarea
                    id="zw-template-input"
                    value={templateDefinition}
                    onChange={(e) => setTemplateDefinition(e.target.value)}
                    placeholder={"Define ZW Template here...\ne.g., ZW-USER-INTENT:\n  SCOPE: Player\n  INTENT_PRIMARY: ..."}
                    aria-label="ZW Template Definition Input"
                    rows={15}
                  />
                </div>
                <div className="visual-pane">
                  <div className="visual-preview-pane" aria-label="Visual Preview of ZW Template">
                    <ZWTemplateVisualizer templateDefinition={templateDefinition} />
                  </div>
                  <div className="inspector-palette-pane" aria-label="Template Inspector and Palette">
                    <p>Inspector/Palette Area - Coming Soon!</p>
                  </div>
                </div>
              </div>
            </section>
            </>
            )}
            <section className="natural-language-generator-section" aria-labelledby="nl-generator-heading">
              <h2 id="nl-generator-heading">Natural Language to ZW {activeProject ? `(Context: ${activeProject.name})` : ''}</h2>
              {ai === null && <p style={{color: 'orange'}}>Warning: Gemini API key not configured. NL to ZW generation will be disabled.</p>}
              <label htmlFor="nl-scenario-input" className="sr-only">Natural Language Scenario</label>
              <textarea
                id="nl-scenario-input"
                value={nlScenario}
                onChange={(e) => setNlScenario(e.target.value)}
                placeholder="Describe the scenario or intent here... e.g., 'The player character feels a sudden chill and sees a ghostly figure in the distance.'"
                aria-label="Natural Language Scenario Input"
                rows={4}
                style={{ width: 'calc(100% - 22px)', marginBottom: '10px' }}
                disabled={!activeProject || ai === null}
              />
              <button 
                onClick={handleGenerateZWFromNL} 
                disabled={isGenerating || !activeProject || !nlScenario.trim() || ai === null}
                className="action-button"
                style={{marginRight: '10px'}}
              >
                {isGenerating && !userFeedbackForNL ? 'Generating...' : 'Generate ZW from NL'}
              </button>
              
              <div className="generated-zw-output" aria-live="polite" style={{marginTop: '15px'}}>
                {isGenerating && <p>Generating ZW packet...</p>}
                {generationError && <p style={{ color: 'red' }}>Error: {generationError}</p>}
                {generatedZWPacket && !isGenerating && !generationError && (
                  <>
                    <pre style={{whiteSpace:'pre-wrap', backgroundColor:'#f8f9f9', padding:'10px', borderRadius:'4px', border:'1px solid #ddd' }}>
                        {generatedZWPacket}
                    </pre>
                    <div style={{marginTop: '15px'}}>
                        <label htmlFor="nl-feedback-input" style={{display: 'block', marginBottom: '5px'}}>Suggest changes or refinements:</label>
                        <textarea
                            id="nl-feedback-input"
                            value={userFeedbackForNL}
                            onChange={(e) => setUserFeedbackForNL(e.target.value)}
                            placeholder="e.g., Change the mood to 'curious', add an item 'old_map'"
                            aria-label="Feedback for ZW refinement"
                            rows={3}
                            style={{ width: 'calc(100% - 22px)', marginBottom: '10px' }}
                            disabled={isGenerating || !generatedZWPacket.trim()}
                        />
                        <button
                            onClick={handleRefineZWFromNL}
                            disabled={isGenerating || !userFeedbackForNL.trim() || !generatedZWPacket.trim()}
                            className="action-button secondary"
                        >
                            {isGenerating && userFeedbackForNL ? 'Refining...' : 'Refine ZW with Feedback'}
                        </button>
                    </div>
                  </>
                )}
                {!generatedZWPacket && !isGenerating && !generationError && <p>Generated ZW packet will appear here.</p>}
              </div>
            </section>
          </div>
        );
      case 'validate':
        return (
          <div>
            <h2>Project-Aware Validator (Anti-JSON Algorithm)</h2>
            {!activeProject && <p>Please select a project to validate against its vocabulary.</p>}
            {activeProject && (
              <>
                <p>Validating against schemas in project: <strong>{activeProject.name}</strong></p>
                <label htmlFor="zw-validate-input" className="sr-only">ZW Content to Validate</label>
                <textarea
                  id="zw-validate-input"
                  value={zwToValidate}
                  onChange={(e) => { setZwToValidate(e.target.value); setValidationResults(null);}}
                  placeholder="Paste ZW content here to validate against active project's schemas..."
                  rows={10}
                  style={{ width: '100%', marginBottom: '10px', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
                  aria-label="ZW Content to Validate Input"
                />
                <button onClick={handleProjectAwareValidate} className="action-button">Validate Against Project Vocabulary</button>
                {validationResults && (
                  <div style={{ marginTop: '20px', padding: '15px', border: `1px solid ${validationResults.type === 'success' ? 'green' : validationResults.type === 'error' ? 'red' : 'blue'}`, borderRadius: '4px', backgroundColor: validationResults.type === 'success' ? '#e6ffed' : validationResults.type === 'error' ? '#ffe6e6' : '#e6f7ff' }}>
                    <p style={{fontWeight:'bold', color: validationResults.type === 'success' ? 'green' : validationResults.type === 'error' ? 'red' : 'blue' }}>
                      {validationResults.type.toUpperCase()}: {validationResults.message}
                    </p>
                    {validationResults.suggestions && validationResults.suggestions.length > 0 && (
                      <>
                        <p style={{marginTop:'10px'}}>Suggestions:</p>
                        <ul style={{paddingLeft:'20px', margin:0}}>
                          {validationResults.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        );
      case 'visualize':
        return (
          <div>
            <h2>Visualize ZW Content</h2>
            <p>Paste any ZW-formatted text below to see its visual structure. This tool works independently of projects.</p>
            <label htmlFor="zw-visualize-input" className="sr-only">ZW Content to Visualize</label>
            <textarea
              id="zw-visualize-input"
              value={zwToVisualize}
              onChange={(e) => setZwToVisualize(e.target.value)}
              placeholder="Paste ZW content here..."
              rows={15}
              style={{ width: '100%', marginBottom: '10px', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
              aria-label="ZW Content to Visualize Input"
            />
            <div className="visual-preview-pane" aria-label="Visual Preview of ZW Content">
              <ZWTemplateVisualizer templateDefinition={zwToVisualize} />
            </div>
          </div>
        );
      case 'export':
         return (
            <div>
              <h2>Export Project Artifacts</h2>
              {!activeProject && <p>Please select a project to export its artifacts.</p>}
              {activeProject && (
                <>
                  <p>Exporting for project: <strong>{activeProject.name}</strong></p>
                  <section style={{marginBottom:'20px'}}>
                    <h3>Export All Project Schemas/Templates</h3>
                    <p>This will bundle all defined templates for "{activeProject.name}" into a single file.</p>
                    <label htmlFor="bundle-filename" className="sr-only">Bundle Filename</label>
                    <input
                      type="text"
                      id="bundle-filename"
                      value={bundleFilename}
                      onChange={e => setBundleFilename(e.target.value)}
                      placeholder="templates_bundle.zw"
                      style={{ marginRight: '10px', padding: '8px' }}
                      aria-label="Filename for bundled templates"
                    />
                    <button onClick={handleExportAllTemplates} className="action-button" disabled={activeProject.schemas.length === 0}>
                      Export All Templates ({activeProject.schemas.length})
                    </button>
                    {exportStatus && (
                      <p role="status" style={{color: exportStatus.type === 'success' ? 'green' : 'red'}}>{exportStatus.message}</p>
                    )}
                  </section>
                  <hr/>
                  <section style={{marginTop:'20px'}}>
                    <h3>Export Currently Edited Template (from Create Tab)</h3>
                    <label htmlFor="template-filename-export" className="sr-only">Template Filename</label>
                    <input 
                      type="text"
                      id="template-filename-export" 
                      value={templateFilename} 
                      onChange={e => setTemplateFilename(e.target.value)} 
                      placeholder="template.zw"
                      style={{ marginRight: '10px', padding: '8px' }} 
                      aria-label="Filename for current template"
                    />
                    <button
                      onClick={() => {
                        const ok = downloadFile(templateDefinition, templateFilename);
                        setExportStatus(ok ? { type: 'success', message: 'Template exported successfully.' } : { type: 'error', message: 'Failed to export template.' });
                      }}
                      disabled={!templateDefinition.trim()}
                      className="action-button"
                    >
                      Download Current Template as .zw
                    </button>
                  </section>
                  <section style={{marginTop:'20px'}}>
                     <h3>Export Last Generated Packet (from NL Tool)</h3>
                     <label htmlFor="generated-packet-filename-export" className="sr-only">Generated Packet Filename</label>
                     <input 
                      type="text" 
                      id="generated-packet-filename-export"
                      value={generatedPacketFilename} 
                      onChange={e => setGeneratedPacketFilename(e.target.value)} 
                      placeholder="generated_packet.zw" 
                      style={{ marginRight: '10px', padding: '8px' }}
                      aria-label="Filename for generated packet"
                    />
                     <button
                        onClick={() => {
                          const ok = downloadFile(generatedZWPacket, generatedPacketFilename);
                          setExportStatus(ok ? { type: 'success', message: 'Generated packet exported successfully.' } : { type: 'error', message: 'Failed to export packet.' });
                        }}
                        className="action-button"
                        disabled={!generatedZWPacket.trim()}
                      >
                        Download Generated Packet as .zw
                      </button>
                  </section>
                </>
              )}
            </div>
          );
      case 'library':
        return <div>Project-Specific Template & Pattern Library - Coming Soon! (Will browse schemas of "{activeProject?.name || 'No Active Project'}")</div>;
      default:
        const _exhaustiveCheck: never = activeTab;
        console.error('Unhandled tab:', activeTab, _exhaustiveCheck); 
        return <div>Select a tab</div>;
    }
  };

  const TabButton: React.FC<{tabKey: TabKey, label: string, icon?: string}> = ({ tabKey, label, icon }) => (
    <button
      onClick={() => setActiveTab(tabKey)}
      className={activeTab === tabKey ? 'active' : ''}
      aria-pressed={activeTab === tabKey}
      role="tab"
      aria-selected={activeTab === tabKey}
      aria-controls={`tabpanel-${tabKey}`} // Ensure tabpanel elements have matching IDs if implementing full tab panel semantics
      id={`tab-${tabKey}`}
    >
      {icon && <span aria-hidden="true" style={{marginRight: '8px'}}>{icon}</span>}
      {label}
    </button>
  );

  return (
    <div className="app-container">
      <header role="banner">ZW Transformer - Consciousness Interface Designer</header>
      <nav className="tabs" role="tablist" aria-label="Main navigation">
        <TabButton tabKey="projects" label="Projects" icon="🌍" />
        <TabButton tabKey="create" label="Create" icon="📝" />
        <TabButton tabKey="validate" label="Validate" icon="✅" />
        <TabButton tabKey="visualize" label="Visualize" icon="👁️" />
        <TabButton tabKey="export" label="Export" icon="📤" />
        <TabButton tabKey="library" label="Library" icon="📚" />
      </nav>
      <main className="tab-content" role="main" aria-live="polite">
        {renderTabContent()}
      </main>
      <footer role="contentinfo"><p>&copy; {new Date().getFullYear()} EngAIn Systems - Ziegelwagga Project</p></footer>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
} else {
  console.error("Failed to find the root element for React. Ensure an element with ID 'root' exists in your HTML.");
}
      
// TODO:
// - More robust ZW parsing and validation.
// - Full implementation of Inspector/Palette for visual template design.
// - Semantic validation of ZW packets against templates.
// - Advanced NL-to-ZW features (e.g., context memory over multiple refinements if switching to Chat API).
// - Library features: browsing, searching, importing/exporting community patterns.
// - Error boundaries and more granular error handling.
// - Consider extracting ZWParser and ZWValidator into their own modules.
// - Add unique IDs to all tabpanel elements to match aria-controls.
