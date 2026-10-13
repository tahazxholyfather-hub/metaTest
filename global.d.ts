// src/global.d.ts

export {};

declare global {
    interface Window {
        MathJax: {
            typesetPromise: (elements?: any[]) => Promise<void>;
            typesetClear: (elements?: any[]) => void;
            [key: string]: any;
        };
    }
}
declare namespace JSX {
    interface IntrinsicElements {
        'lord-icon': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
            src?: string;
            trigger?: string;
            colors?: string;
            delay?: string | number;
            style?: React.CSSProperties;
        };
    }
}