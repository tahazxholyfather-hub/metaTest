import { Met } from './Met';

/**
 * Tiny idle Met used in place of a Lucide glyph in the app's navigation
 * (BottomNav, SideNav, MobileMenu). Sized to match the surrounding icons;
 * `active` wakes the eyes up slightly so the current tab reads as "alive".
 */
export function MetNavIcon({ size = 22, active = false, className = '' }: { size?: number; active?: boolean; className?: string }) {
    return (
        <span className={`inline-block shrink-0 ${className}`} style={{ width: size, height: size }} aria-hidden>
            <Met size="100%" state={active ? 'happy' : 'idle'} color="violet" reducedMotion={!active} intensity={active ? 1 : 0.7} />
        </span>
    );
}

export default MetNavIcon;
