import React from 'react';
import { LayoutDashboard, Layers, LogOut, Hexagon, ChevronLeft, ListTree, FileText, FilePlus2 } from 'lucide-react';
import type { User } from './AuthView';

interface SidebarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    user: User;
    onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isOpen, setIsOpen, user, onLogout }) => {
    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'edit-questions', label: 'Edit Questions', icon: Layers },
        { id: 'insert-questions', label: 'Insert Questions', icon: FilePlus2 },
        { id: 'curriculum', label: 'Curriculum', icon: ListTree },
        { id: 'pdf-library', label: 'PDF Library', icon: FileText },
    ];

    return (
        <>
            {/* Mobile Backdrop */}
            {isOpen && (
                <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-60 lg:hidden" onClick={() => setIsOpen(false)} />
            )}

            <aside className={`
                fixed lg:relative z-70 h-full w-64 bg-white dark:bg-[#1e1f20] border-l border-[#dadce0] dark:border-[#333537]
                flex flex-col transition-transform duration-300
                ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
            `}>
                <div className="h-16 flex items-center px-6 gap-3">
                    <div className="p-1.5 bg-[#1a73e8] rounded-lg shadow-inner">
                        <Hexagon size={18} className="text-white" fill="currentColor" />
                    </div>
                    <span className="font-semibold text-[#1f1f1f] dark:text-[#e3e3e3] tracking-tight">Admin Panel</span>
                </div>

                <nav className="flex-1 px-3 py-4 space-y-1">
                    {navItems.map((item) => {
                        const isActive = activeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`
                                    w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium transition-all
                                    ${isActive
                                    ? 'bg-[#e8f0fe] dark:bg-[#2d3748] text-[#1a73e8] dark:text-[#8ab4f8]'
                                    : 'text-[#444746] dark:text-[#c4c7c5] hover:bg-[#f1f3f4] dark:hover:bg-[#333537]'}
                                `}
                            >
                                <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                                {item.label}
                            </button>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-[#dadce0] dark:border-[#333537]">
                    <div className="flex items-center gap-3 px-2 py-3 bg-[#f8f9fa] dark:bg-[#131314] rounded-2xl">
                        <div className="w-8 h-8 rounded-full bg-[#1a73e8] flex items-center justify-center text-white text-[10px] font-bold">
                            {user.username.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate uppercase tracking-tighter">{user.username}</p>
                            <p className="text-[10px] text-[#86868b] truncate">{user.role}</p>
                        </div>
                        <button onClick={onLogout} className="p-2 text-[#86868b] hover:text-red-500 transition-colors">
                            <LogOut size={14} />
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;