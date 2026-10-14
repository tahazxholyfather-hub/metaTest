import { useEffect } from 'react';
import { App } from './ui/App';
import './styles.css';

const FONT_HREF =
    'https://fonts.googleapis.com/css2?family=Russo+One&family=Unbounded:wght@300;600;800;900&family=JetBrains+Mono:wght@500;700&family=Vazirmatn:wght@400;500;600;700&display=swap';

function useChemballFonts() {
    useEffect(() => {
        const id = 'chemball-fonts';
        if (document.getElementById(id)) return;
        const link = document.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        link.href = FONT_HREF;
        document.head.appendChild(link);
    }, []);
}

export function ChemballGame({ onExit }: { onExit: () => void }) {
    useChemballFonts();
    return (
        <div className="chemball-root h-full w-full min-h-0">
            <App onExit={onExit} />
        </div>
    );
}
