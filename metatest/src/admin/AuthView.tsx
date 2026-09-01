import React, { useState } from 'react';
import { flowApi } from '../lib/authApi';
import {
    ArrowRight, Lock, Mail, Hexagon, Eye, EyeOff, AlertCircle, Loader2
} from 'lucide-react';

export interface User {
    id: number;
    username: string;
    role: string;
}

interface AuthViewProps {
    onLogin: (user: User) => void;
}

const AuthView: React.FC<AuthViewProps> = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const res = await flowApi.dispatch('admin_login', {
                username: email,
                password: password,
            });

            console.log("API RESPONSE:", res);

            // Expecting success and the full user object from the backend
            if (res?.success && res?.user) {
                // Note: We no longer set localStorage here, as we are relying on HttpOnly cookies
                // set by the backend for security.
                onLogin(res.user);
            } else {
                setError(res?.message || "Invalid credentials");
                setIsLoading(false);
            }
        } catch (err) {
            console.error('Login error:', err);
            setError('Unable to reach server. Please try again.');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-[#131314] p-6 font-sans">
            <div className="w-full max-w-[420px] space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">

                {/* Header Logo & Title */}
                <div className="text-center space-y-4">
                    <div className="w-14 h-14 bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-2xl mx-auto flex items-center justify-center shadow-sm">
                        <Hexagon className="text-[#1a73e8]" size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-gray-800 dark:text-gray-100">
                            Admin Panel
                        </h1>
                        <p className="text-sm font-medium text-[#86868b] mt-1">
                            Sign in to manage tam24.app
                        </p>
                    </div>
                </div>

                {/* Form Card */}
                <form
                    onSubmit={handleSubmit}
                    className="bg-white dark:bg-[#1e1f20] p-8 rounded-[2rem] border border-[#dadce0] dark:border-[#333537] shadow-xl shadow-gray-200/40 dark:shadow-none space-y-6"
                >
                    <div className="space-y-5">
                        {/* Username Input */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#86868b] px-1">Username</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#86868b] group-focus-within:text-[#1a73e8] transition-colors" size={18} />
                                <input
                                    type="text"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746] text-gray-800 dark:text-gray-200 rounded-xl pl-12 pr-4 py-3.5 text-sm outline-none focus:border-[#1a73e8] focus:ring-4 focus:ring-[#1a73e8]/10 transition-all"
                                    placeholder="username"
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#86868b] px-1">Password</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#86868b] group-focus-within:text-[#1a73e8] transition-colors" size={18} />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-[#f8f9fa] dark:bg-[#131314] border border-[#dadce0] dark:border-[#444746] text-gray-800 dark:text-gray-200 rounded-xl pl-12 pr-12 py-3.5 text-sm outline-none focus:border-[#1a73e8] focus:ring-4 focus:ring-[#1a73e8]/10 transition-all"
                                    placeholder="••••••••"
                                    disabled={isLoading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#86868b] hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Error Alert */}
                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-xs font-semibold animate-in fade-in zoom-in-95">
                            <AlertCircle size={14} className="shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-[#1a73e8] hover:bg-[#1557b0] disabled:bg-[#1a73e8]/70 text-white font-bold text-sm py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98]"
                    >
                        {isLoading ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <>
                                Secure Sign In
                                <ArrowRight size={16} />
                            </>
                        )}
                    </button>
                </form>

                {/* Footer */}
                <p className="text-center text-xs text-[#86868b] font-medium">
                    Made by SOLTECH
                </p>
            </div>
        </div>
    );
};

export default AuthView;
