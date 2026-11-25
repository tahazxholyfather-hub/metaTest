export type SubjectKey = 'math' | 'biology' | 'physics' | 'chemistry';

export type AiSubject = {
    key: SubjectKey;
    nameFa: string;
    nameEn: string;
    icon: string;
    color: string;
};

export type AiAttachment = {
    type: 'image' | 'audio';
    url: string;
    promptUsed?: string;
    mimeType?: string;
};

export type AiSettings = {
    /** Efficient usage — shorter, cheaper replies (maps to low_coin_mode). */
    efficientMode: boolean;
    /** Short answers — compact explanations. */
    shortAnswers: boolean;
    alwaysExamples: boolean;
    stepByStep: boolean;
    /** Allow synthesizing spoken replies (TTS). */
    voiceReplies: boolean;
};

export type AiFeatures = {
    voice: boolean;
    imageGeneration: boolean;
    vision: boolean;
};

export type AiMessage = {
    id: number | string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    coinCost?: number;
    isStarter?: boolean;
    attachments?: AiAttachment[];
    createdAt?: string;
    streaming?: boolean;
};

export type AiConversationSummary = {
    id: number;
    title: string;
    subjectKey: SubjectKey;
    lastMessageAt?: string;
    createdAt?: string;
    messageCount?: number;
    titleGenerated?: boolean;
};

export type AiWallet = {
    balance: number;
    refilled?: boolean;
    refillAmount?: number;
    dailyAllowance?: number;
    nextRefillAt?: string;
};

export type AiBootstrap = {
    introSeen: boolean;
    user: { id: number; firstName?: string; lastName?: string; currentPlan?: string };
    subjects: AiSubject[];
    lastSubject: SubjectKey | null;
    settings: AiSettings;
    features: AiFeatures;
    wallet: AiWallet;
    latestConversation: AiConversationSummary | null;
};

export type ChatStatus = 'ready' | 'sending' | 'thinking' | 'generating' | 'error';

export type OnboardingStep = 'intro' | 'chat';
