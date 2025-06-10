import React, { useState, useEffect } from 'react';
import { AIService, AIProvider, AIConfig, RECOMMENDED_OLLAMA_MODELS } from './aiService';
import { OllamaModel } from './ollamaClient';

interface AIConfigPanelProps {
  aiService: AIService | null;
  config: AIConfig;
  onConfigChange: (newConfig: AIConfig) => void;
  onServiceUpdate: (service: AIService) => void;
}

const AIConfigPanel: React.FC<AIConfigPanelProps> = ({
  aiService,
  config,
  onConfigChange,
  onServiceUpdate
}) => {
  const [connectionStatus, setConnectionStatus] = useState<{ gemini: boolean; ollama: boolean }>({
    gemini: false,
    ollama: false
  });
  const [availableModels, setAvailableModels] = useState<{ gemini: string[]; ollama: OllamaModel[] }>({
    gemini: [],
    ollama: []
  });
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isPullingModel, setIsPullingModel] = useState(false);
  const [pullProgress, setPullProgress] = useState('');
  const [selectedModelToPull, setSelectedModelToPull] = useState('');

  useEffect(() => {
    if (aiService) {
      testConnections();
      loadAvailableModels();
    }
  }, [aiService]);

  const testConnections = async () => {
    if (!aiService) return;

    setIsTestingConnection(true);
    try {
      const status = await aiService.testConnection();
      setConnectionStatus(status);
    } catch (error) {
      console.error('Connection test failed:', error);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const loadAvailableModels = async () => {
    if (!aiService) return;

    try {
      const models = await aiService.getAvailableModels();
      setAvailableModels(models);
    } catch (error) {
      console.error('Failed to load models:', error);
    }
  };

  const handleConfigChange = (updates: Partial<AIConfig>) => {
    const newConfig = { ...config, ...updates };
    onConfigChange(newConfig);

    // Create new AI service with updated config
    const newService = new AIService(newConfig);
    onServiceUpdate(newService);
  };

  const handlePullModel = async () => {
    if (!aiService || !selectedModelToPull) return;

    setIsPullingModel(true);
    setPullProgress('Starting download...');

    try {
      await aiService.pullOllamaModel(selectedModelToPull, (progress) => {
        setPullProgress(progress);
      });
      setPullProgress('Model downloaded successfully!');

      // Refresh available models
      setTimeout(() => {
        loadAvailableModels();
        setPullProgress('');
        setSelectedModelToPull('');
      }, 2000);
    } catch (error) {
      console.error('Model pull failed:', error);
      setPullProgress(`Failed to download model: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsPullingModel(false);
    }
  };

  const ConnectionIndicator: React.FC<{ connected: boolean; label: string }> = ({ connected, label }) => (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
      <div
        style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          backgroundColor: connected ? '#2ecc71' : '#e74c3c',
          marginRight: '8px'
        }}
      />
      <span style={{ fontSize: '0.9em' }}>
        {label}: {connected ? 'Connected' : 'Disconnected'}
      </span>
    </div>
  );

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
      <h3>🤖 AI Configuration</h3>

      {/* Provider Selection */}
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          AI Provider:
        </label>
        <select
          value={config.provider}
          onChange={(e) => handleConfigChange({ provider: e.target.value as AIProvider })}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', marginRight: '10px' }}
        >
          <option value="ollama">Ollama (Local)</option>
          <option value="gemini">Gemini (Cloud)</option>
        </select>
        <button
          className="action-button secondary"
          onClick={testConnections}
          disabled={isTestingConnection}
          style={{ fontSize: '0.8em', padding: '6px 12px' }}
        >
          {isTestingConnection ? 'Testing...' : 'Test Connection'}
        </button>
      </div>

      {/* Connection Status */}
      <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9em' }}>Connection Status:</h4>
        <ConnectionIndicator connected={connectionStatus.ollama} label="Ollama" />
        <ConnectionIndicator connected={connectionStatus.gemini} label="Gemini" />
      </div>

      {/* Ollama Configuration */}
      {config.provider === 'ollama' && (
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Ollama Base URL:
          </label>
          <input
            type="text"
            value={config.ollamaBaseUrl || 'http://localhost:11434'}
            onChange={(e) => handleConfigChange({ ollamaBaseUrl: e.target.value })}
            placeholder="http://localhost:11434"
            style={{ width: '300px', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', marginBottom: '10px' }}
          />

          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Selected Model:
          </label>
          <select
            value={config.ollamaModel || ''}
            onChange={(e) => handleConfigChange({ ollamaModel: e.target.value })}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', marginBottom: '10px', width: '250px' }}
          >
            <option value="">Select a model...</option>
            {availableModels.ollama.map(model => (
              <option key={model.name} value={model.name}>
                {model.name} ({(model.size / 1024 / 1024 / 1024).toFixed(1)}GB)
              </option>
            ))}
          </select>

          {/* Model Download Section */}
          <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#f0f8ff', borderRadius: '4px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9em' }}>Download New Model:</h4>
            <select
              value={selectedModelToPull}
              onChange={(e) => setSelectedModelToPull(e.target.value)}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', marginRight: '10px', width: '200px' }}
            >
              <option value="">Select model to download...</option>
              {RECOMMENDED_OLLAMA_MODELS.map(model => (
                <option key={model.name} value={model.name}>
                  {model.name} ({model.size}) {model.recommended ? '⭐' : ''}
                </option>
              ))}
            </select>
            <button
              className="action-button secondary"
              onClick={handlePullModel}
              disabled={!selectedModelToPull || isPullingModel}
              style={{ fontSize: '0.8em', padding: '6px 12px' }}
            >
              {isPullingModel ? 'Downloading...' : 'Download'}
            </button>

            {pullProgress && (
              <div style={{ marginTop: '8px', fontSize: '0.8em', color: '#666' }}>
                Status: {pullProgress}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gemini Configuration */}
      {config.provider === 'gemini' && (
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Gemini API Key:
          </label>
          <input
            type="password"
            value={config.geminiApiKey || ''}
            onChange={(e) => handleConfigChange({ geminiApiKey: e.target.value })}
            placeholder="Enter your Gemini API key"
            style={{ width: '300px', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>
      )}

      {/* Advanced Settings */}
      <details style={{ marginTop: '15px' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '10px' }}>
          Advanced Settings
        </summary>
        <div style={{ marginLeft: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Temperature (0.0 - 2.0):
          </label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={config.temperature || 0.7}
            onChange={(e) => handleConfigChange({ temperature: parseFloat(e.target.value) })}
            style={{ width: '200px', marginRight: '10px' }}
          />
          <span>{config.temperature || 0.7}</span>

          <label style={{ display: 'block', marginTop: '10px', marginBottom: '5px' }}>
            Max Tokens:
          </label>
          <input
            type="number"
            value={config.maxTokens || 4096}
            onChange={(e) => handleConfigChange({ maxTokens: parseInt(e.target.value) })}
            min="100"
            max="32000"
            style={{ width: '100px', padding: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>
      </details>

      {/* Quick Setup Tips */}
      {!connectionStatus.ollama && config.provider === 'ollama' && (
        <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#fff3cd', borderRadius: '4px', border: '1px solid #ffeaa7' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9em', color: '#856404' }}>💡 Quick Setup:</h4>
          <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '0.8em', color: '#856404' }}>
            <li>Install Ollama: <code>curl -fsSL https://ollama.ai/install.sh | sh</code></li>
            <li>Start Ollama: <code>ollama serve</code></li>
            <li>Pull a model: <code>ollama pull llama3.2</code></li>
            <li>Click "Test Connection" above</li>
          </ol>
        </div>
      )}
    </div>
  );
};

export default AIConfigPanel;
