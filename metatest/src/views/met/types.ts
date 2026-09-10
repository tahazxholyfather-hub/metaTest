/** Frontend types mirroring the Met backend surface (`src/backend/ai-teacher`). */

export type SubjectKey = 'math' | 'physics' | 'chemistry' | 'biology' | 'general';

export interface MetSubject {
    key: SubjectKey;
    nameFa: string;
    nameEn: string;
    icon: string;
    color: string;
}

export interface MetFeatures {
    available: boolean;
    unavailableReason: string | null;
    chat: boolean;
    vision: boolean;
    imageGeneration: boolean;
    stt: boolean;
    tts: boolean;
    pdfReferences: boolean;
    memory: boolean;
    knowledgeBase: boolean;
    tools: boolean;
    suggestions: boolean;
    limits: {
        maxImageMb: number;
        maxAudioMb: number;
        maxPdfMb: number;
        maxPdfsPerConversation: number;
        maxAttachmentsPerMessage: number;
        maxMessageChars: number;
    };
}

export interface MetWallet {
    daily: number;
    purchased: number;
    total: number;
    balance: number;
    dailyQuota: number;
    grantedToday?: boolean;
    grantAmount?: number;
    nextResetAt: string;
}

export type Tone = 'friendly' | 'formal' | 'playful';
export type ReasoningLevel = 'fast' | 'balanced' | 'deep';
export type Verbosity = 'short' | 'normal' | 'detailed';

export interface MetSettings {
    tone: Tone;
    reasoningLevel: ReasoningLevel;
    verbosity: Verbosity;
    creativity: number;
    conciseMode: boolean;
    efficientMode: boolean;
    alwaysExamples: boolean;
    stepByStep: boolean;
    voiceReplies: boolean;
    memoryEnabled: boolean;
    knowledgeEnabled: boolean;
    pdfReferencesEnabled: boolean;
}

export interface MetConversation {
    id: number;
    title: string;
    subjectKey: SubjectKey;
    messageCount: number;
    lastMessageAt: string | null;
    createdAt: string | null;
    titleGenerated: boolean;
}

export type AttachmentType = 'image' | 'audio' | 'generated_image' | 'file';

export interface MetAttachment {
    type: AttachmentType | string;
    url?: string;
    fileId?: number;
    mimeType?: string;
    width?: number;
    height?: number;
    durationSeconds?: number | null;
    promptUsed?: string;
    name?: string;
}

export type MessageStatus = 'complete' | 'stopped' | 'error' | 'streaming';

export interface MetMessage {
    id: number | string;
    conversationId?: number | null;
    role: 'user' | 'assistant';
    content: string;
    attachments: MetAttachment[];
    status: MessageStatus;
    coinCost?: number;
    model?: string | null;
    latencyMs?: number | null;
    regeneratedFrom?: number | null;
    createdAt?: string;
    /** Client-only: message is being streamed right now. */
    streaming?: boolean;
    /** Client-only: local error text for a failed turn. */
    error?: string;
}

export interface MetBootstrap {
    features: MetFeatures;
    user: { id: number; firstName: string | null; lastName: string | null; currentPlan: string | null };
    subjects: MetSubject[];
    lastSubject: SubjectKey | null;
    settings: MetSettings;
    wallet: MetWallet;
    latestConversation: MetConversation | null;
}

export interface MetSuggestion {
    id: number | null;
    title: string;
    prompt: string;
    hint: string | null;
    icon: string;
}

export interface MetReference {
    id: number;
    conversationId: number;
    fileId: number;
    title: string;
    status: 'processing' | 'ready' | 'error' | string;
    chunkCount: number;
    pages: number | null;
    error: string | null;
    url: string | null;
    sizeBytes: number | null;
}

export interface MetMemory {
    id: number;
    type: string;
    content: string;
    importance: number;
    confidence: number | null;
    subjectKey: SubjectKey | null;
    createdAt: string;
    updatedAt: string;
}

export interface MetLedgerEntry {
    id: number;
    type: string;
    amount: number;
    dailyDelta: number;
    purchasedDelta: number;
    balanceBefore: number;
    balanceAfter: number;
    reason: string | null;
    operationType: string | null;
    conversationId: number | null;
    messageId: number | null;
    createdAt: string;
}

export interface UploadedImage {
    fileId: number;
    type: 'image';
    url: string;
    mimeType: string;
    width?: number;
    height?: number;
    sizeBytes?: number;
}

export interface TranscribeResult {
    text: string;
    file: { fileId: number; type: 'audio'; url: string; mimeType: string; durationSeconds: number | null };
    charged: number;
    wallet: MetWallet;
}

/** Chat pipeline status as the UI and the character see it. */
export type ChatStatus =
    | 'ready'
    | 'listening'
    | 'sending'
    | 'thinking'
    | 'processing'
    | 'generating'
    | 'speaking'
    | 'success'
    | 'error';

/** Server-sent events emitted by POST /ai-teacher/chat/stream. */
export type ChatStreamEvent =
    | { event: 'status'; data: { status: 'thinking' | 'processing' | 'generating' | 'ready' } }
    | {
          event: 'meta';
          data: {
              conversationId: number;
              subjectKey: SubjectKey;
              reserved: number;
              typicalCoins: number;
              wallet: MetWallet;
              regenerateMessageId: number | null;
          };
      }
    | { event: 'user_message'; data: MetMessage }
    | { event: 'assistant_start'; data: { conversationId: number } }
    | { event: 'delta'; data: { text: string } }
    | { event: 'tool'; data: { name: string; status: 'running' | 'done' | 'error' } }
    | { event: 'attachment'; data: MetAttachment }
    | {
          event: 'done';
          data: {
              message: MetMessage;
              wallet: MetWallet;
              charged: number;
              refunded: number;
              subjectKey: SubjectKey;
              durationMs: number;
              stopped: boolean;
          };
      }
    | { event: 'title'; data: { conversationId: number; title: string } }
    | {
          event: 'error';
          data: {
              code: string;
              message: string;
              balance?: number;
              needed?: number;
              wallet?: MetWallet | null;
              refunded?: number;
              conversationId: number | null;
              userMessageId?: number | null;
          };
      };

export class MetApiError extends Error {
    code: string;
    status: number;
    wallet?: MetWallet;
    constructor(message: string, code = 'ERROR', status = 500, wallet?: MetWallet) {
        super(message);
        this.name = 'MetApiError';
        this.code = code;
        this.status = status;
        this.wallet = wallet;
    }
}
