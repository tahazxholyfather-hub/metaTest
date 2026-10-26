// src/views/TestWorldView.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

import MainTestSelector from './testworld/MainTestSelector';
import { NeedsView } from './testworld/NeedsView';
import { QuestionSelectorView } from './testworld/QuestionSelectorView';
import { NotFoundView } from './testworld/NotFoundView';
import { useUser } from '../context/UserContext';
import { useSocket } from '../socket/useSocket';
import { flowApi } from '../lib/authApi';

export interface TestWorldProps {
    onStateChange?: (state: any) => void;
    isCollapsed?: boolean;
    onToggleHeader?: (hidden: boolean) => void;
    theme: string;
}

const VALID_VIEWS = ['main', 'needs', 'selector'];


export const TestWorldView = ({
                                  isCollapsed,
                                  onStateChange,
                                  onToggleHeader,
                                  theme
                              }: TestWorldProps) => {
    const [activeView, setActiveView] = useState<string>('main');
    const [shareCode, setShareCode] = useState<string>('');
    const [hasProcessedJoinUrl, setHasProcessedJoinUrl] = useState(false);

    const { user } = useUser();
    const { socket, isConnected } = useSocket();
    const navigate = useNavigate();

    const navigateTo = useCallback(
        (viewId: string, pushState = true) => {
            setActiveView(viewId);

            if (pushState && viewId !== 'main') {
                window.dispatchEvent(new CustomEvent('app-history-push', {
                    detail: { kind: 'tests', screen: viewId },
                }));
            }

            onStateChange?.({ view: viewId });
        },
        [onStateChange]
    );

    const handleBack = useCallback(() => {
        window.dispatchEvent(new CustomEvent('app-request-back'));
    }, []);

    const handleStartNeeds = useCallback(async (viewId: 'needs' | 'selector' = 'needs') => {
        try {
            const response = await flowApi.dispatch('generate_code');

            if (!response.success) {
                throw new Error('Failed to get share code');
            }

            setShareCode(response.data.code);
            navigateTo(viewId);
        } catch (error) {
            console.error('Error requesting share code:', error);
        }
    }, [navigateTo]);

    useEffect(() => {
        const handleScreen = (event: Event) => {
            const screen = (event as CustomEvent<string>).detail;
            if (screen === 'main' || screen === 'needs' || screen === 'selector') {
                setActiveView(screen);
            }
        };
        window.addEventListener('testworld-screen', handleScreen);
        return () => window.removeEventListener('testworld-screen', handleScreen);
    }, []);

    useEffect(() => {
        if (!user || !socket || !isConnected || hasProcessedJoinUrl) return;

        const path = window.location.pathname;
        const match = path.match(/\/join\/([a-zA-Z0-9_-]+)/);

        if (!match?.[1]) return;

        const code = match[1];
        setShareCode(code);
        setHasProcessedJoinUrl(true);

        navigate(`/lobby/${code}`, { replace: true });
    }, [user, socket, isConnected, hasProcessedJoinUrl, navigate]);

    useEffect(() => {
        onToggleHeader?.(false);

        return () => {
            onToggleHeader?.(false);
        };
    }, [activeView, onToggleHeader]);

    return (
        <div
            className={`${activeView === 'selector' ? 'h-full overflow-hidden' : 'h-full overflow-y-auto'} bg-[var(--bg-app)] text-[var(--text-primary)] font-sans`}
            dir="rtl"
        >
            <AnimatePresence mode="wait">
                {activeView === 'main' && (
                    <MainTestSelector
                        key="main"
                        theme={theme}
                        onStart={(id) => {
                            if (id === 'needs' || id === 'selector') {
                                handleStartNeeds(id);
                            } else {
                                navigateTo(id);
                            }
                        }}
                        onJoinLobby={async (code: string) => {
                            if (!socket || !isConnected) {
                                throw new Error('اتصال به سرور برقرار نیست.');
                            }

                            setShareCode(code);
                            navigate(`/lobby/${code}`);
                        }}
                    />
                )}

                {activeView === 'selector' && (
                    <QuestionSelectorView
                        key="selector"
                        shareCode={shareCode}
                        onBack={handleBack}
                    />
                )}

                {activeView === 'needs' && (
                    <NeedsView
                        key="needs"
                        onBack={handleBack}
                        isCollapsed={isCollapsed}
                        shareCode={shareCode}
                        onQuizStart={(data: any) => {
                            const finalShareCode = data?.shareCode || shareCode || '';
                            setShareCode(finalShareCode);

                            if (data?.settings?.visibility === 'public') {
                                if (finalShareCode) {
                                    navigate(`/lobby/${finalShareCode}`);
                                }
                            } else {
                                const quizId =
                                    data?.quizId ||
                                    data?.id ||
                                    data?._id;

                                if (quizId) {
                                    navigate(`/quiz/${quizId}`);
                                } else {
                                    console.error('Quiz ID not found for private quiz');
                                }
                            }
                        }}
                    />
                )}

                {!VALID_VIEWS.includes(activeView) && (
                    <NotFoundView
                        key="not-found"
                        onBack={handleBack}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default TestWorldView;
