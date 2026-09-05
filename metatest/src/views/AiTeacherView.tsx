// src/views/AiTeacherView.tsx
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { IntroScreen } from './ai-teacher-ui/IntroScreen';
import { ChatScreen } from './ai-teacher-ui/ChatScreen';
import { DesktopAiSidePanel, MobileHistorySheet } from './ai-teacher-ui/ChatSidePanel';
import { AiPageShell, GraySpinner, useIsMobile } from './ai-teacher-ui/ui';
import { aiTeacherApi } from './ai-teacher-ui/api';
import { SUBJECT_FALLBACKS, SUBJECT_ORDER } from './ai-teacher-ui/subjectIcons';
import type {
    AiConversationSummary,
    AiFeatures,
    AiMessage,
    AiSettings,
    AiSubject,
    AiWallet,
    ChatStatus,
    OnboardingStep,
    SubjectKey,
} from './ai-teacher-ui/types';

type Props = {
    onStateChange?: (state: { title: string; showBackButton: boolean }) => void;
    onNavigateHome?: () => void;
};

const FALLBACK_SUBJECTS: AiSubject[] = SUBJECT_ORDER.map((key) => ({
    key,
    nameFa: SUBJECT_FALLBACKS[key].nameFa,
    nameEn: key,
    icon: SUBJECT_FALLBACKS[key].icon,
    color: SUBJECT_FALLBACKS[key].color,
}));

const DEFAULT_SETTINGS: AiSettings = {
    efficientMode: false,
    shortAnswers: false,
    alwaysExamples: true,
    stepByStep: true,
    voiceReplies: true,
};

const DEFAULT_FEATURES: AiFeatures = { voice: true, imageGeneration: true, vision: true };

