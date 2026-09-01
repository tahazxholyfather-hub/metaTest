export type AiTeacherPublic = {
    id: number;
    firstName: string;
    lastName: string;
    displayName: string;
    age: number | null;
    avatarUrl: string;
    subject: string;
    specialty: string | null;
    description: string | null;
    personality: string | null;
    teachingStyle: string | null;
    knowledgeLevel: number;
    expertise: string | null;
    experience: string | null;
    isFree: boolean;
    isActive: boolean;
    locked?: boolean;
    pricePerMessage: number;
    typicalEnergy?: number;
    stats?: {
        students: number;
        questionsAnswered: number;
        conversations: number;
        averageRating: number | null;
    };
};

export type AiMessage = {
    id: number | string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    coinCost?: number;
    costUsd?: number;
    costIrr?: number;
    isStarter?: boolean;
    createdAt?: string;
    streaming?: boolean;
};

export type AiConversationSummary = {
    id: number;
    title: string;
    teacherId: number;
    teacherName?: string;
    teacherAvatar?: string;
    teacherSubject?: string;
    lastMessageAt?: string;
    createdAt?: string;
    messageCount?: number;
};

export type AiSettings = {
    lowCoinMode: boolean;
    alwaysExamples: boolean;
    conciseResponses: boolean;
    stepByStep: boolean;
    parentReportsEnabled: boolean;
    selectedBookId?: number | null;
};

export type AiBook = {
    id: number;
    title: string;
    subject?: string | null;
    grade?: string | null;
    publisher?: string | null;
};

export type AiStudentProfile = {
    schoolName?: string | null;
    grade?: string | null;
    field?: string | null;
    weaknesses?: string | null;
    strengths?: string | null;
    learningGoals?: string | null;
    learningPreferences?: string | null;
    additionalNotes?: string | null;
};

export type AiWallet = {
    balance: number;
    refilled?: boolean;
    refillAmount?: number;
    /** Daily energy allowance for the user's plan */
    dailyAllowance?: number;
    /** ISO timestamp of the next daily recharge */
    nextRefillAt?: string;
};

export type AiBootstrap = {
    onboardingCompleted: boolean;
    user: { id: number; firstName?: string; lastName?: string; currentPlan?: string };
    teacher: AiTeacherPublic | null;
    profile: AiStudentProfile | null;
    settings: AiSettings;
    wallet: AiWallet;
    latestConversation: { id: number; title: string; teacherId: number } | null;
};

export type ChatStatus = 'ready' | 'sending' | 'thinking' | 'generating' | 'error';

export type OnboardingStep = 'intro' | 'profile' | 'teacher' | 'chat';
