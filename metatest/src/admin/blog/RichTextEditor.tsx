import { useEffect, useRef } from 'react';
import { Bold, Italic, Underline } from 'lucide-react';

export function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (ref.current && document.activeElement !== ref.current && ref.current.innerHTML !== (value || '')) {
            ref.current.innerHTML = value || '';
        }
    }, [value]);
    const exec = (command: string) => {
        ref.current?.focus();
        document.execCommand(command);
        onChange(ref.current?.innerHTML || '');
    };
    return (
        <div className="rounded-xl border border-[#dadce0] dark:border-[#444746] overflow-hidden">
            <div className="flex gap-1 p-1 border-b border-[#dadce0] dark:border-[#333537] bg-[#f8f9fa] dark:bg-[#131314]">
                <button type="button" onClick={() => exec('bold')} className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#1e1f20]"><Bold size={14} /></button>
                <button type="button" onClick={() => exec('italic')} className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#1e1f20]"><Italic size={14} /></button>
                <button type="button" onClick={() => exec('underline')} className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#1e1f20]"><Underline size={14} /></button>
            </div>
            <div
                ref={ref}
                contentEditable
                dir="rtl"
                className="min-h-28 px-3 py-2 text-sm outline-none"
                onInput={() => onChange(ref.current?.innerHTML || '')}
            />
        </div>
    );
}
