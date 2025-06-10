
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import ZWTemplateVisualizer from './ZWTemplateVisualizer';
import ZWSyntaxHighlighter from './ZWSyntaxHighlighter'; // Import the new highlighter
import AutoCompleteDropdown from './AutoCompleteDropdown'; // Import AutoCompleteDropdown
import CopyButton from './CopyButton'; // Import the new CopyButton
import AIService, { AIConfig, createAIService } from './aiService';
import AIConfigPanel from './AIConfigPanel';
import { ZWNode, ZWListItem, parseZW } from './zwParser';
import { convertZwToGodot } from './zwToGodotScript'; // Import Godot converter
import { convertJsonToZwString } from './jsonToZw'; // Import JSON to ZW converter
import { convertZwToJsonObject } from './zwToJson'; // Import ZW to JSON converter

// --- App Component ---
type TabKey = 'projects' | 'create' | 'validate' | 'visualize' | 'export' | 'library' | 'guide';

interface ZWSchemaComment {
  id: string;
  text: string;
  timestamp: string;
}

interface ZWSchemaDefinition {
  id: string;
  name: string;
  definition: string;
  comments?: ZWSchemaComment[];
  nlOrigin?: string; // Added field for Natural Language Origin
}

interface Project {
  id: string;
  name: string;
  description: string;
  schemas: ZWSchemaDefinition[];
}

interface ValidationFeedback {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  details?: string[];
  suggestions?: string[];
}

const LOCAL_STORAGE_PROJECTS_KEY = 'zwTransformerProjects';
const LOCAL_STORAGE_ACTIVE_PROJECT_ID_KEY = 'zwTransformerActiveProjectId';

// Example Templates (Moved here for clarity and easier management)
const EXAMPLE_USER_PROFILE_NL = `Create a user profile for a user with ID 'user_123', display name 'Alex', email 'alex@example.com', and avatar 'https://example.com/avatars/alex.png'. Their status is 'Online', and they prefer a dark theme, notifications enabled, and language set to 'en_US'. Tag them as 'gamer', 'developer', and 'sci-fi_fan'.`;
const EXAMPLE_USER_PROFILE_ZW = `ZW-USER-PROFILE:
  USER_ID: "user_123"
  DISPLAY_NAME: "Alex"
  EMAIL: "alex@example.com"
  AVATAR_URL: "https://example.com/avatars/alex.png"
  STATUS: "Online"
  PREFERENCES:
    THEME: "dark"
    NOTIFICATIONS_ENABLED: true
    LANGUAGE: "en_US"
  TAGS:
    - "gamer"
    - "developer"
    - "sci-fi_fan"
# This template stores basic user profile information and preferences.
# It demonstrates simple key-value pairs, nested sections, and lists.`;

const EXAMPLE_NARRATIVE_EVENT_NL = `Draft a narrative event: Captain Eva Rostova is on the bridge of a derelict spaceship. The goal is to introduce a mysterious artifact and her reaction, leading to a new objective. The mood is eerie and expectant. She brushes dust off a console, it activates showing alien script and a holographic orb (this is an ANCHOR point 'ArtifactActivated' and a FOCUS beat). Eva says, 'What in the void...? Never seen anything like this.' (DIALOGUE_ID: 'Eva_ArtifactReaction_01', EMOTION_TAG: 'Startled'). This triggers a new objective (LINKED_QUEST: 'InvestigateAlienTech'). Include metadata like author, version, and scene reference.`;
const EXAMPLE_NARRATIVE_EVENT_ZW = `ZW-NARRATIVE-EVENT:
  SCENE_GOAL: "Introduce a mysterious artifact and a character's immediate reaction, leading to a new objective."
  EVENT_ID: "artifact_discovery_001"
  FOCUS: true # Marks this event as a critical narrative beat.

  SETTING:
    LOCATION: "Dusty Derelict Spaceship - Bridge"
    TIME_OF_DAY: "Ship Time: 14:32"
    MOOD: "Eerie, Silent, Expectant"

  CHARACTERS_INVOLVED:
    - NAME: "Captain Eva Rostova"
      ROLE: "Player Character / Explorer"
      CURRENT_EMOTION: "Cautious"

  SEQUENCE: # For simplicity here; actual generation might use SEQUENCE_PARTS for complexity
    - TYPE: ACTION
      ACTOR: "Eva Rostova"
      ACTION: "Brushes dust off a dormant console."
      SFX_SUGGESTION: "soft_brushing_cloth_metal.ogg"
    - TYPE: EVENT
      DESCRIPTION: "The console flickers to life, displaying an unknown alien script and a holographic orb."
      ANCHOR: "ArtifactActivated" # Key moment for potential branching or state change.
      VFX_SUGGESTION: "hologram_flicker_reveal.anim"
    - TYPE: DIALOGUE
      ACTOR: "Eva Rostova"
      DIALOGUE_ID: "Eva_ArtifactReaction_01"
      CONTENT: "What in the void...? Never seen anything like this."
      EMOTION_TAG: "Startled" # Using a controlled vocabulary.
      DELIVERY_NOTE: "Whispered, voice filled with awe and apprehension."
    - TYPE: OBJECTIVE_UPDATE
      LINKED_QUEST: "InvestigateAlienTech" # Connects to a potential quest system.
      STATUS: "NEW"
      OBJECTIVE_TEXT: "Investigate the alien orb and decipher the script."

  META:
    AUTHOR: "ZW Transformer Example"
    VERSION: "1.0"
    SCENE_REFERENCE: "Chapter1_BridgeEncounter"
    TRIGGER_CONDITION: "Player enters Bridge after power restoration."
    TAGS: ["discovery", "mystery", "alien_tech", "first_contact_incipient"]
# This ZW-NARRATIVE-EVENT template demonstrates a structured approach to defining
# interactive story moments, suitable for game engines and AI narrative systems.
# It includes character actions, environmental details, dialogue, and metadata.`;

const EXAMPLE_SIMPLE_TASK_NL = `Define a critical task with ID 'task_456' titled 'Investigate Anomaly in Sector Gamma-7'. Description: Pilot the scout ship to Sector Gamma-7 and perform a full sensor sweep of the reported energy signature. Assign it to 'eva_rostova_crew_id' with status 'Assigned', due by 'Ship Time: Cycle 3, Day 18:00'. List sub-tasks like pre-flight check, plot course, scan, approach, detailed sweep, and report. Required resources are 'Scout Ship Nomad' and 'Full Sensor Suite'.`;
const EXAMPLE_SIMPLE_TASK_ZW = `ZW-SIMPLE-TASK:
  TASK_ID: "task_456"
  TITLE: "Investigate Anomaly in Sector Gamma-7"
  DESCRIPTION: "Pilot the scout ship to Sector Gamma-7 and perform a full sensor sweep of the reported energy signature."
  PRIORITY: "Critical"
  STATUS: "Assigned" # e.g., Pending, Assigned, InProgress, Blocked, Completed
  ASSIGNEE_ID: "eva_rostova_crew_id"
  DUE_DATE: "Ship Time: Cycle 3, Day 18:00"
  SUB_TASKS:
    - "Pre-flight check Scout Ship 'Nomad'"
    - "Plot course to Gamma-7"
    - "Perform initial long-range scan"
    - "Approach anomaly cautiously"
    - "Execute detailed sensor sweep protocol"
    - "Report findings to Command"
  RESOURCES_REQUIRED:
    - "Scout Ship 'Nomad'"
    - "Full Sensor Suite"
# This template outlines a simple task or mission, useful for tracking objectives
# or procedural content generation in a game or simulation.`;


