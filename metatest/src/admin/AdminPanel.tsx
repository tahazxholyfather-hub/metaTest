import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import Dashboard from './Dashboard';
import EditQuestions from './EditQuestions';
import InsertQuestions from './InsertQuestions';
import CurriculumManager from './CurriculumManager';
import PdfLibraryManager from './PdfLibraryManager';
import DiscountCodesManager from './DiscountCodesManager';
import ReferralSettings from './ReferralSettings';
import WithdrawalRequests from './WithdrawalRequests';
import AdminsManager from './AdminsManager';
import AiManager from './AiManager';
import WordStats from './WordStats';
import DiscountManager from './DiscountManager';
import ReportsManager from './ReportsManager';
import AccessManager from './AccessManager';
import AuthView, { type User } from './AuthView';
import Spinner from './Spinner';
import { adminApi } from '../lib/adminApi';
import { ADMIN_NAV, canAccessSection, sectionTitle } from './access';

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
                const res = await adminApi.me();

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

        const onExpired = () => setUser(null);
        const refreshAccess = async () => {
            try {
                const res = await adminApi.me();
                if (res?.success && res?.user) setUser(res.user as User);
            } catch {
                // A 401 already clears the session through admin-session-expired.
            }
        };
        const onDenied = () => { refreshAccess(); };
        window.addEventListener('admin-session-expired', onExpired);
        window.addEventListener('admin-access-denied', onDenied);
        window.addEventListener('focus', refreshAccess);
        return () => {
            window.removeEventListener('admin-session-expired', onExpired);
            window.removeEventListener('admin-access-denied', onDenied);
            window.removeEventListener('focus', refreshAccess);
        };
    }, []);

    // Theme Management
    useEffect(() => {
        const theme = isDarkMode ? 'dark' : 'light';
        const root = document.documentElement;

        root.classList.remove('dark', 'light');
        root.classList.add(theme);

        localStorage.setItem('AdminTheme', theme);
    }, [isDarkMode]);

    useEffect(() => {
        if (!user) return;
        if (canAccessSection(user, activeTab)) return;
        const next = ADMIN_NAV.find((item) => canAccessSection(user, item.id));
        setActiveTab(next?.id || 'dashboard');
    }, [user, activeTab]);

    const handleTabChange = (tab: string) => {
        if (!user || tab === activeTab) return;
        if (!canAccessSection(user, tab)) return;
        setIsLoadingView(true);
        setActiveTab(tab);
        setTimeout(() => setIsLoadingView(false), 400);
    };

    // Logout Handler
    const handleLogout = async () => {
        try {
            // Tell the backend to clear the HttpOnly cookie
            await adminApi.logout();
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
                    title={activeTab === 'dashboard' ? 'Overview' : sectionTitle(activeTab)}
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
                                {activeTab === 'dashboard' && canAccessSection(user, 'dashboard') && <Dashboard />}
                                {activeTab === 'edit-questions' && canAccessSection(user, 'edit-questions') && <EditQuestions />}
                                {activeTab === 'insert-questions' && canAccessSection(user, 'insert-questions') && <InsertQuestions />}
                                {activeTab === 'curriculum' && canAccessSection(user, 'curriculum') && <CurriculumManager user={user} />}
                                {activeTab === 'pdf-library' && canAccessSection(user, 'pdf-library') && <PdfLibraryManager user={user} />}
                                {activeTab === 'discount-codes' && canAccessSection(user, 'discount-codes') && <DiscountCodesManager user={user} />}
                                {activeTab === 'referral-settings' && canAccessSection(user, 'referral-settings') && <ReferralSettings user={user} />}
                                {activeTab === 'withdrawals' && canAccessSection(user, 'withdrawals') && <WithdrawalRequests user={user} />}
                                {activeTab === 'word-stats' && canAccessSection(user, 'word-stats') && <WordStats />}
                                {activeTab === 'discounts' && canAccessSection(user, 'discounts') && <DiscountManager />}
                                {activeTab === 'reports' && canAccessSection(user, 'reports') && <ReportsManager />}
                                {activeTab === 'ai-manager' && canAccessSection(user, 'ai-manager') && <AiManager />}
                                {activeTab === 'admins' && canAccessSection(user, 'admins') && <AdminsManager currentUser={user} />}
                                {activeTab === 'access' && canAccessSection(user, 'access') && <AccessManager />}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}