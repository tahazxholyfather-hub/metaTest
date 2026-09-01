import { useMemo } from 'react';

/**
 * A simple hook to play audio elements.
 * It memoizes the Audio object to prevent re-creation on re-renders.
 * @param url - The path to the audio file (e.g., '/sounds/tick.mp3').
 * @returns A `play` function.
 */
export const useAudio = (url: string) => {
    const audio = useMemo(() => {
        if (typeof window !== 'undefined') {
            return new Audio(url);
        }
        return null;
    }, [url]);

    const play = () => {
        if (audio) {
            // Check mute state directly from local storage before playing
            const isMuted = localStorage.getItem('quiz_muted') === 'true';
            if (isMuted) return;

            audio.currentTime = 0;
            audio.play().catch(e => {
                console.error(`Could not play audio: ${e.message}`);
            });
        }
    };

    return play;
};