const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('create');
  // Projects State
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');

  // Create Tab State
  const [templateName, setTemplateName] = useState('');
  const [templateDefinition, setTemplateDefinition] = useState('');
  const [templateIdToEdit, setTemplateIdToEdit] = useState<string | null>(null);
  const [schemaComments, setSchemaComments] = useState<ZWSchemaComment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [currentSchemaNlOrigin, setCurrentSchemaNlOrigin] = useState<string | undefined>(undefined);


  const [nlScenario, setNlScenario] = useState('');
  const [generatedZWPacket, setGeneratedZWPacket] = useState('');
  const [refinementSuggestion, setRefinementSuggestion] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isNarrativeFocusEnabled, setIsNarrativeFocusEnabled] = useState(true);

  const [aiConfig, setAiConfig] = useState<AIConfig>({
    provider: 'ollama',
    ollamaBaseUrl: 'http://localhost:11434',
    ollamaModel: 'llama3.2:latest',
    temperature: 0.7,
    maxTokens: 4096
  });
  const [aiService, setAiService] = useState<AIService | null>(null);


  // Validation Tab State
  const [zwToValidate, setZwToValidate] = useState('');
  const [validationFeedback, setValidationFeedback] = useState<ValidationFeedback[]>([]);

  // Visualize Tab State
  const [zwToVisualize, setZwToVisualize] = useState('');
  const [jsonToConvertInput, setJsonToConvertInput] = useState('');
  const [jsonRootZwTypeInput, setJsonRootZwTypeInput] = useState('ZW-FROM-JSON');
  const [visualizedZwAsJsonString, setVisualizedZwAsJsonString] = useState('');


  // Export Tab State
  const [exportFilename, setExportFilename] = useState('zw_export.txt');
  const [exportAllFilename, setExportAllFilename] = useState('project_schemas.txt');
  const [godotExportFilename, setGodotExportFilename] = useState('schema_export.gd');


  // Auto-completion state
  const [autoCompleteSuggestions, setAutoCompleteSuggestions] = useState<string[]>([]);
  const [showAutoComplete, setShowAutoComplete] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [autoCompletePosition, setAutoCompletePosition] = useState({ top: 0, left: 0 });
  const templateTextareaRef = useRef<HTMLTextAreaElement>(null);

  const activeProject = projects.find(p => p.id === activeProjectId);

  // --- Utility Functions ---
  const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const downloadFile = (filename: string, content: string, contentType: string = 'text/plain') => {
    const element = document.createElement('a');
    const file = new Blob([content], { type: contentType });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // --- Project Management ---
  useEffect(() => {
    const storedProjects = localStorage.getItem(LOCAL_STORAGE_PROJECTS_KEY);
    if (storedProjects) {
      setProjects(JSON.parse(storedProjects));
    }
    const storedActiveProjectId = localStorage.getItem(LOCAL_STORAGE_ACTIVE_PROJECT_ID_KEY);
    if (storedActiveProjectId) {
      setActiveProjectId(storedActiveProjectId);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_PROJECTS_KEY, JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    if (activeProjectId) {
      localStorage.setItem(LOCAL_STORAGE_ACTIVE_PROJECT_ID_KEY, activeProjectId);
    } else {
      localStorage.removeItem(LOCAL_STORAGE_ACTIVE_PROJECT_ID_KEY);
    }
  }, [activeProjectId]);

  useEffect(() => {
    const savedConfig = localStorage.getItem('zwTransformerAIConfig');
    let configToUse = aiConfig;
    if (savedConfig) {
      try {
        const parsedConfig = JSON.parse(savedConfig);
        setAiConfig(parsedConfig);
        configToUse = parsedConfig;
      } catch (error) {
        console.error('Failed to parse saved AI config:', error);
      }
    }

    const service = createAIService(configToUse);
    setAiService(service);
  }, []);

  const handleAIConfigChange = (newConfig: AIConfig) => {
    setAiConfig(newConfig);
    localStorage.setItem('zwTransformerAIConfig', JSON.stringify(newConfig));
  };

  const handleAIServiceUpdate = (newService: AIService) => {
    setAiService(newService);
  };

  const handleCreateProject = () => {
    if (!newProjectName.trim()) {
      alert('Project name cannot be empty.');
      return;
    }
    const newProject: Project = {
      id: generateId(),
      name: newProjectName,
      description: newProjectDescription,
      schemas: [],
    };
    setProjects(prev => [...prev, newProject]);
    setActiveProjectId(newProject.id);
    setNewProjectName('');
    setNewProjectDescription('');
  };

  const handleDeleteProject = (projectId: string) => {
    if (window.confirm("Are you sure you want to delete this project and all its schemas? This action cannot be undone.")) {
      setProjects(prev => prev.filter(p => p.id !== projectId));
      if (activeProjectId === projectId) {
        setActiveProjectId(null);
        // Clear create tab if active project was deleted
        handleNewTemplate();
      }
    }
  };

  const handleSetActiveProject = (projectId: string) => {
    setActiveProjectId(projectId);
    // When project changes, clear the create tab for a fresh start or load first schema
    handleNewTemplate();
  };

  const handleLoadExampleTemplates = () => {
    const exampleProjectName = "Example ZW Templates";
    let exampleProject = projects.find(p => p.name === exampleProjectName);
    let projectExisted = !!exampleProject;

    const examples: { name: string; definition: string; nlOrigin: string; commentsText?: string }[] = [
        {
            name: "User Profile",
            definition: EXAMPLE_USER_PROFILE_ZW,
            nlOrigin: EXAMPLE_USER_PROFILE_NL,
            commentsText: "This template stores basic user profile information and preferences. It demonstrates simple key-value pairs, nested sections, and lists."
        },
        {
            name: "Narrative Event (Gold Standard)",
            definition: EXAMPLE_NARRATIVE_EVENT_ZW,
            nlOrigin: EXAMPLE_NARRATIVE_EVENT_NL,
            commentsText: "This ZW-NARRATIVE-EVENT template demonstrates a structured approach to defining interactive story moments, suitable for game engines and AI narrative systems. It includes character actions, environmental details, dialogue, and metadata."
        },
        {
            name: "Simple Task",
            definition: EXAMPLE_SIMPLE_TASK_ZW,
            nlOrigin: EXAMPLE_SIMPLE_TASK_NL,
            commentsText: "This template outlines a simple task or mission, useful for tracking objectives or procedural content generation in a game or simulation."
        }
    ];
    
    let currentExampleProjectId = exampleProject?.id;

    if (!projectExisted) {
        const newExampleProjectData: Project = {
            id: generateId(),
            name: exampleProjectName,
            description: "Pre-loaded example templates to demonstrate ZW usage.",
            schemas: [],
        };
        currentExampleProjectId = newExampleProjectData.id;
        setProjects(prev => [...prev, newExampleProjectData]); 
        // Wait for state update if project is new before modifying its schemas
        // This is tricky due to async nature of setState. We'll update it in the map function below.
    }


    setProjects(prevProjects => {
        return prevProjects.map(p => {
             // If it's a newly created project or an existing one.
            if (p.id === currentExampleProjectId || (projectExisted && p.name === exampleProjectName)) {
                const updatedSchemas = [...p.schemas];
                let schemasAddedCount = 0;
                examples.forEach(ex => {
                    if (!p.schemas.some(s => s.name === ex.name)) { // Avoid duplicates by name
                        const newSchema: ZWSchemaDefinition = {
                            id: generateId(),
                            name: ex.name,
                            definition: ex.definition,
                            nlOrigin: ex.nlOrigin,
                            comments: ex.commentsText ? [{ id: generateId(), text: ex.commentsText, timestamp: new Date().toISOString() }] : [],
                        };
                        updatedSchemas.push(newSchema);
                        schemasAddedCount++;
                    }
                });
                 if (schemasAddedCount > 0 || !projectExisted) { // If new schemas added or it's a brand new project
                    if (currentExampleProjectId) setActiveProjectId(currentExampleProjectId);
                    alert(`${exampleProjectName} ${!projectExisted ? 'created' : 'updated'} with ${schemasAddedCount} new template(s) and set as active project.`);
                 } else {
                    if (currentExampleProjectId) setActiveProjectId(currentExampleProjectId);
                    alert(`${exampleProjectName} is already up to date and set as active project.`);
                 }

                // Optionally, load the first example template into the Create tab
                if (schemasAddedCount > 0 || !projectExisted) {
                    const firstExampleSchemaDetails = examples[0];
                    const schemaToLoad = updatedSchemas.find(s => s.name === firstExampleSchemaDetails.name);
                    if(schemaToLoad) handleLoadSchema(schemaToLoad);
                }
                return { ...p, schemas: updatedSchemas };
            }
            return p;
        });
    });
};


  // --- Template Management (Create Tab) ---
  const handleNewTemplate = () => {
    setTemplateName('');
    setTemplateDefinition('');
    setTemplateIdToEdit(null);
    setSchemaComments([]);
    setCurrentSchemaNlOrigin(undefined);
  };

  const handleSaveSchemaToProject = () => {
    if (!activeProject) {
      alert('Please select or create a project first.');
      return;
    }
    if (!templateName.trim()) {
      alert('Template name cannot be empty.');
      return;
    }
    if (!templateDefinition.trim()) {
      alert('Template definition cannot be empty.');
      return;
    }

    setProjects(prevProjects =>
      prevProjects.map(p => {
        if (p.id === activeProjectId) {
          let updatedSchemas;
          if (templateIdToEdit) { // Editing existing schema
            updatedSchemas = p.schemas.map(s =>
              s.id === templateIdToEdit ? { ...s, name: templateName, definition: templateDefinition, comments: schemaComments, nlOrigin: currentSchemaNlOrigin } : s
            );
          } else { // Saving new schema
            const newSchema: ZWSchemaDefinition = {
              id: generateId(),
              name: templateName,
              definition: templateDefinition,
              comments: schemaComments,
              nlOrigin: currentSchemaNlOrigin // Future: Allow user to set this
            };
            updatedSchemas = [...p.schemas, newSchema];
            setTemplateIdToEdit(newSchema.id); // Set ID for further edits
          }
          return { ...p, schemas: updatedSchemas };
        }
        return p;
      })
    );
    alert(`Template "${templateName}" saved to project "${activeProject.name}".`);
  };

  const handleLoadSchema = (schema: ZWSchemaDefinition) => {
    setTemplateName(schema.name);
    setTemplateDefinition(schema.definition);
    setTemplateIdToEdit(schema.id);
    setSchemaComments(schema.comments || []);
    setCurrentSchemaNlOrigin(schema.nlOrigin);
    setActiveTab('create'); // Switch to create tab if not already there
  };

  const handleDeleteSchema = (schemaId: string) => {
    if (!activeProject) return;
    if (window.confirm("Are you sure you want to delete this template?")) {
      setProjects(prevProjects =>
        prevProjects.map(p => {
          if (p.id === activeProjectId) {
            const updatedSchemas = p.schemas.filter(s => s.id !== schemaId);
            return { ...p, schemas: updatedSchemas };
          }
          return p;
        })
      );
      if (templateIdToEdit === schemaId) {
        handleNewTemplate(); // Clear editor if deleted template was loaded
      }
      alert("Template deleted.");
    }
  };

  const handleAddComment = () => {
    if (!newCommentText.trim()) return;
    const newComment: ZWSchemaComment = {
      id: generateId(),
      text: newCommentText,
      timestamp: new Date().toISOString()
    };
    setSchemaComments(prev => [...prev, newComment]);
    setNewCommentText('');
  };

  const handleDeleteComment = (commentId: string) => {
    setSchemaComments(prev => prev.filter(c => c.id !== commentId));
  };


  // --- AI Service Interaction ---
  const getNarrativeFocusPrompt = (scenario: string, projectTemplates?: ZWSchemaDefinition[]) => {
    let prompt = `You are an expert in narrative design and game development, specializing in the ZW (Ziegelwagga) consciousness pattern language.
The user wants to generate a ZW packet for the following scenario:
"${scenario}"

Your primary goal is to structure this scenario into a ZW-NARRATIVE-SCENE packet. This format is designed for cinematic game scripting, AI story management, and emotional choreography.

Key elements to include in ZW-NARRATIVE-SCENE (if applicable based on the scenario):

1.  SCENE_GOAL: (Root) A concise summary of the scene's narrative purpose.
2.  EVENT_ID: (Root) A unique identifier for this event or scene.
3.  FOCUS: (Root or within SEQUENCE items) Boolean (true) to mark critical narrative or emotional beats.
4.  SETTING: Section for LOCATION, TIME_OF_DAY, MOOD.
5.  CHARACTERS_INVOLVED: List of characters with NAME, ROLE, CURRENT_EMOTION.
6.  SEQUENCE_PARTS: (Optional, for longer scenes) A list of parts, each with a LABEL (e.g., "ArrivalAndVillage") and EVENTS (a list of sequence items). If not using SEQUENCE_PARTS, use a single SEQUENCE list directly.
7.  SEQUENCE: A list of events, dialogues, actions in order. Each item should have a TYPE (e.g., DIALOGUE, ACTION, EVENT, OBSERVATION, EMOTIONAL_BEAT).
    *   For DIALOGUE: include ACTOR, DIALOGUE_ID (unique for branching/memory), CONTENT, EMOTION_TAG (use a consistent, controlled vocabulary like Startled, Determined, Joyful, Anxious, Ominous), DELIVERY_NOTE (optional).
    *   For ACTION: include ACTOR, ACTION (concise description, e.g., "Opens the creaky door"), TARGET (optional). Consider moving detailed narrative framing into a child META or comment.
    *   For EVENT: include DESCRIPTION, ANCHOR (optional, unique ID for timeline jumps, e.g., "AwakeningTrigger_CombatPhaseStart").
8.  OBJECTIVE_UPDATE: (Optional, can be a SEQUENCE item) To modify game objectives. Include LINKED_QUEST (ID for quest system), STATUS, OBJECTIVE_TEXT.
9.  META: (Root) A block for production metadata: AUTHOR, VERSION, SCENE_REFERENCE, TIMESTAMP (in-game or real), TRIGGER_CONDITION, TAGS (list of relevant themes or keywords like "discovery", "betrayal"), QUESTS_STARTED, QUESTS_COMPLETED, ANCHORS_SET.

Prioritize user-defined templates from their project if they seem more appropriate than the generic ZW-NARRATIVE-SCENE for the given scenario.
Here are the available project templates (use the ZW Type as the primary key, e.g., ZW-MY-CUSTOM-EVENT):
`;

    if (projectTemplates && projectTemplates.length > 0) {
      projectTemplates.forEach(schema => {
        prompt += `\nSchema Name: ${schema.name}\n${schema.definition}\n---\n`;
      });
      prompt += "\nIf one of these project templates is a better fit for the user's scenario, please use that ZW Type and structure instead of ZW-NARRATIVE-SCENE. Adapt the scenario to the chosen template's fields.\n";
    } else {
      prompt += "\nNo specific project templates provided. Use the ZW-NARRATIVE-SCENE structure as described above.\n";
    }

    prompt += `
Example of ZW-NARRATIVE-SCENE structure:
ZW-NARRATIVE-SCENE:
  SCENE_GOAL: "Introduce protagonists, trigger awakening, establish threat, pivot to escape and revelation arc."
  EVENT_ID: "CH1_SC01_Intro"
  FOCUS: true
  SETTING:
    LOCATION: "Old Observatory - Control Room"
    TIME_OF_DAY: "Night, Stormy"
    MOOD: "Suspenseful, Foreboding"
  CHARACTERS_INVOLVED:
    - NAME: "Keen"
      ROLE: "Protagonist, Scientist"
      CURRENT_EMOTION: "Anxious"
    - NAME: "Garic"
      ROLE: "Mentor, Lead Researcher"
      CURRENT_EMOTION: "Concerned"
  SEQUENCE_PARTS: # Example of breaking down a scene
    - LABEL: "Initial tremors and system failure"
      EVENTS:
        - TYPE: EVENT
          DESCRIPTION: "The ground trembles. Red emergency lights flash. Alarms blare."
          SFX_SUGGESTION: "rumble_deep.ogg, alarm_klaxon_loop.ogg"
        - TYPE: DIALOGUE
          ACTOR: "Keen"
          DIALOGUE_ID: "Keen_TremorReaction_001"
          CONTENT: "What was that? Main power is offline!"
          EMOTION_TAG: "Startled"
          FOCUS: true
        - TYPE: ACTION
          ACTOR: "Garic"
          ACTION: "Checks secondary console, grimaces."
          DESCRIPTION: "Frantically types on the auxiliary power console."
    - LABEL: "The Anomaly Appears"
      EVENTS:
        - TYPE: EVENT
          DESCRIPTION: "A blinding light erupts from the main telescope array. Consoles spark."
          ANCHOR: "AnomalyAppearance"
          VFX_SUGGESTION: "bright_flash_energy_surge.anim"
          FOCUS: true
        - TYPE: DIALOGUE
          ACTOR: "Garic"
          DIALOGUE_ID: "Garic_AnomalyWarning_001"
          LINKED_QUEST: "InvestigateTheAnomaly" # Potentially starts a quest
          CONTENT: "It's... it's not stable! We need to get out of here, Keen!"
          EMOTION_TAG: "Frantic"
          DELIVERY_NOTE: "Shouted over the noise."
  META:
    AUTHOR: "Narrative AI Assistant"
    VERSION: "0.8"
    SCENE_REFERENCE: "Chapter1_ObservatoryAttack"
    TRIGGER_CONDITION: "Player completes tutorial"
    TAGS: ["anomaly", "escape", "tech_failure"]
    QUESTS_STARTED: ["InvestigateTheAnomaly"]
    ANCHORS_SET: ["AnomalyAppearance"]

Generate ONLY the ZW packet. Do not include any explanatory text before or after the ZW block.
The ZW packet should be well-formed and adhere to the ZW syntax (indented key-value pairs, lists with '-').
`;
    return prompt;
  };

  const handleGenerateZWFromNL = async () => {
    if (!aiService) {
      alert("AI service not initialized. Please configure your AI provider in the settings.");
      return;
    }
    if (!nlScenario.trim()) {
      alert('Please enter a natural language scenario.');
      return;
    }
    setIsGenerating(true);
    setGeneratedZWPacket('');
    setValidationFeedback([]);

    let prompt = "";
    if (isNarrativeFocusEnabled) {
        prompt = getNarrativeFocusPrompt(nlScenario, activeProject?.schemas);
    } else {
        prompt = `You are an expert in the ZW (Ziegelwagga) consciousness pattern language.
Convert the following natural language scenario into a ZW packet.
If project-specific templates are provided below, prioritize using them if they fit the scenario.
The ZW packet should be well-formed (indented key-value pairs, lists with '-').
Generate ONLY the ZW packet.

Scenario: "${nlScenario}"
`;
        if (activeProject && activeProject.schemas.length > 0) {
            prompt += "\nAvailable Project Templates (use the ZW Type as the primary key):\n";
            activeProject.schemas.forEach(schema => {
                prompt += `\nSchema Name: ${schema.name}\n${schema.definition}\n---\n`;
            });
        } else {
            prompt += "\nNo specific project templates provided. Infer a suitable ZW structure and start the packet with 'ZW-INFERRED-DATA:' on its own line.\n";
        }
    }


    try {
      const text = await aiService.generateText(prompt, {
        provider: aiConfig.provider,
        model: aiConfig.provider === 'ollama' ? aiConfig.ollamaModel : undefined,
        temperature: aiConfig.temperature
      });
      setGeneratedZWPacket(text);
      // Automatically validate the generated packet
      validateZwContent(text, 'Generated Packet Validation');
    } catch (error) {
      console.error('Error generating ZW from NL:', error);
      alert(`Error generating ZW: ${error instanceof Error ? error.message : String(error)}`);
      setGeneratedZWPacket(`# Error generating ZW: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefineZWFromNL = async () => {
    if (!aiService) {
      alert("AI service not initialized. Please configure your AI provider in the settings.");
      return;
    }
    if (!generatedZWPacket.trim()) {
      alert('No ZW packet to refine. Please generate one first.');
      return;
    }
    if (!refinementSuggestion.trim()) {
      alert('Please enter a refinement suggestion.');
      return;
    }
    setIsGenerating(true);

    const prompt = `You are an expert in the ZW (Ziegelwagga) consciousness pattern language.
The user has a ZW packet and wants to refine it based on their suggestion.
Original ZW Packet:
${generatedZWPacket}

User's Refinement Suggestion: "${refinementSuggestion}"

Please apply the suggestion and return the refined ZW packet.
If the suggestion is unclear or impossible to apply directly to ZW structure, explain why in comments within the ZW packet itself if possible, or try your best to interpret the user's intent.
Ensure the refined packet is well-formed.
Generate ONLY the refined ZW packet.
`;
    try {
      const text = await aiService.generateText(prompt, {
        provider: aiConfig.provider,
        model: aiConfig.provider === 'ollama' ? aiConfig.ollamaModel : undefined,
        temperature: aiConfig.temperature
      });
      setGeneratedZWPacket(text);
      setRefinementSuggestion(''); // Clear suggestion after use
      validateZwContent(text, 'Refined Packet Validation');
    } catch (error) {
      console.error('Error refining ZW:', error);
      alert(`Error refining ZW: ${error instanceof Error ? error.message : String(error)}`);
      setGeneratedZWPacket(`# Error refining ZW: ${generatedZWPacket}\n# Refinement failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // --- Validation ---
  const validateZwContent = (content: string, contextLabel: string = "Validation"): ZWNode | null => {
    const parsed = parseZW(content);
    const newFeedback: ValidationFeedback[] = [];

    if (!content.trim()) {
      newFeedback.push({ type: 'info', message: `${contextLabel}: No content to validate.` });
      setValidationFeedback(prev => [...prev, ...newFeedback]); // Append new feedback
      return null;
    }

    if (!parsed) {
      newFeedback.push({ type: 'error', message: `${contextLabel}: Content could not be parsed. Is it empty or malformed?` });
    } else if (parsed.key.startsWith('Error:')) {
      newFeedback.push({ type: 'error', message: `${contextLabel}: Parsing Error - ${parsed.key}`, details: typeof parsed.value === 'string' ? [parsed.value] : undefined });
    } else {
      newFeedback.push({ type: 'success', message: `${contextLabel}: ZW syntax appears valid. Root Type: ${parsed.key}` });

      // Project-specific validation
      if (activeProject && activeProject.schemas.length > 0) {
        const matchingSchema = activeProject.schemas.find(s => {
          const schemaRootMatch = s.definition.match(/^([A-Z0-9_-]+(?:-[A-Z0-9_-]+)*):/i);
          return schemaRootMatch ? schemaRootMatch[1] === parsed.key : false;
        });

        if (matchingSchema) {
          newFeedback.push({ type: 'info', message: `Root type "${parsed.key}" matches schema "${matchingSchema.name}" in project "${activeProject.name}".` });
          
          const schemaParsed = parseZW(matchingSchema.definition);
          if (schemaParsed && !schemaParsed.key.startsWith('Error:') && Array.isArray(parsed.value) && Array.isArray(schemaParsed.value)) {
            const inputKeys = (parsed.value as Array<ZWNode | ZWListItem>)
                .filter((item): item is ZWNode => 'key' in item && item.key !== undefined)
                .map(node => node.key);

            const schemaKeys = (schemaParsed.value as Array<ZWNode | ZWListItem>)
                .filter((item): item is ZWNode => 'key' in item && item.key !== undefined)
                .map(node => node.key);
            
            const missingKeys = schemaKeys.filter(key => !inputKeys.includes(key));
            const extraKeys = inputKeys.filter(key => !schemaKeys.includes(key));

            if (missingKeys.length > 0) {
              newFeedback.push({ type: 'warning', message: `Potential Missing Keys compared to schema "${matchingSchema.name}":`, details: missingKeys });
            }
            if (extraKeys.length > 0) {
              newFeedback.push({ type: 'info', message: `Additional Keys not in schema "${matchingSchema.name}" (may be intentional):`, details: extraKeys });
            }
            if (missingKeys.length === 0 && extraKeys.length === 0) {
                newFeedback.push({ type: 'success', message: `Top-level keys match schema "${matchingSchema.name}".` });
            }

          } else if (schemaParsed && schemaParsed.key.startsWith('Error:')) {
            newFeedback.push({ type: 'warning', message: `Could not parse matching schema "${matchingSchema.name}" for detailed key comparison. Error: ${schemaParsed.key}` });
          }
        } else {
          newFeedback.push({ type: 'warning', message: `Root type "${parsed.key}" does not match any schema root types in project "${activeProject.name}".` });
        }
      } else {
        newFeedback.push({ type: 'info', message: `${contextLabel}: No active project schemas to compare against.` });
      }
    }
    // Append new feedback instead of overwriting, especially for auto-validation.
    // If this is a manual click, it might be better to clear first.
    if (contextLabel === 'User Input Validation' || contextLabel === 'JSON to ZW Conversion Validation') {
        setValidationFeedback(newFeedback); // Overwrite for manual validation actions
    } else {
        setValidationFeedback(prev => [...prev, ...newFeedback]); // Append for auto-validations
    }
    return parsed;
  };

  const handleValidateZW = () => {
    setValidationFeedback([]); // Clear previous feedback before new validation
    validateZwContent(zwToValidate, 'User Input Validation');
  };

  // --- JSON to ZW Conversion (Visualize Tab) ---
  const handleConvertJsonAndVisualize = () => {
    if (!jsonToConvertInput.trim()) {
      setZwToVisualize("# Enter JSON content above and click convert.");
      setValidationFeedback([]);
      return;
    }
    const convertedZw = convertJsonToZwString(jsonToConvertInput, jsonRootZwTypeInput);
    setZwToVisualize(convertedZw);
    setValidationFeedback([]); // Clear previous validation
    validateZwContent(convertedZw, 'JSON to ZW Conversion Validation'); 
  };

  // --- ZW to JSON Conversion (Visualize Tab) ---
  const handleConvertVisualizedZwToJson = () => {
    if (!zwToVisualize.trim()) {
      setVisualizedZwAsJsonString('// No ZW content in the visualizer to convert.');
      return;
    }
    const jsonObject = convertZwToJsonObject(zwToVisualize);
    if (jsonObject) {
      setVisualizedZwAsJsonString(JSON.stringify(jsonObject, null, 2));
    } else {
      setVisualizedZwAsJsonString('// Error: Could not convert ZW to JSON. Check console for ZW parsing errors or if the ZW structure does not represent a valid JSON object.');
    }
  };


  // --- Export ---
  const handleExportCurrentTemplate = () => {
    if (!templateDefinition.trim()) {
      alert('No template content to export.');
      return;
    }
    let content = `## Schema Name: ${templateName || 'Untitled Template'}\n`;
    if (templateIdToEdit) content += `## Schema ID: ${templateIdToEdit}\n`;
    if (currentSchemaNlOrigin) content += `## NL Origin: ${currentSchemaNlOrigin}\n`;
    if (schemaComments && schemaComments.length > 0) {
        content += `## Comments:\n`;
        schemaComments.forEach(c => {
            content += `# - [${new Date(c.timestamp).toLocaleString()}] ${c.text}\n`;
        });
    }
    content += '\n' + templateDefinition;
    downloadFile(exportFilename || 'template_export.txt', content);
  };

  const handleExportAllProjectSchemas = () => {
    if (!activeProject || activeProject.schemas.length === 0) {
      alert('No schemas in the active project to export.');
      return;
    }
    let content = `## Project: ${activeProject.name}\n`;
    if (activeProject.description) content += `## Description: ${activeProject.description}\n`;
    content += `## Exported on: ${new Date().toISOString()}\n\n---\n\n`;

    activeProject.schemas.forEach(schema => {
      content += `## Schema Name: ${schema.name}\n`;
      content += `## Schema ID: ${schema.id}\n`;
      if (schema.nlOrigin) content += `## NL Origin: ${schema.nlOrigin}\n`;
      if (schema.comments && schema.comments.length > 0) {
        content += `## Comments:\n`;
        schema.comments.forEach(c => {
            content += `# - [${new Date(c.timestamp).toLocaleString()}] ${c.text}\n`;
        });
      }
      content += '\n' + schema.definition + '\n\n---\n\n';
    });
    downloadFile(exportAllFilename || 'all_schemas_export.txt', content);
  };
  
  const handleExportLastGenerated = () => {
    if (!generatedZWPacket.trim()) {
      alert('No generated ZW packet to export.');
      return;
    }
    downloadFile(exportFilename || 'generated_zw.txt', generatedZWPacket);
  };

  const handleExportToGodot = () => {
    if (!templateDefinition.trim()) {
        alert('No template definition in the "Create" tab to export for Godot.');
        return;
    }
    const parsedNode = parseZW(templateDefinition);
    if (!parsedNode || parsedNode.key.startsWith('Error:')) {
        alert(`Cannot export to Godot: ZW parsing failed. ${parsedNode?.key || ''} ${parsedNode?.value || ''}`);
        return;
    }
    const godotScript = convertZwToGodot(parsedNode);
    downloadFile(godotExportFilename || 'schema_export.gd', godotScript, 'text/gdscript');
  };

  // --- Auto-completion Logic ---
  const generateSuggestionsFromSchemas = (partialInput: string, rootPacketType: string): string[] => {
    if (!activeProject || !rootPacketType) return [];

    const matchingSchema = activeProject.schemas.find(s => {
        const schemaRoot = s.definition.match(/^([A-Z0-9_-]+(?:-[A-Z0-9_-]+)*):/i);
        return schemaRoot ? schemaRoot[1].toUpperCase() === rootPacketType.toUpperCase() : false;
    });

    if (!matchingSchema) return [];

    const parsedSchema = parseZW(matchingSchema.definition);
    if (!parsedSchema || parsedSchema.key.startsWith('Error:') || !Array.isArray(parsedSchema.value)) {
        return [];
    }
    
    // Extract direct children keys/sections from the schema
    const schemaElements = (parsedSchema.value as Array<ZWNode | ZWListItem>)
        .map(item => {
            if ('key' in item && item.key) { // ZWNode (key or section)
                // If it's a section (value is array or undefined), suggest with colon. Else, just key with colon.
                return Array.isArray(item.value) || item.value === undefined ? `${item.key}:` : `${item.key}:`;
            }
            // Add more sophisticated suggestions for list items if needed later
            return null; 
        })
        .filter((name): name is string => name !== null);


    return schemaElements
        .filter(name => name.toLowerCase().startsWith(partialInput.toLowerCase()) && name.toLowerCase() !== partialInput.toLowerCase())
        .map(name => name.toUpperCase()); // Suggest in uppercase for consistency
  };

  const updateSuggestions = () => {
    const textarea = templateTextareaRef.current;
    if (!textarea || !activeProject) {
      setShowAutoComplete(false);
      return;
    }

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = textarea.value.substring(0, cursorPos);
    const currentLineStart = textBeforeCursor.lastIndexOf('\n') + 1;
    const currentLineText = textBeforeCursor.substring(currentLineStart);
    const indentationMatch = currentLineText.match(/^(\s*)/);
    const currentIndentation = indentationMatch ? indentationMatch[0].length : 0;
    
    // Autocomplete only on indented lines
    if (currentIndentation === 0 && currentLineText.trim() !== '') { 
        // Potentially a root type, no suggestions based on schema children here yet.
        // Or if it's not empty and no indent, likely not where child suggestions are needed.
        setShowAutoComplete(false);
        return;
    }
    if (currentIndentation === 0 && currentLineText.trim() === '') {
        // Empty line at root, no suggestions.
         setShowAutoComplete(false);
        return;
    }


    const partialInput = currentLineText.substring(currentIndentation);

    // Determine root packet type of the current template being edited
    const templateLines = templateDefinition.split('\n');
    let rootPacketType = "";
    for (const line of templateLines) {
        const match = line.match(/^([A-Z0-9_-]+(?:-[A-Z0-9_-]+)*):/i);
        if (match) {
            rootPacketType = match[1];
            break;
        }
    }
    
    if (!rootPacketType && currentIndentation > 0) { // If indented but no root type found, don't suggest
        setShowAutoComplete(false);
        return;
    }


    const suggestions = generateSuggestionsFromSchemas(partialInput, rootPacketType);

    if (suggestions.length > 0 && partialInput.trim() !== '') {
      // Basic positioning: below the textarea. More precise positioning is complex.
      // For simplicity, using a fixed offset or relative to a wrapper.
      const rect = textarea.getBoundingClientRect();
      // A more accurate positioning would involve calculating cursor char position
      setAutoCompletePosition({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX + currentIndentation * 8 /* approx char width */ });
      setAutoCompleteSuggestions(suggestions);
      setActiveSuggestionIndex(0);
      setShowAutoComplete(true);
    } else {
      setShowAutoComplete(false);
    }
  };


  const handleTemplateChangeAndSuggest = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTemplateDefinition(e.target.value);
    // Debounce or delay updateSuggestions if performance becomes an issue
    updateSuggestions();
  };

  const handleTemplateKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showAutoComplete && autoCompleteSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSuggestionIndex(prev => (prev + 1) % autoCompleteSuggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSuggestionIndex(prev => (prev - 1 + autoCompleteSuggestions.length) % autoCompleteSuggestions.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const suggestion = autoCompleteSuggestions[activeSuggestionIndex];
        const textarea = templateTextareaRef.current;
        if (textarea) {
          const cursorPos = textarea.selectionStart;
          const textBeforeCursor = textarea.value.substring(0, cursorPos);
          const currentLineStart = textBeforeCursor.lastIndexOf('\n') + 1;
          const currentLineIndentation = textBeforeCursor.substring(currentLineStart).match(/^(\s*)/)?.[0] || "";
          
          const textAfterCursor = textarea.value.substring(cursorPos);
          
          // Replace the partial input with the suggestion
          const partialInputLength = textBeforeCursor.substring(currentLineStart + currentLineIndentation.length).length;
          const newTextBeforeCursor = textBeforeCursor.substring(0, cursorPos - partialInputLength);

          const newTemplateDef = newTextBeforeCursor + suggestion + textAfterCursor;
          setTemplateDefinition(newTemplateDef);
          
          // Move cursor after inserted suggestion
          // Needs to be done after state update re-renders, so use timeout or effect
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = newTextBeforeCursor.length + suggestion.length;
          }, 0);
        }
        setShowAutoComplete(false);
      } else if (e.key === 'Escape') {
        setShowAutoComplete(false);
      }
    } else if (e.key === 'Tab' && !showAutoComplete) {
        // Basic tab-to-space insertion if not handling autocomplete
        e.preventDefault();
        const textarea = templateTextareaRef.current;
        if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const spaces = '  '; // Insert 2 spaces for a tab
            textarea.value = textarea.value.substring(0, start) + spaces + textarea.value.substring(end);
            textarea.selectionStart = textarea.selectionEnd = start + spaces.length;
            setTemplateDefinition(textarea.value); // Update state
        }
    }
  };

 const handleSuggestionSelect = (suggestion: string) => {
    const textarea = templateTextareaRef.current;
    if (textarea) {
      const cursorPos = textarea.selectionStart;
      const textBeforeCursor = textarea.value.substring(0, cursorPos);
      const currentLineStart = textBeforeCursor.lastIndexOf('\n') + 1;
      const currentLineIndentation = textBeforeCursor.substring(currentLineStart).match(/^(\s*)/)?.[0] || "";
      const textAfterCursor = textarea.value.substring(cursorPos);
      const partialInputLength = textBeforeCursor.substring(currentLineStart + currentLineIndentation.length).length;
      const newTextBeforeCursor = textBeforeCursor.substring(0, cursorPos - partialInputLength);

      const newTemplateDef = newTextBeforeCursor + suggestion + textAfterCursor;
      setTemplateDefinition(newTemplateDef);

      setTimeout(() => {
        textarea.focus(); // Ensure textarea has focus
        textarea.selectionStart = textarea.selectionEnd = newTextBeforeCursor.length + suggestion.length;
      }, 0);
    }
    setShowAutoComplete(false);
  };


  const renderTabContent = () => {
    // const _exhaustiveCheck: never = activeTab; // Error: Type 'string' is not assignable to type 'never'.
    switch (activeTab) {
      case 'projects':
        return (
          <div>
            <h2>Manage Projects</h2>
            <section>
              <h3>Create New Project</h3>
              <input
                type="text"
                placeholder="Project Name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                style={{ marginRight: '10px', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
              <input
                type="text"
                placeholder="Project Description (Optional)"
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
                style={{ marginRight: '10px', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', width: '300px' }}
              />
              <button className="action-button" onClick={handleCreateProject}>Create Project</button>
            </section>
            <section>
              <h3>Available Projects</h3>
              <button className="action-button secondary" onClick={handleLoadExampleTemplates} style={{marginBottom: '15px'}}>🚀 Load Example Templates</button>
              {projects.length === 0 && !activeProjectId ? (
                 <p>No projects yet. Create one above or <button className="link-button" onClick={handleLoadExampleTemplates}>load examples</button> to get started. You can also visit the <button className="link-button" onClick={() => setActiveTab('guide')}>📖 Guide</button> tab.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {projects.map(p => (
                    <li key={p.id} style={{ marginBottom: '10px', padding: '10px', background: p.id === activeProjectId ? '#e8f4fd' : '#f9f9f9', border: '1px solid #ddd', borderRadius: '4px' }}>
                      <h4 style={{ margin: '0 0 5px 0' }}>{p.name} {p.id === activeProjectId && <span style={{ color: '#1abc9c', fontSize: '0.9em' }}>(Active)</span>}</h4>
                      <p style={{ margin: '0 0 10px 0', fontSize: '0.9em', color: '#555' }}>{p.description || 'No description'}</p>
                      <button className="action-button" onClick={() => handleSetActiveProject(p.id)} disabled={p.id === activeProjectId}>Set Active</button>
                      <button className="action-button secondary" onClick={() => handleDeleteProject(p.id)} style={{ marginLeft: '10px', backgroundColor: '#e74c3c' }}>Delete Project</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        );
      case 'create':
        return (
          <div className="create-tab-content">
            <section>
                <h2>Project Context</h2>
                {activeProject ? (
                    <div>
                        <p><strong>Active Project:</strong> {activeProject.name}</p>
                        <p>This project has {activeProject.schemas.length} template(s). Templates from this project will guide AI generation and validation.</p>
                        <select 
                            onChange={(e) => {
                                const schemaId = e.target.value;
                                const schemaToLoad = activeProject.schemas.find(s => s.id === schemaId);
                                if (schemaToLoad) handleLoadSchema(schemaToLoad);
                                else if (schemaId === "") handleNewTemplate(); // "New Template" option
                            }}
                            value={templateIdToEdit || ""}
                            style={{padding: '8px', marginRight: '10px', border: '1px solid #ccc', borderRadius: '4px'}}
                            aria-label="Load template from active project"
                        >
                            <option value="">-- Load Template or Start New --</option>
                            {activeProject.schemas.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                        <button className="action-button secondary" onClick={handleNewTemplate}>Clear Editor / New Template</button>
                    </div>
                ) : (
                    <p>No active project. Please <button className="link-button" onClick={() => setActiveTab('projects')}>select or create a project</button> to enable project-specific features.</p>
                )}
            </section>

            <section>
              <AIConfigPanel 
                aiService={aiService}
                config={aiConfig}
                onConfigChange={handleAIConfigChange}
                onServiceUpdate={handleAIServiceUpdate}
              />
            </section>

            <section className="template-designer-section">
              <h2>Template Designer</h2>
              <input
                type="text"
                placeholder="Template Name (e.g., CharacterProfile, QuestStep)"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                style={{ width: 'calc(100% - 22px)', padding: '10px', marginBottom: '10px', border: '1px solid #bdc3c7', borderRadius: '4px' }}
                aria-label="Template Name"
                disabled={!activeProject}
              />
              {currentSchemaNlOrigin && (
                <div style={{ marginBottom: '10px', padding: '10px', backgroundColor: '#f0f0f0', border: '1px dashed #ccc', borderRadius: '4px' }}>
                    <p style={{marginTop: 0, marginBottom: '5px', fontWeight: 'bold', fontSize: '0.9em'}}>Natural Language Origin (for context):</p>
                    <p style={{margin: 0, fontSize: '0.85em', color: '#555', whiteSpace: 'pre-wrap'}}>{currentSchemaNlOrigin}</p>
                </div>
              )}
              <div className="hybrid-editor-layout">
                <div className="code-editor-pane">
                  <label htmlFor="template-definition-editor" className="sr-only">ZW Template Definition</label>
                  <textarea
                    id="template-definition-editor"
                    ref={templateTextareaRef}
                    value={templateDefinition}
                    onChange={handleTemplateChangeAndSuggest}
                    onKeyDown={handleTemplateKeyDown}
                    onClick={updateSuggestions} // Also update on click in case cursor moves without typing
                    placeholder="Define your ZW template here (e.g., ZW-REQUEST:&#10;  ACTION: Login&#10;  USER: '{{username}}')"
                    aria-label="ZW Template Definition Editor"
                    disabled={!activeProject}
                  />
                  <AutoCompleteDropdown
                    suggestions={autoCompleteSuggestions}
                    show={showAutoComplete}
                    activeIndex={activeSuggestionIndex}
                    onSelectSuggestion={handleSuggestionSelect}
                    position={autoCompletePosition}
                  />
                </div>
                <div className="visual-pane">
                    <div className="visual-preview-pane">
                        <h3>Syntax Preview
                            <CopyButton textToCopy={templateDefinition} disabled={!templateDefinition.trim()} />
                        </h3>
                        <ZWSyntaxHighlighter zwString={templateDefinition} />
                    </div>
                    <div className="inspector-palette-pane">
                        <h3>Inspector / Palette</h3>
                        <p style={{color: '#7f8c8d'}}>Element inspector and quick-add palette coming soon!</p>
                    </div>
                </div>
              </div>
              <button className="action-button" onClick={handleSaveSchemaToProject} style={{ marginTop: '15px' }} disabled={!activeProject || !templateName.trim() || !templateDefinition.trim()}>
                {templateIdToEdit ? 'Save Changes to Template' : 'Save New Template to Project'}
              </button>
              {templateIdToEdit && (
                <button className="action-button secondary" onClick={() => handleDeleteSchema(templateIdToEdit)} style={{ marginLeft: '10px', backgroundColor: '#e74c3c' }}>
                    Delete This Template
                </button>
              )}
            </section>
            
            <section>
                <h3>Template Comments/Notes</h3>
                {templateIdToEdit ? (
                    <>
                        {schemaComments.length > 0 ? (
                            <ul style={{listStyle: 'none', padding: 0, maxHeight: '150px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '4px', marginBottom: '10px'}}>
                                {schemaComments.map(comment => (
                                    <li key={comment.id} style={{padding: '8px', borderBottom: '1px solid #f0f0f0'}}>
                                        <p style={{margin: 0, fontSize: '0.9em', whiteSpace: 'pre-wrap'}}>{comment.text}</p>
                                        <small style={{color: '#777'}}>{new Date(comment.timestamp).toLocaleString()}
                                            <button onClick={() => handleDeleteComment(comment.id)} style={{marginLeft: '10px', color: 'red', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8em'}}>Delete</button>
                                        </small>
                                    </li>
                                ))}
                            </ul>
                        ) : <p>No comments for this template yet.</p>}
                        <textarea
                            value={newCommentText}
                            onChange={(e) => setNewCommentText(e.target.value)}
                            placeholder="Add a comment or note for this template..."
                            rows={2}
                            style={{width: 'calc(100% - 22px)', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '5px'}}
                            aria-label="New comment for template"
                        />
                        <button className="action-button secondary" onClick={handleAddComment} disabled={!newCommentText.trim()}>Add Comment</button>
                    </>
                ) : (
                    <p>Save the template first to add comments.</p>
                )}
            </section>

            <section className="natural-language-generator-section">
              <h2>Natural Language to ZW</h2>
               <div style={{ marginBottom: '10px' }}>
                    <label>
                        <input
                            type="checkbox"
                            checked={isNarrativeFocusEnabled}
                            onChange={(e) => setIsNarrativeFocusEnabled(e.target.checked)}
                        />
                        Enable Narrative Focus (for characters, dialogue, actions, setting) - Recommended for stories/games.
                    </label>
                </div>
              <label htmlFor="nl-scenario-input" className="sr-only">Describe a scenario</label>
              <textarea
                id="nl-scenario-input"
                value={nlScenario}
                onChange={(e) => setNlScenario(e.target.value)}
                placeholder="Describe a scenario (e.g., 'A character named Alex feels scared and sees a shadow. They need to find a key in the old library to unlock a chest containing a map.')"
                aria-label="Natural language scenario input"
                disabled={!aiService}
              />
              <button className="action-button" onClick={handleGenerateZWFromNL} disabled={isGenerating || !nlScenario.trim() || !aiService}>
                {isGenerating ? 'Generating...' : 'Generate ZW from NL'}
              </button>

              <h3>Generated ZW Packet Preview
                <CopyButton textToCopy={generatedZWPacket} disabled={!generatedZWPacket.trim()} />
              </h3>
              {isGenerating && <p>Generating ZW packet, please wait...</p>}
              <div className="generated-zw-output" aria-live="polite">
                {generatedZWPacket || 'ZW packet will appear here...'}
              </div>

              {generatedZWPacket && !generatedZWPacket.startsWith("# Error") && (
                <>
                  <label htmlFor="refinement-suggestion-input" className="sr-only">Suggest changes or refinements</label>
                  <textarea
                    id="refinement-suggestion-input"
                    value={refinementSuggestion}
                    onChange={(e) => setRefinementSuggestion(e.target.value)}
                    placeholder="Suggest changes or refinements (e.g., 'Add a mood field: anxious', 'Change action to Explore')"
                    aria-label="Refinement suggestion input"
                    style={{ marginTop: '15px' }}
                    disabled={!aiService}
                  />
                  <button className="action-button secondary" onClick={handleRefineZWFromNL} disabled={isGenerating || !refinementSuggestion.trim() || !aiService} style={{ marginTop: '5px' }}>
                    {isGenerating ? 'Refining...' : 'Refine ZW with Feedback'}
                  </button>
                </>
              )}
            </section>
          </div>
        );
      case 'validate':
        return (
          <div>
            <h2>Validate ZW Content</h2>
            <textarea
              value={zwToValidate}
              onChange={(e) => setZwToValidate(e.target.value)}
              placeholder="Paste ZW content here to validate..."
              rows={10}
              style={{ width: 'calc(100% - 22px)', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '10px', fontFamily: "'Courier New', Courier, monospace" }}
              aria-label="ZW Content to Validate"
            />
            <button className="action-button" onClick={handleValidateZW}>Validate Against Project Vocabulary</button>
            <div style={{ marginTop: '20px' }}>
              <h3>Validation Results:</h3>
              {validationFeedback.length === 0 ? <p>No validation performed yet.</p> : (
                validationFeedback.map((fb, index) => (
                  <div key={index} style={{ 
                      padding: '10px', 
                      marginBottom: '10px', 
                      borderRadius: '4px',
                      borderLeft: `5px solid ${fb.type === 'success' ? '#2ecc71' : fb.type === 'error' ? '#e74c3c' : fb.type === 'warning' ? '#f39c12' : '#3498db'}`,
                      backgroundColor: '#f9f9f9'
                  }}>
                    <strong style={{color: fb.type === 'success' ? '#27ae60' : fb.type === 'error' ? '#c0392b' : fb.type === 'warning' ? '#d35400' : '#2980b9'}}>
                        {fb.type.toUpperCase()}:
                    </strong> {fb.message}
                    {fb.details && (
                        <ul style={{fontSize: '0.9em', marginTop: '5px'}}>
                            {fb.details.map((d, i) => <li key={i}>{d}</li>)}
                        </ul>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        );
      case 'visualize':
        return (
          <div>
            <h2>Visualize ZW Structure</h2>
            <section style={{ marginBottom: '20px', padding: '15px', background: '#fff', borderRadius: '4px', border:'1px solid #ddd' }}>
              <h3>Convert JSON to ZW</h3>
              <textarea
                value={jsonToConvertInput}
                onChange={(e) => setJsonToConvertInput(e.target.value)}
                placeholder='Paste JSON here (e.g., {"name": "Alex", "stats": {"level": 5, "hp": 100}})'
                rows={5}
                style={{ width: 'calc(100% - 22px)', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '10px', fontFamily: "'Courier New', Courier, monospace" }}
                aria-label="JSON content to convert to ZW"
              />
              <input
                type="text"
                value={jsonRootZwTypeInput}
                onChange={(e) => setJsonRootZwTypeInput(e.target.value)}
                placeholder="Optional Root ZW Type (e.g., ZW-MY-DATA)"
                style={{ padding: '8px', marginRight: '10px', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '10px' }}
                aria-label="Optional Root ZW Type for JSON conversion"
              />
              <button className="action-button" onClick={handleConvertJsonAndVisualize} disabled={!jsonToConvertInput.trim()}>
                Convert JSON to ZW & Visualize
              </button>
            </section>

            <section style={{ padding: '15px', background: '#fff', borderRadius: '4px', border:'1px solid #ddd' }}>
              <h3>Visualize ZW Input
                 <CopyButton textToCopy={zwToVisualize} disabled={!zwToVisualize.trim()} style={{marginLeft: '20px'}} />
              </h3>
              <textarea
                value={zwToVisualize}
                onChange={(e) => setZwToVisualize(e.target.value)}
                placeholder="Paste ZW content here, or convert JSON above to see its ZW form..."
                rows={10}
                style={{ width: 'calc(100% - 22px)', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '10px', fontFamily: "'Courier New', Courier, monospace" }}
                aria-label="ZW Content to Visualize"
              />
              <div style={{ padding: '15px', backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '4px', minHeight: '100px', overflowX: 'auto' }}>
                <ZWTemplateVisualizer templateDefinition={zwToVisualize} />
              </div>
              
              <div style={{marginTop: '20px'}}>
                <button className="action-button secondary" onClick={handleConvertVisualizedZwToJson} disabled={!zwToVisualize.trim()}>
                    Convert Visualized ZW to JSON
                </button>
                <h4>Generated JSON:
                    <CopyButton textToCopy={visualizedZwAsJsonString} disabled={!visualizedZwAsJsonString.trim() || visualizedZwAsJsonString.startsWith("// Error")} />
                </h4>
                <textarea
                    value={visualizedZwAsJsonString}
                    readOnly
                    placeholder="// JSON output will appear here..."
                    rows={10}
                    style={{ width: 'calc(100% - 22px)', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', marginTop: '5px', fontFamily: "'Courier New', Courier, monospace", backgroundColor: '#f0f0f0' }}
                    aria-label="Generated JSON from ZW"
                />
              </div>
            </section>
          </div>
        );
      case 'export':
        return (
          <div>
            <h2>Export ZW Data</h2>
            <section style={{ marginBottom: '20px', padding: '15px', background: '#fff', borderRadius: '4px', border:'1px solid #ddd' }}>
              <h3>Export Current Template (from Create tab)</h3>
              <input 
                type="text" 
                value={exportFilename} 
                onChange={e => setExportFilename(e.target.value)}
                placeholder="filename.txt"
                style={{padding: '8px', marginRight: '10px', border: '1px solid #ccc', borderRadius: '4px'}} 
              />
              <button className="action-button" onClick={handleExportCurrentTemplate}>Download Current Template as .txt</button>
              <br/><br/>
              <input 
                type="text" 
                value={godotExportFilename} 
                onChange={e => setGodotExportFilename(e.target.value)}
                placeholder="schema_export.gd"
                style={{padding: '8px', marginRight: '10px', border: '1px solid #ccc', borderRadius: '4px'}} 
              />
              <button className="action-button secondary" onClick={handleExportToGodot}>Download Current Template as .gd (Godot)</button>
            </section>
            <section style={{ marginBottom: '20px', padding: '15px', background: '#fff', borderRadius: '4px', border:'1px solid #ddd' }}>
              <h3>Export All Schemas from Active Project</h3>
               <input 
                type="text" 
                value={exportAllFilename} 
                onChange={e => setExportAllFilename(e.target.value)}
                placeholder="project_schemas.txt"
                style={{padding: '8px', marginRight: '10px', border: '1px solid #ccc', borderRadius: '4px'}} 
              />
              <button className="action-button" onClick={handleExportAllProjectSchemas} disabled={!activeProject || activeProject.schemas.length === 0}>
                Download All Project Schemas as .txt
              </button>
            </section>
            <section style={{ padding: '15px', background: '#fff', borderRadius: '4px', border:'1px solid #ddd' }}>
              <h3>Export Last Generated ZW Packet (from Create tab)</h3>
              <button className="action-button" onClick={handleExportLastGenerated} disabled={!generatedZWPacket}>Download Last Generated ZW</button>
            </section>
          </div>
        );
      case 'library':
        return (
          <div>
            <h2>Consciousness Pattern Library</h2>
            <p>Coming soon: Explore and import pre-built ZW patterns and templates from a shared community library.</p>
          </div>
        );
      case 'guide':
        return (
            <div>
                <h2>📖 ZW Transformer - Quick Start Guide</h2>
                <p>Welcome to the ZW Transformer! This tool helps you design, generate, validate, and export ZW (Ziegelwagga) consciousness patterns, especially useful for narrative design and game development.</p>

                <h3>Recommended Workflow Pipeline:</h3>
                <ol>
                    <li><strong>🌍 Projects: Setup Your Workspace</strong>
                        <ul>
                            <li><strong>Action:</strong> Go to the "🌍 Projects" tab.</li>
                            <li><strong>Goal:</strong> Create a new project (e.g., "My Game's Narrative") or select an existing one. Consider loading the "Example ZW Templates" project to see pre-built examples.</li>
                            <li><strong>Why:</strong> Projects organize your ZW templates (schemas), providing context for AI generation and validation.</li>
                        </ul>
                    </li>
                    <li><strong>📝 Create: Define or Generate ZW</strong>
                        <ul>
                            <li><strong>Option A: Template-First (Recommended for Consistency)</strong>
                                <ol>
                                    <li><strong>Design Template:</strong> In the "Template Designer" section of the "Create" tab, write your ZW structure (e.g., <code>ZW-CHARACTER-PROFILE:</code>). Give it a name (e.g., "CharacterBio"). Check out the "Example ZW Templates" project for ideas.</li>
                                    <li><strong>Save Template:</strong> Click "Save New Template to Project."</li>
                                    <li><strong>Use for Generation:</strong> This template will now guide the AI if its ZW Type matches the scenario, or if "Narrative Focus" is off and it's chosen as a relevant structure.</li>
                                </ol>
                            </li>
                            <li><strong>Option B: Natural Language (NL) First</strong>
                                <ol>
                                    <li><strong>Write Scenario:</strong> In "Natural Language to ZW," describe what you want (e.g., "A character named Alex feels scared and sees a shadow.").</li>
                                    <li><strong>Enable Narrative Focus (Crucial for Stories/Games):</strong> Check this box if your scenario involves characters, dialogue, actions, or setting descriptions. This uses the advanced "gold-standard" narrative format.</li>
                                    <li><strong>Generate:</strong> Click "Generate ZW from NL." The AI uses your active project's templates (if any are relevant and Narrative Focus is off, or to inform the fields if Narrative Focus is on) and Narrative Focus settings.</li>
                                </ol>
                            </li>
                        </ul>
                    </li>
                    <li><strong>📝 Create: Refine Your ZW (Iterate!)</strong>
                        <ul>
                            <li><strong>Action:</strong> Review the "Generated ZW Packet."</li>
                            <li><strong>Goal:</strong> Improve the ZW to meet your exact needs.</li>
                            <li><strong>How:</strong> Type your changes or suggestions in the "Suggest changes or refinements" box and click "Refine ZW with Feedback." Repeat as needed.</li>
                        </ul>
                    </li>
                    <li><strong>✅ Validate: Check Consistency</strong>
                        <ul>
                            <li><strong>Action:</strong> Go to the "✅ Validate" tab.</li>
                            <li><strong>Goal:</strong> Ensure your ZW packet (generated or manually written) aligns with ZW syntax and optionally with schemas defined in your active project.</li>
                            <li><strong>How:</strong> Paste your ZW content and click "Validate Against Project Vocabulary."</li>
                        </ul>
                    </li>
                    <li><strong>👁️ Visualize: Understand Structure & Convert</strong>
                        <ul>
                            <li><strong>Action:</strong> Go to the "👁️ Visualize" tab.</li>
                            <li><strong>Goal:</strong> See a clear tree structure of any ZW content. Test JSON to ZW conversion and ZW to JSON conversion for round-tripping.</li>
                            <li><strong>How:</strong> Paste ZW content into the ZW input text area to visualize. Or, paste JSON into the JSON input text area and click convert to see its ZW form. Then, use the "Convert Visualized ZW to JSON" button.</li>
                        </ul>
                    </li>
                    <li><strong>📤 Export: Get Your Creations</strong>
                        <ul>
                            <li><strong>Action:</strong> Go to the "📤 Export" tab.</li>
                            <li><strong>Goal:</strong> Download your ZW artifacts.</li>
                            <li><strong>How:</strong> Export individual templates, all project schemas, the last generated packet, or even the current template in Godot Engine (.gd) format.</li>
                        </ul>
                    </li>
                </ol>

                <h3>Tips for Best Results:</h3>
                <ul>
                    <li><strong>Templates are Key:</strong> Well-defined templates in your project lead to more consistent and predictable AI-generated ZW.</li>
                    <li><strong>Use Narrative Focus:</strong> For any story-driven content, game scenes, dialogues, or character interactions, enabling "Narrative Focus" is highly recommended.</li>
                    <li><strong>Be Specific:</strong> Clear natural language prompts and precise refinement feedback yield better results.</li>
                    <li><strong>Iterate:</strong> Don't expect perfection on the first try. Use the refinement loop.</li>
                    <li><strong>Check NL Origins:</strong> When loading example templates, note their "Natural Language Origin" in the Create tab to see how a prompt can lead to a structure.</li>
                    <li><strong>Experiment with JSON & ZW Conversions:</strong> Use the Visualize tab to see how your existing JSON data can be represented in ZW, and how ZW can be converted back to JSON.</li>
                </ul>

                <h3>Simplified Workflow (Mermaid Diagram):</h3>
                <pre style={{backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px', border: '1px solid #ddd', overflowX: 'auto'}}>
{`graph TD
    A[Start] --> B(🌍 Projects: Create/Select Project);
    B --> C{Mode?};
    C -- Template First --> D[📝 Create: Design & Save Template];
    D --> F;
    C -- NL First --> E[📝 Create: NL Scenario + Narrative Focus?];
    E --> F[Generate ZW];
    F --> G{Refine?};
    G -- Yes --> H[Provide Feedback & Refine ZW];
    H --> G;
    G -- No --> I[✅ Validate ZW];
    I --> J[👁️ Visualize ZW / JSON-ZW Roundtrip (Optional)];
    J --> K[📤 Export ZW/GDScript];
    K --> L[End];
`}
                </pre>
            </div>
        );
      default:
        const _exhaustiveCheck: never = activeTab;
        console.error('Unhandled tab:', activeTab, _exhaustiveCheck);
        return <p>Unknown tab selected. Please report this error.</p>;
    }
  };

  const TabButton: React.FC<{ tabKey: TabKey; label: string }> = ({ tabKey, label }) => (
    <button
      onClick={() => setActiveTab(tabKey)}
      className={activeTab === tabKey ? 'active' : ''}
      aria-pressed={activeTab === tabKey}
      id={`tab-${tabKey}`} // Added ID for aria-labelledby
      role="tab" // Correct role for tab buttons
    >
      {label}
    </button>
  );

  return (
    <div className="app-container">
      <header>ZW Transformer - Consciousness Interface Designer</header>
      <nav className="tabs" role="tablist" aria-label="Main navigation"> 
        <TabButton tabKey="projects" label="🌍 Projects" />
        <TabButton tabKey="create" label="📝 Create" />
        <TabButton tabKey="validate" label="✅ Validate" />
        <TabButton tabKey="visualize" label="👁️ Visualize" />
        <TabButton tabKey="export" label="📤 Export" />
        <TabButton tabKey="library" label="📚 Library" />
        <TabButton tabKey="guide" label="📖 Guide" />
      </nav>
      <main 
        className="tab-content" 
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        aria-live="polite" 
        onClick={(e) => {
            // Hide autocomplete if clicking outside relevant areas
            const target = e.target as HTMLElement;
            if (!target.closest('.code-editor-pane') && !target.closest('.autocomplete-dropdown')) {
                setShowAutoComplete(false);
            }
        }}
      >
        {renderTabContent()}
      </main>
      <footer>
        Powered by Ziegelwagga Cognitive Architecture & Gemini API. Version 0.8.2
      </footer>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<React.StrictMode><App /></React.StrictMode>);
} else {
  console.error("Failed to find the root element");
}
