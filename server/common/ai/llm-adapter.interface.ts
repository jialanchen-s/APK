export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ImageContentPart {
  type: 'image_url';
  image_url: { url: string };
}

export interface TextContentPart {
  type: 'text';
  text: string;
}

export type MessageContent = string | Array<TextContentPart | ImageContentPart>;

export interface ChatMessage {
  role: ChatRole;
  content: MessageContent;
}

export interface LLMChatParams {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stop?: string[];
  responseFormat?: 'text' | 'json';
  model?: string;
  signal?: AbortSignal;
}

export interface LLMChatResult {
  content: string;
  finishReason?: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMStreamChunk {
  delta: string;
  finishReason?: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error';
}

export interface LLMTextToJsonParams<TVars = Record<string, string>> {
  taskKey?: string;
  variables: TVars;
  schema?: JsonSchemaField[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export type TextToJsonFn<TInput extends Record<string, string>, TOutput extends object> = (
  variables: TInput,
  options?: { temperature?: number; maxTokens?: number; signal?: AbortSignal },
) => Promise<TOutput>;

export interface JsonSchemaField {
  name: string;
  type: 'String' | 'Number' | 'Boolean' | 'Array';
  description: string;
}

export interface LLMAdapter {
  readonly name: string;

  chat(params: LLMChatParams): Promise<LLMChatResult>;

  stream(params: LLMChatParams): AsyncIterable<LLMStreamChunk>;

  textToJson<TInput extends Record<string, string>, TOutput extends object>(
    params: LLMTextToJsonParams<TInput>,
  ): Promise<TOutput>;

  bindTask<TInput extends Record<string, string>, TOutput extends object>(
    taskKey: string,
  ): TextToJsonFn<TInput, TOutput>;

  isAvailable(): Promise<boolean>;
}
