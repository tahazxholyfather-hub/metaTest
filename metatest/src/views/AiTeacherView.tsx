// src/views/AiTeacherView.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { IntroScreen } from './ai-teacher-ui/IntroScreen';
import { ProfileSetup } from './ai-teacher-ui/ProfileSetup';
import { TeacherSelector } from './ai-teacher-ui/TeacherSelector';
import { ChatScreen } from './ai-teacher-ui/ChatScreen';
import { DesktopAiSidePanel, MenuSheet } from './ai-teacher-ui/TeacherSidebar';
import { AiPageShell, FlatPrimaryButton, GraySpinner, HiddenScroll } from './ai-teacher-ui/ui';
import { aiTeacherApi } from './ai-teacher-ui/api';
import type {
    AiBootstrap,
    AiMessage,
    AiSettings,
    AiTeacherPublic,
    AiWallet,
    ChatStatus,
    OnboardingStep,
} from './ai-teacher-ui/types';

type Props = {
    onStateChange?: (state: { title: string; showBackButton: boolean }) => void;
    onNavigateHome?: () => void;
};

const DEFAULT_SETTINGS: AiSettings = {
    lowCoinMode: false,
    alwaysExamples: true,
    conciseResponses: false,
    stepByStep: true,
    parentReportsEnabled: false,
};

