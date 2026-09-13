import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import type { View } from '../../types';
import { ResponsiveModal } from '../../components/ResponsiveModal';
import { Met, subjectToMetColor } from '../../components/met';
import { errorCode, errorMessage, metApi } from './api';
import type { ChatStatus, MetBootstrap, MetConversation, MetSettings, MetWallet, SubjectKey } from './types';
import { useMetChat } from './useMetChat';
import { ChatScreen } from './ChatScreen';
import type { ComposerHandle } from './Composer';
import { MetRail, RailPanelCard, type RailPanel } from './MetRail';
import { HistoryPanel } from './HistoryPanel';
import { SettingsPanel } from './SettingsPanel';
import { CoinsPanel } from './CoinsPanel';
import { SubjectPicker } from './SubjectPicker';
import { SUBJECT_FALLBACKS, sortSubjects } from './subjectIcons';
import { subscribeSharedAudio } from './audio';
import { GraySpinner, easeOut, useIsMobile } from './ui';

type Props = {
    onNavigate: (view: View) => void;
};

const PANEL_TITLES: Record<RailPanel, string> = {
    history: 'تاریخچه گفتگوها',
    settings: 'تنظیمات مِت',
    coins: 'سکه‌ها',
    subjects: 'انتخاب درس',
};

/** Root of the AI tutor. No intro screen — the student lands straight in the chat. */
export function MetView({ onNavigate }: Props) {
    const isMobile = useIsMobile();
    const [boot, setBoot] = useState<MetBootstrap | null>(null);
    const [bootError, setBootError] = useState<string | null>(null);
    const [wallet, setWallet] = useState<MetWallet | null>(null);
    const [settings, setSettings] = useState<MetSettings | null>(null);
    const [subjectKey, setSubjectKey] = useState<SubjectKey>('general');
    const [panel, setPanel] = useState<RailPanel | null>(null);
    const [historyKey, setHistoryKey] = useState(0);
    const [listeningLevel, setListeningLevel] = useState<number | null>(null);
    const [speaking, setSpeaking] = useState<{ on: boolean; level: number }>({ on: false, level: 0 });
    const composerRef = useRef<ComposerHandle | null>(null);
    const openedInitial = useRef(false);

    const handleWallet = useCallback((w: MetWallet) => setWallet((prev) => ({ ...(prev || w), ...w })), []);

    const handleConversationChange = useCallback((c: MetConversation | null) => {
        if (c) setSubjectKey(c.subjectKey);
        setHistoryKey((k) => k + 1);
    }, []);

    const chat = useMetChat({
        subjectKey,
        onWallet: handleWallet,
        onConversationChange: handleConversationChange,
        onInsufficientCoins: () => setPanel('coins'),
    });

    const chatRef = useRef(chat);
    useEffect(() => {
        chatRef.current = chat;
    });

    /* ── Bootstrap ───────────────────────────────────────────────────── */
    const [reloadKey, setReloadKey] = useState(0);
    const applyBoot = useCallback((data: MetBootstrap) => {
        setBoot(data);
        setWallet(data.wallet);
        setSettings(data.settings);
        setSubjectKey((data.latestConversation?.subjectKey || data.lastSubject || 'general') as SubjectKey);
        if (data.latestConversation && !openedInitial.current) {
            openedInitial.current = true;
            void chatRef.current.openConversation(data.latestConversation.id);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        metApi
            .bootstrap()
            .then((data) => { if (!cancelled) applyBoot(data); })
            .catch((err: unknown) => { if (!cancelled) setBootError(errorMessage(err, 'ارتباط با سرور برقرار نشد.')); });
        return () => { cancelled = true; };
    }, [applyBoot, reloadKey]);

    const load = useCallback(() => {
        setBootError(null);
        setReloadKey((k) => k + 1);
    }, []);

    /* ── TTS playback → character "speaking" ─────────────────────────── */
    useEffect(() => subscribeSharedAudio((on, level) => setSpeaking({ on, level })), []);

    const subjects = useMemo(() => sortSubjects(boot?.subjects?.length ? boot.subjects : SUBJECT_FALLBACKS), [boot?.subjects]);
    const features = boot?.features;

    const status: ChatStatus = listeningLevel != null ? 'listening' : speaking.on && chat.status === 'ready' ? 'speaking' : chat.status;
    const audioLevel = listeningLevel != null ? listeningLevel : speaking.on ? speaking.level : null;

    /* ── Actions ─────────────────────────────────────────────────────── */
    const newChat = useCallback(() => {
        if (chat.busy) return;
        chat.startNew();
        setPanel(null);
        requestAnimationFrame(() => composerRef.current?.focus());
    }, [chat]);

    const changeSubject = useCallback(
        (key: SubjectKey) => {
            if (chat.messages.length > 0) chat.startNew();
            setSubjectKey(key);
            if (panel === 'subjects') setPanel(null);
            requestAnimationFrame(() => composerRef.current?.focus());
        },
        [chat, panel]
    );

    const openConversation = useCallback(
        (id: number) => {
            if (chat.busy) return toast.message('صبر کن پاسخ فعلی تمام شود');
            void chat.openConversation(id);
            setPanel((p) => (isMobile ? null : p === 'history' ? p : null));
        },
        [chat, isMobile]
    );

    const ensureConversation = useCallback(async () => {
        if (chat.conversation) return chat.conversation.id;
        const c = await metApi.createConversation(subjectKey);
        chat.setConversation(c);
        return c.id;
    }, [chat, subjectKey]);

    const speak = useCallback(
        async (messageId: number) => {
            try {
                const res = await metApi.speak(messageId);
                if (res.wallet) handleWallet(res.wallet);
                return res.url;
            } catch (err) {
                if (errorCode(err) === 'INSUFFICIENT_COINS') setPanel('coins');
                throw err;
            }
        },
        [handleWallet]
    );

    const refreshWallet = useCallback(() => {
        metApi.wallet().then(handleWallet).catch(() => {});
    }, [handleWallet]);

    const togglePanel = useCallback((p: RailPanel) => setPanel((cur) => (cur === p ? null : p)), []);

    /* ── Render states ───────────────────────────────────────────────── */
    if (bootError && !boot) {
        return (
            <div className="ai-teacher-root flex-1 h-full grid place-items-center bg-[var(--bg-app)] p-6" dir="rtl">
                <div className="text-center max-w-[32ch]">
                    <div className="w-20 h-20 mx-auto mb-4"><Met size="100%" state="sad" color="neutral" /></div>
                    <div className="inline-flex items-center gap-1.5 text-[14px] font-extrabold text-[var(--text-primary)]"><WifiOff size={16} /> مِت در دسترس نیست</div>
                    <p className="text-[12.5px] text-[var(--text-muted)] mt-2 leading-relaxed">{bootError}</p>
                    <button type="button" onClick={load} className="mt-4 h-10 px-4 rounded-[12px] bg-[var(--color-primary-500)] text-white text-[12.5px] font-extrabold inline-flex items-center gap-1.5">
                        <RefreshCw size={14} /> تلاش دوباره
                    </button>
                </div>
            </div>
        );
    }

    if (!boot || !features || !wallet || !settings) {
        return (
            <div className="ai-teacher-root flex-1 h-full grid place-items-center bg-[var(--bg-app)]" dir="rtl">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16"><Met size="100%" state="thinking" color={subjectToMetColor(subjectKey)} /></div>
                    <GraySpinner size={16} />
                </div>
            </div>
        );
    }

    const panelContent = (p: RailPanel | null) => {
        switch (p) {
            case 'history':
                return (
                    <HistoryPanel
                        subjects={subjects}
                        activeConversationId={chat.conversation?.id ?? null}
                        refreshKey={historyKey}
                        onOpen={openConversation}
                        onDeleted={(id) => { if (chat.conversation?.id === id) chat.startNew(); }}
                        className="flex-1"
                    />
                );
            case 'settings':
                return <SettingsPanel settings={settings} features={features} onChange={setSettings} className="flex-1" />;
            case 'coins':
                return <CoinsPanel wallet={wallet} onRefresh={refreshWallet} className="flex-1" />;
            case 'subjects':
                return <SubjectPicker subjects={subjects} value={subjectKey} onChange={changeSubject} />;
            default:
                return null;
        }
    };

    const unavailableBanner = !features.available && (
        <div className="shrink-0 flex items-start gap-2.5 mx-3 sm:mx-6 mt-3 p-3 rounded-[14px] border border-amber-500/30 bg-amber-500/8 text-[12px] text-[var(--text-secondary)] leading-relaxed" dir="rtl" role="status">
            <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
                <span className="font-extrabold text-[var(--text-primary)]">مِت فعلاً در دسترس نیست.</span>{' '}
                {features.unavailableReason || 'سرویس هوش مصنوعی پیکربندی نشده است.'} تاریخچه‌ی گفتگوها همچنان قابل مشاهده است.
            </div>
        </div>
    );

    return (
        <div className="ai-teacher-root relative flex-1 flex flex-col min-h-0 h-full overflow-hidden bg-[var(--bg-app)]" dir="rtl">
            {unavailableBanner}

            <div className="relative flex-1 flex min-h-0">
                <div className={`flex-1 flex flex-col min-w-0 min-h-0 ${isMobile ? '' : 'pl-[76px]'}`}>
                    <ChatScreen
                        chat={chat}
                        features={features}
                        subjects={subjects}
                        subjectKey={subjectKey}
                        onSubjectChange={changeSubject}
                        wallet={wallet}
                        settings={settings}
                        studentFirstName={boot.user.firstName}
                        isMobile={isMobile}
                        onOpenPanel={(p) => setPanel(p)}
                        onNewChat={newChat}
                        onSpeak={speak}
                        onListening={setListeningLevel}
                        audioLevel={audioLevel}
                        ensureConversation={ensureConversation}
                        composerRef={composerRef}
                        bottomInset={isMobile ? 'var(--app-bottom-nav-space)' : undefined}
                    />
                </div>

                {/* Desktop: floating rail + panel */}
                {!isMobile && (
                    <div className="pointer-events-none absolute inset-y-0 left-3 z-30 flex items-center gap-3 py-4" dir="ltr">
                        <div className="pointer-events-auto">
                            <MetRail
                                status={status}
                                metColor={subjectToMetColor(subjectKey)}
                                audioLevel={audioLevel}
                                coins={wallet.total}
                                activePanel={panel}
                                onTogglePanel={togglePanel}
                                onChat={() => { setPanel(null); composerRef.current?.focus(); }}
                                onNewChat={newChat}
                                onGames={() => onNavigate('tests')}
                                busy={chat.busy}
                            />
                        </div>
                        <div className="pointer-events-auto h-full flex items-center">
                            <RailPanelCard open={panel !== null} title={panel ? PANEL_TITLES[panel] : ''} onClose={() => setPanel(null)}>
                                <AnimatePresence mode="wait" initial={false}>
                                    <motion.div
                                        key={panel || 'none'}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.15, ease: easeOut }}
                                        className="flex-1 min-h-0 flex flex-col"
                                    >
                                        {panelContent(panel)}
                                    </motion.div>
                                </AnimatePresence>
                            </RailPanelCard>
                        </div>
                    </div>
                )}
            </div>

            {/* Mobile: bottom sheets */}
            {isMobile && (
                <ResponsiveModal isOpen={panel !== null} onClose={() => setPanel(null)} title={panel ? PANEL_TITLES[panel] : ''}>
                    <div className="ai-teacher-root flex flex-col min-h-[40vh] max-h-[70vh]">{panelContent(panel)}</div>
                </ResponsiveModal>
            )}
        </div>
    );
}

export default MetView;
