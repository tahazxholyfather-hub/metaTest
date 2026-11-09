import { useRef, useState } from 'react';
import { Film, Image as ImageIcon, Loader2, X } from 'lucide-react';
import { adminApi } from '../../lib/adminApi';

type Kind = 'image' | 'video';

const ACCEPT: Record<Kind, string> = {
    image: 'image/jpeg,image/png,image/webp,image/gif',
    video: 'video/mp4,video/webm,video/quicktime',
};

function matches(kind: Kind, file: File) {
    return kind === 'image' ? file.type.startsWith('image/') : file.type.startsWith('video/');
}

export function MediaDrop({
    kind,
    value,
    onChange,
}: {
    kind: Kind;
    value: string;
    onChange: (url: string) => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [over, setOver] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function send(file: File) {
        setBusy(true);
        setError(null);
        try {
            const res = await adminApi.uploadBlogMedia(file);
            onChange(res.url);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'آپلود ممکن نشد');
        } finally {
            setBusy(false);
        }
    }

    function take(file: File | undefined) {
        if (!file) return;
        if (!matches(kind, file)) {
            setError(kind === 'image' ? 'فقط فایل تصویر را انتخاب کن.' : 'فقط فایل ویدیو را انتخاب کن.');
            return;
        }
        void send(file);
    }

    return (
        <div className="flex flex-col gap-2">
            <button
                type="button"
                onDragOver={(event) => { event.preventDefault(); setOver(true); }}
                onDragLeave={() => setOver(false)}
                onDrop={(event) => {
                    event.preventDefault();
                    setOver(false);
                    take(event.dataTransfer.files[0]);
                }}
                onClick={() => inputRef.current?.click()}
                className={`rounded-xl border border-dashed px-3 py-4 text-center text-xs transition ${over ? 'border-[#1a73e8] bg-[#e8f0fe]' : 'border-[#dadce0] dark:border-[#444746] bg-white dark:bg-[#1e1f20]'}`}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPT[kind]}
                    hidden
                    onChange={(event) => {
                        take(event.target.files?.[0]);
                        event.target.value = '';
                    }}
                />
                <span className="flex items-center justify-center gap-2 font-bold text-[#1a73e8]">
                    {busy ? <Loader2 size={14} className="animate-spin" /> : kind === 'image' ? <ImageIcon size={14} /> : <Film size={14} />}
                    {busy ? 'در حال آپلود…' : 'فایل را رها کن یا برای انتخاب کلیک کن'}
                </span>
            </button>
            {value && kind === 'image' ? <img src={value} alt="" className="max-h-40 w-auto rounded-lg border border-[#dadce0]" /> : null}
            {value && kind === 'video' ? <video src={value} controls className="max-h-48 w-full rounded-lg bg-black" /> : null}
            {value ? (
                <button type="button" onClick={() => onChange('')} className="self-start text-[11px] font-bold text-red-600 flex items-center gap-1">
                    <X size={12} /> حذف فایل
                </button>
            ) : null}
            {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
        </div>
    );
}
