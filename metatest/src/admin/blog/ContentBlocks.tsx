import { AlignLeft, Film, Heading, Image as ImageIcon, List, X } from 'lucide-react';
import { MediaDrop } from './MediaDrop';
import { RichTextEditor } from './RichTextEditor';
import { emptyBlock, fieldClass, type Block } from './types';

const BLOCKS = [
    { type: 'heading', label: 'تیتر', icon: Heading },
    { type: 'paragraph', label: 'متن', icon: AlignLeft },
    { type: 'list', label: 'لیست', icon: List },
    { type: 'image', label: 'تصویر', icon: ImageIcon },
    { type: 'video', label: 'ویدیو', icon: Film },
] as const;

export function ContentBlocks({
    blocks,
    onChange,
}: {
    blocks: Block[];
    onChange: (blocks: Block[]) => void;
}) {
    const setBlock = (index: number, block: Block) => {
        onChange(blocks.map((item, i) => i === index ? block : item));
    };
    const move = (index: number, dir: -1 | 1) => {
        const target = index + dir;
        if (target < 0 || target >= blocks.length) return;
        const next = [...blocks];
        [next[index], next[target]] = [next[target], next[index]];
        onChange(next);
    };

    return (
        <section className="bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#333537] rounded-[1.5rem] p-5 flex flex-col gap-3">
            <h2 className="text-sm font-bold">محتوای مقاله <span className="text-[#86868b] font-normal">{blocks.length} بلوک</span></h2>
            {!blocks.length && <p className="text-xs text-[#86868b] border border-dashed border-[#dadce0] dark:border-[#444746] rounded-xl p-4 text-center">محتوایی اضافه نشده. از دکمه‌های پایین بلوک بساز.</p>}
            {blocks.map((block, index) => (
                <div key={`${block.type}-${index}`} className="flex gap-2 items-start border border-[#dadce0] dark:border-[#333537] rounded-xl p-3 bg-[#f8f9fa] dark:bg-[#131314]">
                    <div className="flex flex-col gap-1">
                        <button type="button" disabled={index === 0} onClick={() => move(index, -1)} className="text-[10px] disabled:opacity-30">▲</button>
                        <button type="button" disabled={index === blocks.length - 1} onClick={() => move(index, 1)} className="text-[10px] disabled:opacity-30">▼</button>
                    </div>
                    <div className="flex-1 flex flex-col gap-2 min-w-0">
                        <span className="text-[10px] font-bold text-[#1a73e8]">{BLOCKS.find((item) => item.type === block.type)?.label}</span>
                        {block.type === 'heading' && (
                            <div className="flex gap-2">
                                <select value={block.level} onChange={(event) => setBlock(index, { ...block, level: Number(event.target.value) })} className={`${fieldClass} w-24`}>
                                    <option value={2}>H2</option>
                                    <option value={3}>H3</option>
                                </select>
                                <input value={block.text} onChange={(event) => setBlock(index, { ...block, text: event.target.value })} className={fieldClass} placeholder="متن تیتر" />
                            </div>
                        )}
                        {block.type === 'paragraph' && <RichTextEditor value={block.text} onChange={(html) => setBlock(index, { ...block, text: html })} />}
                        {block.type === 'list' && (
                            <div className="flex flex-col gap-2">
                                {block.items.map((item, itemIndex) => (
                                    <div key={itemIndex} className="flex gap-2">
                                        <input value={item} onChange={(event) => {
                                            const items = [...block.items];
                                            items[itemIndex] = event.target.value;
                                            setBlock(index, { ...block, items });
                                        }} className={fieldClass} placeholder={`آیتم ${itemIndex + 1}`} />
                                        <button type="button" onClick={() => setBlock(index, { ...block, items: block.items.filter((_, i) => i !== itemIndex).concat(block.items.length === 1 ? [''] : []) })}><X size={14} /></button>
                                    </div>
                                ))}
                                <button type="button" onClick={() => setBlock(index, { ...block, items: [...block.items, ''] })} className="text-xs font-bold text-[#1a73e8] self-start">افزودن آیتم</button>
                            </div>
                        )}
                        {block.type === 'image' && (
                            <div className="grid gap-2">
                                <MediaDrop kind="image" value={block.url} onChange={(url) => setBlock(index, { ...block, url })} />
                                <input value={block.alt} onChange={(event) => setBlock(index, { ...block, alt: event.target.value })} className={fieldClass} placeholder="متن جایگزین" />
                                <input value={block.caption} onChange={(event) => setBlock(index, { ...block, caption: event.target.value })} className={fieldClass} placeholder="زیرنویس" />
                            </div>
                        )}
                        {block.type === 'video' && (
                            <div className="grid gap-2">
                                <MediaDrop kind="video" value={block.url} onChange={(url) => setBlock(index, { ...block, url })} />
                                <input value={block.caption} onChange={(event) => setBlock(index, { ...block, caption: event.target.value })} className={fieldClass} placeholder="توضیح ویدیو" />
                            </div>
                        )}
                    </div>
                    <button type="button" onClick={() => onChange(blocks.filter((_, i) => i !== index))} className="text-red-500"><X size={14} /></button>
                </div>
            ))}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-dashed border-[#dadce0] dark:border-[#444746]">
                {BLOCKS.map(({ type, label, icon: Icon }) => (
                    <button key={type} type="button" onClick={() => onChange([...blocks, emptyBlock(type)])} className="px-3 py-1.5 rounded-full text-[11px] font-bold border border-[#dadce0] dark:border-[#444746] flex items-center gap-1">
                        <Icon size={13} /> {label}
                    </button>
                ))}
            </div>
        </section>
    );
}