export function AiTeacherView({ onStateChange, onNavigateHome }: Props) {
    const [bootLoading, setBootLoading] = useState(true);
    const [step, setStep] = useState<OnboardingStep>('intro');
    const [bootstrap, setBootstrap] = useState<AiBootstrap | null>(null);
    const [teacher, setTeacher] = useState<AiTeacherPublic | null>(null);
    const [conversationId, setConversationId] = useState<number | null>(null);
    const [messages, setMessages] = useState<AiMessage[]>([]);
    const [wallet, setWallet] = useState<AiWallet>({ balance: 0 });
    const [settings, setSettings] = useState<AiSettings>(DEFAULT_SETTINGS);
    const [chatStatus, setChatStatus] = useState<ChatStatus>('ready');
    const [menuOpen, setMenuOpen] = useState(false);
    const [desktopMenuOpen, setDesktopMenuOpen] = useState(true); // open by default on desktop
    const [busy, setBusy] = useState(false);
    const [changingTeacher, setChangingTeacher] = useState(false);

    useEffect(() => {
        onStateChange?.({ title: 'معلم هوشمند', showBackButton: false });
    }, [onStateChange]);

    const goHome = useCallback(() => {
        if (onNavigateHome) onNavigateHome();
        else if (window.history.length > 1) window.history.back();
        else window.location.assign('/dashboard');
    }, [onNavigateHome]);

    const loadBootstrap = useCallback(async () => {
        setBootLoading(true);
        try {
            const res = await aiTeacherApi.bootstrap();
            const data = res.data;
            setBootstrap(data);
            setSettings(data.settings || DEFAULT_SETTINGS);
            setWallet(data.wallet || { balance: 0 });
            setTeacher(data.teacher);

            if (!data.onboardingCompleted) {
                setStep('intro');
                return;
            }

            const session = await aiTeacherApi.openSession();
            setTeacher(session.data.teacher);
            setConversationId(session.data.conversation.id);
            setMessages(session.data.messages || []);
            setWallet(session.data.wallet || data.wallet);
            setStep('chat');
        } catch (err: any) {
            toast.error(err?.message || 'خطا در بارگذاری معلم هوشمند');
            setStep('intro');
        } finally {
            setBootLoading(false);
        }
    }, []);

    useEffect(() => {
        loadBootstrap();
    }, [loadBootstrap]);

    const handleProfileSubmit = async (profile: any) => {
        setBusy(true);
        try {
            await aiTeacherApi.saveProfile(profile);
            setStep('teacher');
        } catch (err: any) {
            toast.error(err?.message || 'ذخیره پروفایل ناموفق بود');
        } finally {
            setBusy(false);
        }
    };

    const handleSelectTeacher = async (selected: AiTeacherPublic) => {
        setBusy(true);
        try {
            const res = await aiTeacherApi.selectTeacher(selected.id);
            setTeacher(res.data.teacher);
            setConversationId(res.data.conversation.id);
            setWallet(res.data.wallet || wallet);
            const msgs: AiMessage[] = [];
            if (res.data.starterMessage) msgs.push(res.data.starterMessage);
            try {
                const session = await aiTeacherApi.openSession();
                setMessages(session.data.messages || msgs);
                setConversationId(session.data.conversation.id);
                setWallet(session.data.wallet || res.data.wallet);
            } catch {
                setMessages(msgs);
            }
            setChangingTeacher(false);
            setMenuOpen(false);
            setDesktopMenuOpen(true);
            setStep('chat');
            toast.success(`${res.data.teacher.displayName} انتخاب شد`);
        } catch (err: any) {
            toast.error(err?.message || 'انتخاب معلم ناموفق بود');
        } finally {
            setBusy(false);
        }
    };

    const handleSelectConversation = async (id: number) => {
        setBusy(true);
        try {
            const res = await aiTeacherApi.getConversation(id);
            setConversationId(res.data.conversation.id);
            setTeacher(res.data.teacher);
            setMessages(res.data.messages || []);
            setMenuOpen(false);
            setChangingTeacher(false);
            setStep('chat');
        } catch (err: any) {
            toast.error(err?.message || 'باز کردن گفتگو ناموفق بود');
        } finally {
            setBusy(false);
        }
    };

    const handleNewChat = async () => {
        setBusy(true);
        try {
            const res = await aiTeacherApi.createConversation();
            setConversationId(res.data.conversation.id);
            setTeacher(res.data.teacher);
            setMessages(res.data.starterMessage ? [res.data.starterMessage] : []);
            setMenuOpen(false);
            setChangingTeacher(false);
            setStep('chat');
            toast.success('گفتگوی جدید شروع شد');
        } catch (err: any) {
            toast.error(err?.message || 'ایجاد گفتگوی جدید ناموفق بود');
        } finally {
            setBusy(false);
        }
    };

    const panelProps = {
        teacher,
        settings,
        onSettingsChange: setSettings,
        onChangeTeacher: () => {
            setMenuOpen(false);
            setDesktopMenuOpen(false);
            setChangingTeacher(true);
        },
        onSelectConversation: handleSelectConversation,
        onNewChat: handleNewChat,
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

    if (changingTeacher || step === 'teacher') {
        return (
            <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden">
                <TeacherSelector
                    selectedId={teacher?.id}
                    onSelect={handleSelectTeacher}
                    onBack={
                        changingTeacher
                            ? () => {
                                setChangingTeacher(false);
                                setDesktopMenuOpen(true);
                            }
                            : step === 'teacher' && !bootstrap?.onboardingCompleted
                                ? () => setStep('profile')
                                : goHome
                    }
                    loading={busy}
                    title={changingTeacher ? 'تغییر معلم' : 'انتخاب معلم'}
                />
            </div>
        );
    }

    if (step === 'intro') {
        return (
            <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden">
                <IntroScreen loading={busy} onStart={() => setStep('profile')} />
            </div>
        );
    }

    if (step === 'profile') {
        return (
            <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden">
                <ProfileSetup
                    firstName={bootstrap?.user?.firstName}
                    lastName={bootstrap?.user?.lastName}
                    initial={bootstrap?.profile}
                    onSubmit={handleProfileSubmit}
                    onBack={() => setStep('intro')}
                    loading={busy}
                />
            </div>
        );
    }

    if (step === 'chat' && teacher) {
        return (
            <div className="flex-1 flex flex-row min-h-0 h-full overflow-hidden bg-[var(--bg-app)]">
                <div className="flex-1 flex flex-col min-w-0 min-h-0">
                    <ChatScreen
                        teacher={teacher}
                        conversationId={conversationId}
                        initialMessages={messages}
                        wallet={wallet}
                        onWalletChange={setWallet}
                        onConversationId={setConversationId}
                        onStatusChange={setChatStatus}
                        onOpenMenu={() => setMenuOpen(true)}
                        onToggleDesktopMenu={() => setDesktopMenuOpen((v) => !v)}
                        desktopMenuOpen={desktopMenuOpen}
                        onBack={goHome}
                        studentFirstName={bootstrap?.user?.firstName}
                    />
                </div>

                <DesktopAiSidePanel
                    open={desktopMenuOpen}
                    onClose={() => setDesktopMenuOpen(false)}
                    chatStatus={chatStatus}
                    walletBalance={wallet.balance || 0}
                    {...panelProps}
                />

                <MenuSheet
                    open={menuOpen}
                    onClose={() => setMenuOpen(false)}
                    {...panelProps}
                    onChangeTeacher={() => {
                        setMenuOpen(false);
                        setChangingTeacher(true);
                    }}
                />
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden">
            <AiPageShell>
                <HiddenScroll className="flex-1 flex items-center justify-center p-6">
                    <FlatPrimaryButton onClick={loadBootstrap}>تلاش دوباره</FlatPrimaryButton>
                </HiddenScroll>
            </AiPageShell>
        </div>
    );
}

export default AiTeacherView;