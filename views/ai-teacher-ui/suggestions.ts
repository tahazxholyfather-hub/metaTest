import type { ElementType } from 'react';
import {
    Rocket, Puzzle, Brain, FlaskConical, Compass, Trophy, Lightbulb,
} from 'lucide-react';
import type { SubjectKey } from './types';

export type Suggestion = { icon: ElementType; title: string; hint: string; text: string };

/** Creative, subject-flavored starter prompts — shown in the empty-chat state. */
export const SUBJECT_SUGGESTIONS: Record<SubjectKey, Suggestion[]> = {
    math: [
        { icon: Brain, title: 'بسنج سطحم', hint: 'یک چالش کوتاه', text: 'یک سؤال ریاضی چالشی بپرس تا سطحم رو بسنجی، بعد بگو باید از کجا شروع کنم.' },
        { icon: Puzzle, title: 'یه معما بده', hint: 'با کمی هیجان', text: 'یک پازل یا معمای ریاضی جالب بده که با استدلال حلش کنم، نه فقط فرمول.' },
        { icon: Rocket, title: 'از صفر تا قهرمانی', hint: 'مسیر گام‌به‌گام', text: 'یک مبحث مهم ریاضی رو از پایه با مثال‌های واقعی قدم‌به‌قدم برام باز کن.' },
        { icon: Trophy, title: 'آزمونک سریع', hint: 'مثل کنکور', text: 'یک آزمون کوتاه شبیه کنکور از من بگیر و در پایان نمره و نقاط ضعفم رو بگو.' },
    ],
    biology: [
        { icon: Compass, title: 'سفر درون سلول', hint: 'با کتاب درسی', text: 'مثل یک سفر، اجزای سلول رو طبق کتاب درسی برام تصویرسازی کن و توضیح بده.' },
        { icon: Brain, title: 'بسنج سطحم', hint: 'یک سؤال مفهومی', text: 'یک سؤال مفهومی زیست بپرس تا بفهمی از کجا باید شروع کنیم.' },
        { icon: FlaskConical, title: 'یک پدیده رو باز کن', hint: 'چرا این‌طور می‌شود؟', text: 'یک پدیده زیستی جالب (مثل ایمنی بدن) رو انتخاب کن و برام باز کن چرا این‌طور اتفاق می‌افتد.' },
        { icon: Trophy, title: 'آزمونک سریع', hint: 'مرور فصل', text: 'از یک فصل مهم زیست یک آزمون کوتاه بگیر و نتیجه رو تحلیل کن.' },
    ],
    physics: [
        { icon: Rocket, title: 'شهودش رو بگیر', hint: 'قبل از فرمول', text: 'یک قانون فیزیک رو اول با شهود روزمره توضیح بده، بعد فرمولش رو با یک مثال حل کن.' },
        { icon: Brain, title: 'بسنج سطحم', hint: 'یک سؤال چالشی', text: 'یک سؤال فیزیک چالشی بپرس ببین چقدر بلدم و از کجا ادامه بدیم.' },
        { icon: Puzzle, title: 'اشتباه رایج رو نشونم بده', hint: 'قبل از امتحان', text: 'رایج‌ترین اشتباهات دانش‌آموزها رو در یک مبحث فیزیک بگو و کمکم کن ازشون دور بمونم.' },
        { icon: Trophy, title: 'آزمونک سریع', hint: 'با نمره و تحلیل', text: 'یک آزمون کوتاه فیزیک بگیر و در پایان نمره و نکته‌ی بهبود رو بگو.' },
    ],
    chemistry: [
        { icon: FlaskConical, title: 'چرا این واکنش؟', hint: 'با معادله', text: 'یک واکنش شیمیایی جالب انتخاب کن، معادله‌اش رو بنویس و بگو چرا این‌طور اتفاق می‌افتد.' },
        { icon: Brain, title: 'بسنج سطحم', hint: 'یک سؤال مفهومی', text: 'یک سؤال مفهومی شیمی بپرس تا بفهمیم از کجا شروع کنیم.' },
        { icon: Lightbulb, title: 'محاسبه رو یادم بده', hint: 'استوکیومتری و مول', text: 'یک مسئله‌ی استوکیومتری قدم‌به‌قدم حل کن و بعد شبیهش رو بده تا خودم حل کنم.' },
        { icon: Trophy, title: 'آزمونک سریع', hint: 'با نمره و تحلیل', text: 'یک آزمون کوتاه شیمی بگیر و نقاط قوت و ضعفم رو بگو.' },
    ],
};
