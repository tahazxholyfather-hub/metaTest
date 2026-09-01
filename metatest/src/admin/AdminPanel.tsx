import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import Dashboard from './Dashboard';
import EditQuestions from './EditQuestions';
import InsertQuestions from './InsertQuestions';
import CurriculumManager from './CurriculumManager';
import PdfLibraryManager from './PdfLibraryManager';
import AuthView, { type User } from './AuthView'; // Importing User interface from AuthView
import Spinner from './Spinner';
import { flowApi } from '../lib/authApi';

export default function AdminPanel() {
    const [user, setUser] = useState<User | null>(null);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const savedTheme = localStorage.getItem('AdminTheme');
        if (savedTheme) {
            return savedTheme === 'dark';
        }
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    // App now boots into a verification state
    const [isBooting, setIsBooting] = useState(true);
    const [isLoadingView, setIsLoadingView] = useState(false);

    // Session Verification on Mount
    useEffect(() => {
        const verifySession = async () => {
            try {
                // Endpoint that checks if the HttpOnly cookie is valid
                const res = await flowApi.dispatch('admin_verify');

                if (res?.success && res?.user) {
                    setUser(res.user);
                }
            } catch (error) {
                console.log('No active session found or verification failed.', error);
            } finally {
                setIsBooting(false);
            }
        };

        verifySession();
    }, []);

    // Theme Management
    useEffect(() => {
        const theme = isDarkMode ? 'dark' : 'light';
        const root = document.documentElement;

        root.classList.remove('dark', 'light');
        root.classList.add(theme);

        localStorage.setItem('AdminTheme', theme);
    }, [isDarkMode]);

    const handleTabChange = (tab: string) => {
        if (tab === activeTab) return;
        setIsLoadingView(true);
        setActiveTab(tab);
        setTimeout(() => setIsLoadingView(false), 400);
    };

    // Logout Handler
    const handleLogout = async () => {
        try {
            // Tell the backend to clear the HttpOnly cookie
            await flowApi.dispatch('admin_logout');
        } catch (error) {
            console.error('Logout failed:', error);
        } finally {
            setUser(null);
        }
    };

    // Loading State
    if (isBooting) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f8f9fa] dark:bg-[#0e0e0e]">
                <Spinner />
                <p className="mt-6 text-[11px] font-medium tracking-[0.2em] text-[#86868b] uppercase animate-pulse">
                    Verifying Session
                </p>
            </div>
        );
    }

    // Unauthenticated State
    if (!user) {
        return <AuthView onLogin={(userData) => setUser(userData)} />;
    }

    // Authenticated State
    return (
        <div className="flex h-screen w-full bg-[#f8f9fa] dark:bg-[#131314] text-[#1f1f1f] dark:text-[#e3e3e3] font-sans overflow-hidden" dir="rtl">
            {/* Sidebar */}
            <Sidebar
                activeTab={activeTab}
                setActiveTab={handleTabChange}
                isOpen={isSidebarOpen}
                setIsOpen={setIsSidebarOpen}
                user={user} // Sending the full user object
                onLogout={handleLogout}
            />

            {/* Content Area */}
            <div className="flex-1 flex flex-col min-w-0 relative h-full">
                <Header
                    toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                    isDarkMode={isDarkMode}
                    toggleDarkMode={() => setIsDarkMode(!isDarkMode)}
                    title={
                        activeTab === 'dashboard' ? 'Overview'
                            : activeTab === 'insert-questions' ? 'Insert Questions'
                                : activeTab === 'curriculum' ? 'Curriculum'
                                    : activeTab === 'pdf-library' ? 'PDF Library'
                                        : 'Repository'
                    }
                />

                <main className="flex-1 overflow-y-auto relative scrollbar-hide">
                    {/* Content Fade Mask */}
                    <div className="sticky top-0 z-10 h-6 bg-gradient-to-b from-[#f8f9fa] dark:from-[#131314] to-transparent pointer-events-none" />

                    <div className="px-6 pb-12">
                        {isLoadingView ? (
                            <div className="flex h-[60vh] items-center justify-center">
                                <Spinner />
                            </div>
                        ) : (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                {activeTab === 'dashboard' && <Dashboard />}
                                {activeTab === 'edit-questions' && <EditQuestions />}
                                {activeTab === 'insert-questions' && <InsertQuestions />}
                                {activeTab === 'curriculum' && <CurriculumManager user={user} />}
                                {activeTab === 'pdf-library' && <PdfLibraryManager user={user} />}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}