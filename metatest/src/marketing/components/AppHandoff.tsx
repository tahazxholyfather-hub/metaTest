import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { handoffUrl, safeToken } from '../lib/handoffTarget';

type Kind = 'invite' | 'join';

const COPY: Record<Kind, { title: string; pending: string; invalid: string }> = {
    invite: {
        title: 'لینک دعوت',
        pending: 'در حال باز کردن متاتست...',
        invalid: 'این لینک دعوت معتبر نیست.',
    },
    join: {
        title: 'ورود به اتاق',
        pending: 'در حال باز کردن اتاق آزمون...',
        invalid: 'این لینک اتاق معتبر نیست.',
    },
};

/**
 * Shared links land on the marketing site (/invite/:code and /join/:code).
 * That site has no screen for them, so the page used to stay empty.
 * Send the visitor into the app, which does know what to do with the code.
 */
export function AppHandoff({ kind }: { kind: Kind }) {
    const { code } = useParams();
    const [target, setTarget] = useState('');
    const [ready, setReady] = useState(false);
    const copy = COPY[kind];

    useEffect(() => {
        const token = safeToken(code || '');
        const next = handoffUrl(kind, token, window.location.hostname);
        setReady(true);
        setTarget(next);
        if (!next) return;
        if (kind === 'invite') {
            try {
                localStorage.setItem('invite_code', token);
            } catch {
                /* the app route still receives the code in the URL */
            }
        }
        window.location.replace(next);
    }, [kind, code]);

    return (
        <main
            dir="rtl"
            style={{
                minHeight: '100dvh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
                background: '#05050A',
                color: '#F8F7FF',
                fontFamily: 'Alibaba, alibaba, system-ui, sans-serif',
            }}
        >
            <section style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 12px' }}>{copy.title}</h1>
                <p style={{ margin: 0, color: '#C4BCE8', lineHeight: 1.8 }}>
                    {!ready || target ? copy.pending : copy.invalid}
                </p>
                {ready && (
                    <a
                        href={target || '/'}
                        style={{ display: 'inline-block', marginTop: 20, color: '#A78BFA', fontWeight: 700 }}
                    >
                        {target ? 'اگر منتقل نشدید، اینجا را بزنید' : 'بازگشت به صفحه اصلی'}
                    </a>
                )}
            </section>
        </main>
    );
}
