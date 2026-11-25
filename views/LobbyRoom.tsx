import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { toast } from 'sonner';

// Import your existing UI components
import { LobbyView } from './LobbyView';
import QuizPage from './testworld/QuizPage';

export default function LobbyRoom() {
    const { shareCode } = useParams<{ shareCode: string }>();
    const navigate = useNavigate();
    const socket = useSocket();

    // State to manage what we are currently looking at
    const [currentScreen, setCurrentScreen] = useState<'lobby' | 'quiz' | 'result'>('lobby');

    // State to store lobby data (users list, host info, etc.)
    const [lobbyData, setLobbyData] = useState<any>(null);

    useEffect(() => {
        if (!socket || !shareCode) return;

        // 1. As soon as we load this page, try to re-join the lobby
        // (Handles the case where the user refreshes the page)
        socket.emit('join_lobby', shareCode);

        // 2. Listen for the initial success and full state
        socket.on('join_success', (data) => {
            setLobbyData(data);
            if (data.status === 'in_progress') {
                setCurrentScreen('quiz');
            } else if (data.status === 'finished') {
                setCurrentScreen('result');
            }
        });

        // 3. Listen for general lobby updates (someone joined, left, online status changed)
        socket.on('lobby_updated', (updatedLobby) => {
            setLobbyData(updatedLobby);
        });

        // 4. Listen for the host starting the quiz
        socket.on('quiz_started', () => {
            setCurrentScreen('quiz');
            toast.info('آزمون شروع شد!'); // "Quiz started!"
        });

        // 5. Listen for being kicked
        socket.on('kicked', () => {
            toast.error('شما از لابی اخراج شدید'); // "You were kicked"
            navigate('/', { replace: true });
        });

        // 6. Listen for fatal errors
        socket.on('error', (data) => {
            toast.error(data.message);
            navigate('/', { replace: true });
        });

        return () => {
            socket.off('join_success');
            socket.off('lobby_updated');
            socket.off('quiz_started');
            socket.off('kicked');
            socket.off('error');
        };
    }, [socket, shareCode, navigate]);

    // Loading state while waiting for socket to connect and fetch data
    if (!lobbyData) {
        return (
            <div className="h-[100dvh] flex items-center justify-center bg-[var(--bg-app)] text-white">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    // Determine if the current user is the host
    // (Assuming your backend returns the user ID or role in join_success)
    const isHost = lobbyData.hostId === socket?.id; // Adjust this check based on how you identify the host

    // Render the correct view based on the state
    return (
        <div className="w-full h-[100dvh] bg-[var(--bg-app)] overflow-hidden">
            {currentScreen === 'lobby' && (
                <LobbyView
                    socket={socket}
                    lobbyData={lobbyData}
                    isHost={isHost}
                    shareCode={shareCode}
                />
            )}

            {currentScreen === 'quiz' && (
                <QuizPage
                    socket={socket}
                    lobbyData={lobbyData}
                    isHost={isHost}
                    shareCode={shareCode}
                    onFinish={() => setCurrentScreen('result')}
                />
            )}

            {currentScreen === 'result' && (
                <QuizPage
                    socket={socket}
                    lobbyData={lobbyData}
                    isHost={isHost}
                    shareCode={shareCode}
                    showResults={true} // Tell QuizPage to render the results layout
                />
            )}
        </div>
    );
}
