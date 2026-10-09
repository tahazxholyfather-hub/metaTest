/** Same grade words the quiz world uses. «دهم» is not counted inside یازدهم or دوازدهم. */
export function gradesFromTopicTitle(title: string): number[] {
    const text = String(title || '').replace(/ي/g, 'ی').replace(/ك/g, 'ک');
    const found: number[] = [];
    if (text.includes('دوازدهم')) found.push(3);
    if (text.includes('یازدهم')) found.push(2);
    const stripped = text.replace(/دوازدهم/g, '\0').replace(/یازدهم/g, '\0');
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
