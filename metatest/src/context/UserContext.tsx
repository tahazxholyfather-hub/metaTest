// src/context/UserContext.tsx

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { getCookie, removeCookie } from "../lib/cookies"; // setCookie حذف شد چون اینجا استفاده نمی‌شود
import { flowApi } from '../lib/authApi';

// Updated to match your exact backend response
export type UserData = {
    id?: number;
    username?: string;
    email?: string | null;
    phone?: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string | null;
    bio?: string | null;
    password_set?: boolean;
    current_plan?: string;
    days_remaining?: number;
    role?: 'user' | 'guest' | 'admin' | 'developer';
    status?: string;
    trophies?: number;
    xp_level?: number;
    xp_points?: number;
    social_links?: Record<string, any>;
};

interface UserContextType {
    user: UserData | null;
    setUser: React.Dispatch<React.SetStateAction<UserData | null>>;
    isAuthenticated: boolean;
    isAuthLoading: boolean; // این استیت برای جلوگیری از خطای null بسیار مهم است
    updateUserRewards: (addedTrophies: number, addedXp: number) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<UserData | null>(null);
    const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);


    // If user is not null, they are authenticated.
    const isAuthenticated = !!user;

    useEffect(() => {
        const token = getCookie("auth_token");

        if (token) {
            setIsAuthLoading(true);
            flowApi.getUserInfo()
                .then(response => {
                    if (response.success && response.data) {
                        setUser(response.data);
                        // No need to set isAuthenticated manually anymore
                    } else {
                        removeCookie("auth_token");
                        setUser(null);
                    }
                })
                .catch(error => {
                    console.error("Error fetching user:", error);
                    removeCookie("auth_token");
                    setUser(null);
                })
                .finally(() => {
                    setIsAuthLoading(false);
                });
        } else {
            setUser(null);
            setIsAuthLoading(false);
        }
    }, []);

    const updateUserRewards = (addedTrophies: number, addedXp: number) => {
        setUser((prevUser) => {
            if (!prevUser) return prevUser;
            return {
                ...prevUser,
                trophies: prevUser.trophies + addedTrophies,
                xp_points: prevUser.xp_points + addedXp,
            };
        });
    };

    return (
        <UserContext.Provider value={{ user, setUser, isAuthenticated, isAuthLoading, updateUserRewards }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};
