import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../lib/socket';
import './ChatView.css'; // Import the new CSS file

// --- Type Definitions based on your server.js ---
interface ChatMessage {
    id: string;
    username: string;
    text: string;
    timestamp: number;
    likes: number;
    reply_to_id: string | null;
    reply_to_user: string | null;
    reply_to_text: string | null;
}

interface ChatViewProps {
    onBack: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({ onBack }) => {
    // --- State Management ---
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isConnected, setIsConnected] = useState(socket.connected);
    const [username, setUsername] = useState('');
    const [onlineCount, setOnlineCount] = useState(0);
    const [typingUsers, setTypingUsers] = useState<string[]>([]);
    const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);

    // --- Refs ---
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messageInputRef = useRef<HTMLInputElement>(null);

    // --- Utility Functions ---
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const getTypingIndicatorText = (): string => {
        const otherTypingUsers = typingUsers.filter(u => u !== username);
        if (otherTypingUsers.length === 0) {
            return '';
        }
        if (otherTypingUsers.length === 1) {
            return `${otherTypingUsers[0]} در حال نوشتن است...`;
        }
        return `${otherTypingUsers.length} نفر در حال نوشتن هستند...`;
    };

    // --- Socket Event Handling ---
    useEffect(() => {
        const setupUsername = () => {
            let storedUsername = localStorage.getItem('chat_username');
            if (!storedUsername) {
                storedUsername = prompt("لطفا نام کاربری خود را وارد کنید:") || 'کاربر ناشناس';
                localStorage.setItem('chat_username', storedUsername);
            }
            setUsername(storedUsername);
            socket.emit('join', storedUsername); // Use 'join' event from your server
        };

        // --- Event Handlers ---
        const handleConnect = () => {
            setIsConnected(true);
            setupUsername();
        };

        const handleDisconnect = () => setIsConnected(false);
        const handleLoadHistory = (history: ChatMessage[]) => setMessages(history);
        const handleUpdateUsers = (count: number) => setOnlineCount(count);
        const handleTypingStatus = (users: string[]) => setTypingUsers(users);

        const handleChatMessage = (message: ChatMessage) => {
            setMessages((prev) => [...prev, message]);
        };

        const handleMessageLiked = ({ id, count }: { id: string, count: number }) => {
            setMessages(prev => prev.map(msg => msg.id === id ? { ...msg, likes: count } : msg));
        };

        // --- Register Listeners (matching server.js) ---
        if (!socket.connected) socket.connect();

        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('load_history', handleLoadHistory);
        socket.on('update_users', handleUpdateUsers);
        socket.on('typing_status', handleTypingStatus);
        socket.on('chat_message', handleChatMessage);
        socket.on('message_liked', handleMessageLiked);

        // --- Cleanup ---
        return () => {
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
            socket.off('load_history', handleLoadHistory);
            socket.off('update_users', handleUpdateUsers);
            socket.off('typing_status', handleTypingStatus);
            socket.off('chat_message', handleChatMessage);
            socket.off('message_liked', handleMessageLiked);
        };
    }, []);

    // Effect for auto-scrolling
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // --- Typing Indicator Logic ---
    useEffect(() => {
        let typingTimeout: NodeJS.Timeout | null = null;

        const handleTyping = () => {
            socket.emit('typing');
            if (typingTimeout) clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => socket.emit('stop_typing'), 1500);
        };

        const inputElement = messageInputRef.current;
        if (inputElement) {
            inputElement.addEventListener('input', handleTyping);
        }

        return () => {
            if (inputElement) {
                inputElement.removeEventListener('input', handleTyping);
            }
            if (typingTimeout) clearTimeout(typingTimeout);
        };
    }, []);

    // --- Component Logic ---
    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        const text = newMessage.trim();
        if (!text || !isConnected) return;

        socket.emit('chat_message', {
            text,
            replyTo: replyingTo ? {
                id: replyingTo.id,
                user: replyingTo.username,
                text: replyingTo.text
            } : null
        });

        setNewMessage('');
        setReplyingTo(null);
    };

    const handleSetReply = (message: ChatMessage) => {
        setReplyingTo(message);
        messageInputRef.current?.focus();
    };

    const handleLikeMessage = (messageId: string) => {
        socket.emit('like_message', messageId);
    };

    return (
        <div className="chat-container">
            <header className="chat-header">
                <button className="action-button" onClick={onBack}>بازگشت</button>
                <div className="header-center">
                    <h1 id="header-username">{username}</h1>
                    <p id="typing-indicator">{getTypingIndicatorText()}</p>
                </div>
                <div id="online-count">
                    <span></span>
                    {onlineCount} آنلاین
                </div>
            </header>

            <ul className="messages-list">
                {messages.map((msg) => {
                    const isMe = msg.username === username;
                    return (
                        <li key={msg.id} className={`message-item ${isMe ? 'me' : 'other'}`}>
                            <div className="message-content">
                                {!isMe && <div className="message-header"><span className="message-username">{msg.username}</span></div>}
                                {msg.reply_to_user && (
                                    <div className="reply-quote">
                                        <div className="reply-quote-user">{msg.reply_to_user}</div>
                                        <div className="reply-quote-text">{msg.reply_to_text}</div>
                                    </div>
                                )}
                                <p className="message-text">{msg.text}</p>
                            </div>
                            <div className="message-actions">
                                {!isMe && <button onClick={() => handleSetReply(msg)} className="action-button">پاسخ</button>}
                                <button onClick={() => handleLikeMessage(msg.id)} className="action-button like-button">
                                    ❤️ <span className="like-count">{msg.likes > 0 && msg.likes}</span>
                                </button>
                                <span className="message-timestamp">{new Date(msg.timestamp).toLocaleTimeString('fa-IR')}</span>
                            </div>
                        </li>
                    );
                })}
                <div ref={messagesEndRef} />
            </ul>

            {replyingTo && (
                <div id="reply-preview">
                    <div className="reply-preview-content">
                        <div>در حال پاسخ به <strong>{replyingTo.username}</strong></div>
                        <div className="reply-quote-text">{replyingTo.text}</div>
                    </div>
                    <button id="cancel-reply-btn" onClick={() => setReplyingTo(null)}>&times;</button>
                </div>
            )}

            <div className="chat-form-container">
                <form id="chat-form" onSubmit={handleSendMessage}>
                    <input
                        id="message-input"
                        ref={messageInputRef}
                        type="text"
                        placeholder={isConnected ? "پیام خود را بنویسید..." : "در حال اتصال..."}
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        disabled={!isConnected}
                        autoComplete="off"
                    />
                    <button id="send-button" type="submit" disabled={!isConnected || !newMessage.trim()}>
                        ارسال
                    </button>
                </form>
            </div>
        </div>
    );
};