export function AiTeacherView({ onStateChange, onNavigateHome }: Props) {
    const isMobile = useIsMobile();
    const [bootLoading, setBootLoading] = useState(true);
    const [step, setStep] = useState<OnboardingStep>('intro');
    const [subjects, setSubjects] = useState<AiSubject[]>(FALLBACK_SUBJECTS);
    const [activeSubjectKey, setActiveSubjectKey] = useState<SubjectKey>('math');
    const [conversationId, setConversationId] = useState<number | null>(null);
    const [conversationTitle, setConversationTitle] = useState('گفتگوی جدید');
    const [messages, setMessages] = useState<AiMessage[]>([]);
    const [wallet, setWallet] = useState<AiWallet>({ balance: 0 });
    const [settings, setSettings] = useState<AiSettings>(DEFAULT_SETTINGS);
    const [features, setFeatures] = useState<AiFeatures>(DEFAULT_FEATURES);
    const [chatStatus, setChatStatus] = useState<ChatStatus>('ready');
    const [conversations, setConversations] = useState<AiConversationSummary[]>([]);
    const [conversationsLoading, setConversationsLoading] = useState(false);
    const [historySheetOpen, setHistorySheetOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [firstName, setFirstName] = useState<string | undefined>();

    useEffect(() => {
        onStateChange?.({ title: 'مِت', showBackButton: false });
    }, [onStateChange]);

    const goHome = useCallback(() => {
        if (onNavigateHome) onNavigateHome();
        else if (window.history.length > 1) window.history.back();
        else window.location.assign('/dashboard');
    }, [onNavigateHome]);

    const refreshConversations = useCallback(async () => {
        setConversationsLoading(true);
        try {
            const res = await aiTeacherApi.listConversations({ limit: 50 });
            setConversations(res.data || []);
        } catch {
            setConversations([]);
        } finally {
            setConversationsLoading(false);
        }
    }, []);

    const loadBootstrap = useCallback(async () => {
        setBootLoading(true);
        try {
            const res = await aiTeacherApi.bootstrap();
            const data = res.data;
            setFirstName(data.user?.firstName);
            setWallet(data.wallet || { balance: 0 });
            if (data.subjects?.length) setSubjects(data.subjects);
            if (data.lastSubject) setActiveSubjectKey(data.lastSubject);
            if (data.settings) setSettings(data.settings);
            if (data.features) setFeatures(data.features);

            if (!data.introSeen) {
                setStep('intro');
                setBootLoading(false);
                return;
            }

            const session = await aiTeacherApi.openSession();
            setWallet(session.data.wallet || data.wallet);
            if (session.data.conversation) {
                setConversationId(session.data.conversation.id);
                setConversationTitle(session.data.conversation.title);
                setActiveSubjectKey(session.data.conversation.subjectKey);
                setMessages(session.data.messages || []);
            }
            setStep('chat');
            refreshConversations();
        } catch (err: any) {
            toast.error(err?.message || 'خطا در بارگذاری مِت');
            setStep('intro');
        } finally {
            setBootLoading(false);
        }
    }, [refreshConversations]);

    useEffect(() => {
        loadBootstrap();
    }, [loadBootstrap]);

    const handleStart = async () => {
        setBusy(true);
        try {
            await aiTeacherApi.markIntroSeen();
        } catch { /* non-fatal */ }
        setBusy(false);
        setStep('chat');
        refreshConversations();
    };

    const handleSubjectChange = useCallback((key: SubjectKey) => {
        setActiveSubjectKey(key);
    }, []);

    const handleSettingsChange = useCallback((patch: Partial<AiSettings>) => {
        setSettings((prev) => {
            const next = { ...prev, ...patch };
            aiTeacherApi.updateSettings(patch)
                .then((res) => setSettings((cur) => ({ ...cur, ...res.data })))
                .catch(() => {
                    setSettings(prev);
                    toast.error('ذخیره تنظیمات ناموفق بود');
                });
            return next;
        });
    }, []);

    const handleSelectConversation = async (id: number) => {
        if (id === conversationId) { setHistorySheetOpen(false); return; }
        setBusy(true);
        try {
            const res = await aiTeacherApi.getConversation(id);
            setConversationId(res.data.conversation.id);
            setConversationTitle(res.data.conversation.title);
            setActiveSubjectKey(res.data.conversation.subjectKey);
            setMessages(res.data.messages || []);
            setHistorySheetOpen(false);
        } catch (err: any) {
            toast.error(err?.message || 'باز کردن گفتگو ناموفق بود');
        } finally {
            setBusy(false);
        }
    };

    const handleNewChat = () => {
        setConversationId(null);
        setConversationTitle('گفتگوی جدید');
        setMessages([]);
        setHistorySheetOpen(false);
    };

    const handleConversationId = (id: number, subjectKey: SubjectKey) => {
        const isNew = id !== conversationId;
        setConversationId(id);
        setActiveSubjectKey(subjectKey);
        if (isNew) refreshConversations();
    };

    const handleTitleChange = (title: string) => {
        setConversationTitle(title);
        setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, title, titleGenerated: true } : c)));
    };

    const handleRenameConversation = async (id: number, title: string) => {
        setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
        if (id === conversationId) setConversationTitle(title);
        try {
            await aiTeacherApi.renameConversation(id, title);
        } catch (err: any) {
            toast.error(err?.message || 'تغییر عنوان ناموفق بود');
            refreshConversations();
        }
    };

    const handleDeleteConversation = async (id: number) => {
        setConversations((prev) => prev.filter((c) => c.id !== id));
        try {
            await aiTeacherApi.deleteConversation(id);
            if (id === conversationId) handleNewChat();
        } catch (err: any) {
            toast.error(err?.message || 'حذف گفتگو ناموفق بود');
            refreshConversations();
        }
    };

    const sidePanelProps = {
        conversations,
        loadingConversations: conversationsLoading,
        activeConversationId: conversationId,
        onSelectConversation: handleSelectConversation,
        onNewChat: handleNewChat,
        onRenameConversation: handleRenameConversation,
        onDeleteConversation: handleDeleteConversation,
        chatStatus,
        subjects,
        activeSubjectKey,
        onSubjectChange: handleSubjectChange,
        settings,
        onSettingsChange: handleSettingsChange,
        voiceEnabled: features.voice,
    };

    if (bootLoading) {
        return (
            <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden">
                <AiPageShell>
                    <div className="flex-1 flex items-center justify-center">
                        <GraySpinner size={28} />
                    </div>
                </AiPageShell>
            </div>
        );
    }

    if (step === 'intro') {
        return (
            <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden">
                <IntroScreen loading={busy} onStart={handleStart} onBack={goHome} />
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-row min-h-0 h-full overflow-hidden bg-[var(--bg-app)]">
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
                <ChatScreen
                    subjects={subjects}
                    activeSubjectKey={activeSubjectKey}
                    onSubjectChange={handleSubjectChange}
                    conversationId={conversationId}
                    conversationTitle={conversationTitle}
                    initialMessages={messages}
                    wallet={wallet}
                    onWalletChange={(w) => setWallet((prev) => ({ ...prev, ...w }))}
                    onConversationId={handleConversationId}
                    onTitleChange={handleTitleChange}
                    onStatusChange={setChatStatus}
                    onOpenHistory={() => setHistorySheetOpen(true)}
                    onNewChat={handleNewChat}
                    onLeave={goHome}
                    voiceEnabled={features.voice}
                    voiceRepliesEnabled={settings.voiceReplies}
                    studentFirstName={firstName}
                />
            </div>

            {!isMobile && <DesktopAiSidePanel {...sidePanelProps} />}

            {isMobile && (
                <MobileHistorySheet
                    open={historySheetOpen}
                    onClose={() => setHistorySheetOpen(false)}
                    {...sidePanelProps}
                />
            )}
        </div>
    );
}

export default AiTeacherView;
