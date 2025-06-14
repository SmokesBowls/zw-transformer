import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { OllamaClient } from './ollamaClient';

export type AIProvider = 'gemini' | 'ollama';

export interface SimpleAIConfig {
  provider: AIProvider;
  geminiApiKey?: string;
  ollamaModel?: string;
  temperature?: number;
}

export class SimpleAIService {
  private geminiClient: GoogleGenAI | null = null;
  private ollamaClient: OllamaClient;
  private config: SimpleAIConfig;

  constructor(config: SimpleAIConfig) {
    this.config = config;
    this.ollamaClient = new OllamaClient();
    
    if (config.geminiApiKey) {
      try {
        this.geminiClient = new GoogleGenAI({ apiKey: config.geminiApiKey });
      } catch (error) {
        console.error('Failed to initialize Gemini:', error);
      }
    }
  }

  async generateText(prompt: string, model?: string): Promise<string> {
    const temperature = this.config.temperature || 0.5;

    if (this.config.provider === 'ollama') {
      const selectedModel = model || this.config.ollamaModel || 'dolphin-mistral:latest';
      return this.ollamaClient.generate(selectedModel, prompt, { options: { temperature } });
    }
    else if (this.config.provider === 'gemini' && this.geminiClient) {
      const response: GenerateContentResponse = await this.geminiClient.models.generateContent({
        model: 'gemini-2.5-flash-preview-04-17',
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
      return response.text.trim();
    } 
    else {
      throw new Error(`AI provider ${this.config.provider} not available`);
    }
  }

  async testConnection(): Promise<{ ollama: boolean; gemini: boolean }> {
    const results = { ollama: false, gemini: false };
    
    // Test Ollama
    results.ollama = await this.ollamaClient.testConnection();
    
    // Test Gemini (simple check)
    results.gemini = !!this.geminiClient;
    
    return results;
  }
}
