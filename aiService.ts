import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { OllamaClient, OllamaModel } from './ollamaClient';

export type AIProvider = 'gemini' | 'ollama';

export interface AIConfig {
  provider: AIProvider;
  geminiApiKey?: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
  temperature?: number;
  maxTokens?: number;
}

export class AIService {
  private geminiClient: GoogleGenAI | null = null;
  private ollamaClient: OllamaClient | null = null;
  private config: AIConfig;

  constructor(config: AIConfig) {
    this.config = config;
    this.initializeClients();
  }

  private initializeClients() {
    // Initialize Gemini if API key is provided
    if (this.config.geminiApiKey) {
      try {
        this.geminiClient = new GoogleGenAI({ apiKey: this.config.geminiApiKey });
      } catch (error) {
        console.error('Failed to initialize Gemini client:', error);
      }
    }

    // Initialize Ollama
    this.ollamaClient = new OllamaClient(this.config.ollamaBaseUrl);
  }

  async testConnection(): Promise<{ gemini: boolean; ollama: boolean }> {
    const results = {
      gemini: false,
      ollama: false
    };

    // Test Gemini
    if (this.geminiClient) {
      try {
        // Simple test request
        const response = await this.geminiClient.models.generateContent({
          model: 'gemini-2.5-flash-preview-04-17',
          contents: [{ role: "user", parts: [{ text: "Hello" }] }],
        });
        results.gemini = !!response.text;
      } catch (error) {
        console.error('Gemini connection test failed:', error);
      }
    }

    // Test Ollama
    if (this.ollamaClient) {
      results.ollama = await this.ollamaClient.testConnection();
    }

    return results;
  }

  async getAvailableModels(): Promise<{ gemini: string[]; ollama: OllamaModel[] }> {
    const models = {
      gemini: ['gemini-2.5-flash-preview-04-17', 'gemini-2.0-flash-thinking-exp', 'gemini-1.5-pro'],
      ollama: [] as OllamaModel[]
    };

    if (this.ollamaClient) {
      try {
        models.ollama = await this.ollamaClient.listModels();
      } catch (error) {
        console.error('Failed to get Ollama models:', error);
      }
    }

    return models;
  }

  async generateText(prompt: string, options?: {
    provider?: AIProvider;
    model?: string;
    temperature?: number;
    stream?: boolean;
    onStream?: (chunk: string) => void;
  }): Promise<string> {
    const provider = options?.provider || this.config.provider;
    const temperature = options?.temperature || this.config.temperature || 0.7;

    if (provider === 'gemini' && this.geminiClient) {
      return this.generateWithGemini(prompt, options?.model, temperature);
    } else if (provider === 'ollama' && this.ollamaClient) {
      const model = options?.model || this.config.ollamaModel || 'llama3.2:latest';
      
      if (options?.stream && options?.onStream) {
        let fullResponse = '';
        await this.ollamaClient.generateStream(
          {
            model,
            prompt,
            options: { temperature }
          },
          (chunk) => {
            fullResponse += chunk;
            options.onStream!(chunk);
          }
        );
        return fullResponse;
      } else {
        return this.ollamaClient.generate({
          model,
          prompt,
          options: { temperature }
        });
      }
    } else {
      throw new Error(`AI provider ${provider} not available or not configured`);
    }
  }

  private async generateWithGemini(prompt: string, model?: string, temperature?: number): Promise<string> {
    if (!this.geminiClient) {
      throw new Error('Gemini client not initialized');
    }

    const response: GenerateContentResponse = await this.geminiClient.models.generateContent({
      model: model || 'gemini-2.5-flash-preview-04-17',
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    return response.text.trim();
  }

  updateConfig(newConfig: Partial<AIConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.initializeClients();
  }

  async pullOllamaModel(modelName: string, onProgress?: (progress: string) => void): Promise<void> {
    if (!this.ollamaClient) {
      throw new Error('Ollama client not initialized');
    }
    
    return this.ollamaClient.pullModel(modelName, onProgress);
  }
}

export const createAIService = (config: AIConfig): AIService => {
  return new AIService(config);
};

export const RECOMMENDED_OLLAMA_MODELS = [
  {
    name: 'llama3.2:latest',
    description: 'Fast, general-purpose model good for ZW generation',
    size: '2.0GB',
    recommended: true
  },
  {
    name: 'codellama:latest',
    description: 'Specialized for code-like structures, excellent for ZW syntax',
    size: '3.8GB',
    recommended: true
  },
  {
    name: 'mistral:latest',
    description: 'Excellent at following structured formats like ZW',
    size: '4.1GB',
    recommended: false
  },
  {
    name: 'phi3:latest',
    description: 'Lightweight model, good for quick validations',
    size: '2.3GB',
    recommended: false
  }
];

export default AIService;
