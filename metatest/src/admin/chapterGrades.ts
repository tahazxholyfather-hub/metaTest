/** Same grade words the quiz world uses. «دهم» is not counted inside longer ordinals. */
export function gradesFromTopicTitle(title: string): number[] {
    const text = String(title || '').replace(/ي/g, 'ی').replace(/ك/g, 'ک');
    const found: number[] = [];
    if (text.includes('دوازدهم')) found.push(3);
    if (text.includes('یازدهم')) found.push(2);
    const stripped = text
        .replace(/دوازدهم/g, '\0')
        .replace(/یازدهم/g, '\0')
        .replace(/سیزدهم/g, '\0')
        .replace(/چهاردهم/g, '\0')
        .replace(/پانزدهم/g, '\0')
        .replace(/شانزدهم/g, '\0');
    if (stripped.includes('دهم')) found.push(1);
    const compact = text.replace(/\s+/g, '');
    if ((compact.includes('قدرمطلق') || compact.includes('جزءصحیح')) && !found.includes(2)) {
        found.push(2);
    }
    return found;
}

/** A chapter whose title names a grade only belongs to those grades. Untitled chapters stay available. */
export function topicMatchesGrades(title: string, gradeIds: number[]): boolean {
    const selected = (gradeIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0);
    if (!selected.length) return true;
    const named = gradesFromTopicTitle(title);
    if (!named.length) return true;
    return named.some((grade) => selected.includes(grade));
}

export interface CurriculumListItem {
    id: number;
    title: string;
    subject_id?: number;
    topic_id?: number;
}

/** A فصل belongs to the picked پایه only when its title names that پایه. */
export function topicMatchesGradeTitle(topicTitle: string, gradeTitle: string | null | undefined): boolean {
    const wanted = gradesFromTopicTitle(gradeTitle || '');
    if (!wanted.length) return true;
    const compact = String(topicTitle || '').replace(/\s+/g, '');
    // «ترکیبی سه پایه» is shared by دهم، یازدهم and دوازدهم.
    if (compact.includes('سهپایه')) return true;
    const named = gradesFromTopicTitle(topicTitle);
    if (!named.length) return false;
    return named.some((grade) => wanted.includes(grade));
}

/**
 * Order فصل‌ها and مباحث by درس, then پایه, then their own id,
 * so دهم of one subject stays together instead of mixing with the rest.
 */
export function compareCurriculumItems(
    a: CurriculumListItem,
    b: CurriculumListItem,
    kind: 'topic' | 'chapter',
    topics: CurriculumListItem[],
): number {
    const topicOf = (item: CurriculumListItem) => (
        kind === 'topic' ? item : topics.find((topic) => topic.id === item.topic_id)
    );
    const rank = (item: CurriculumListItem) => {
        const topic = topicOf(item);
        const subjectId = Number(kind === 'topic' ? item.subject_id : topic?.subject_id) || 999;
        const grades = gradesFromTopicTitle(topic?.title || '');
        const gradeKey = grades.length ? Math.min(...grades) : 99;
        return [subjectId, gradeKey, topic?.id ?? 0, item.id];
    };
    const left = rank(a);
    const right = rank(b);
    for (let i = 0; i < left.length; i += 1) {
        if (left[i] !== right[i]) return left[i] - right[i];
    }
    return 0;
}
