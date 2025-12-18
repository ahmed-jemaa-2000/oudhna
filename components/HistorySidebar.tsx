import React, { useEffect, useState } from 'react';
import { X, Clock, Trash2, Download } from 'lucide-react';
import { HistoryItem, Lang } from '../types';
import * as HistoryService from '../services/historyService';

interface HistorySidebarProps {
    isOpen: boolean;
    onClose: () => void;
    lang: Lang;
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({ isOpen, onClose, lang }) => {
    const [items, setItems] = useState<HistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadHistory();
        }
    }, [isOpen]);

    const loadHistory = async () => {
        setIsLoading(true);
        try {
            const data = await HistoryService.getItems();
            setItems(data);
        } catch (e) {
            console.error("Failed to load history", e);
        }
        setIsLoading(false);
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        await HistoryService.deleteItem(id);
        setItems(prev => prev.filter(item => item.id !== id));
    };

    const labels = {
        title: lang === 'ar' ? 'السجل' : 'History',
        empty: lang === 'ar' ? 'لا يوجد عناصر في السجل' : 'No history items found',
        image: lang === 'ar' ? 'صور' : 'Image',
        story: lang === 'ar' ? 'قصة' : 'Story',
        eraser: lang === 'ar' ? 'ممحاة' : 'Eraser',
    };

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[90]" onClick={onClose} />
            )}

            {/* Sidebar */}
            <div className={`fixed top-0 bottom-0 ${lang === 'ar' ? 'left-0' : 'right-0'} w-80 md:w-96 bg-app-surface border-l border-app-border z-[100] transform transition-transform duration-300 shadow-2xl ${isOpen ? 'translate-x-0' : (lang === 'ar' ? '-translate-x-full' : 'translate-x-full')}`}>
                <div className="flex justify-between items-center p-4 border-b border-app-border bg-app-surface/90 backdrop-blur">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-brand-orange">
                        <Clock size={20} /> {labels.title}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-app-surface-2 rounded-full text-app-muted hover:text-app-text">
                        <X size={20} />
                    </button>
                </div>

                <div className="overflow-y-auto h-[calc(100vh-64px)] p-4 space-y-4">
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <span className="animate-spin h-6 w-6 border-2 border-brand-orange rounded-full border-t-transparent"></span>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="text-center text-app-muted py-10">
                            {labels.empty}
                        </div>
                    ) : (
                        items.map((item) => (
                            <div key={item.id} className="bg-app-bg border border-app-border rounded-xl overflow-hidden group hover:border-brand-orange/50 transition-colors">
                                <div className="p-3 border-b border-app-border flex justify-between items-start">
                                    <div>
                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                                            item.type === 'image' ? 'bg-blue-900/30 text-blue-400' :
                                            item.type === 'story' ? 'bg-purple-900/30 text-purple-400' :
                                            'bg-green-900/30 text-green-400'
                                        }`}>
                                            {item.type === 'image' ? labels.image : item.type === 'story' ? labels.story : labels.eraser}
                                        </span>
                                        <p className="text-xs text-app-muted mt-1">
                                            {new Date(item.timestamp).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}
                                        </p>
                                    </div>
                                    <button 
                                        onClick={(e) => handleDelete(item.id, e)}
                                        className="text-app-muted hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                                
                                <div className="p-3">
                                    {item.type === 'image' && (
                                        <div className="space-y-2">
                                            <p className="text-sm text-app-text line-clamp-2 mb-2">{item.prompt}</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                {item.images.slice(0, 4).map((img, idx) => (
                                                    <a key={idx} href={img} download={`history-${idx}.png`} className="block aspect-square rounded-lg overflow-hidden border border-app-border">
                                                        <img src={img} alt="History" className="w-full h-full object-cover" />
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {item.type === 'story' && (
                                        <div className="space-y-2">
                                            <h4 className="font-bold text-sm text-app-text">{item.title}</h4>
                                            <p className="text-xs text-app-muted line-clamp-2">{item.script}</p>
                                            <div className="flex gap-2 overflow-x-auto pb-1">
                                                {item.scenes.slice(0, 3).map((scene, idx) => scene.image_url && (
                                                    <img key={idx} src={scene.image_url} className="w-16 h-16 rounded object-cover flex-shrink-0" />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {item.type === 'eraser' && (
                                        <div className="flex gap-2">
                                            <div className="w-1/2">
                                                <p className="text-[10px] text-app-muted mb-1">Before</p>
                                                <img src={item.original} className="w-full rounded border border-app-border" />
                                            </div>
                                            <div className="w-1/2">
                                                <p className="text-[10px] text-app-muted mb-1">After</p>
                                                <img src={item.result} className="w-full rounded border border-app-border" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    );
};