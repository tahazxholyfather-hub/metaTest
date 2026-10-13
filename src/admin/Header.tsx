import React from 'react';
import { Menu, Moon, Sun, Bell, Search } from 'lucide-react';

interface HeaderProps {
    toggleSidebar: () => void;
    isDarkMode: boolean;
    toggleDarkMode: () => void;
    title: string;
}

const Header: React.FC<HeaderProps> = ({ toggleSidebar, isDarkMode, toggleDarkMode, title }) => {
    return (
        <header className="h-16 flex items-center justify-between px-6 shrink-0 z-30">
            <div className="flex items-center gap-4">
                <button onClick={toggleSidebar} className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-[#333537] rounded-full transition-colors">
                    <Menu size={20} />
                </button>
                <h2 className="text-lg font-medium tracking-tight text-[#1f1f1f] dark:text-[#e3e3e3]">{title}</h2>
            </div>

            <div className="flex items-center gap-3">


                <button className="p-2 hover:bg-gray-100 dark:hover:bg-[#333537] rounded-full transition-colors relative">
                    <Bell size={18} />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-[#1a73e8] border-2 border-[#f8f9fa] dark:border-[#131314] rounded-full" />
                </button>

                <button onClick={toggleDarkMode} className="p-2 hover:bg-gray-100 dark:hover:bg-[#333537] rounded-full transition-colors">
                    {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>
            </div>
        </header>
    );
};

export default Header;