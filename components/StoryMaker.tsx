
import React, { useState } from 'react';
import { BookOpen, User, Film, Play, Download, Edit, Eye, Wand2, X, Plus, Languages, Mic, Mic2, AlignLeft, Users, ChevronDown, Copy, Video, Clock, MapPin, Building2 } from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { Lang, StoryScene, UIContext, CharacterProfile } from '../types';
import * as GeminiService from '../services/geminiService';
import * as HistoryService from '../services/historyService';

interface StoryMakerProps {
    lang: Lang;
}

export const StoryMaker: React.FC<StoryMakerProps> = ({ lang }) => {
    const [script, setScript] = useState('');
    const [style, setStyle] = useState('Pixar'); // Default to Pixar
    const [aspect, setAspect] = useState('16:9');
    const [sceneCount, setSceneCount] = useState(6);
    const [protagonists, setProtagonists] = useState<string[]>([]);
    const [locationRefs, setLocationRefs] = useState<string[]>([]); // Location/Background references
    const [generatedHeroes, setGeneratedHeroes] = useState<CharacterProfile[]>([]);

    const [scenes, setScenes] = useState<StoryScene[]>([]);
    const [isPlanning, setIsPlanning] = useState(false);
    const [isGeneratingHeroes, setIsGeneratingHeroes] = useState(false);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [isTranslating, setIsTranslating] = useState(false);

    // Style Dropdown State
    const [isStyleOpen, setIsStyleOpen] = useState(false);

    // Scene Actions State
    const [previewScene, setPreviewScene] = useState<StoryScene | null>(null);
    const [previewPromptLang, setPreviewPromptLang] = useState<Lang>('ar');

    const [editingSceneIndex, setEditingSceneIndex] = useState<number | null>(null);
    const [editSceneModification, setEditSceneModification] = useState(''); // Text for the requested change
    const [isRegenerating, setIsRegenerating] = useState(false);

    const uiContextForEnhance: UIContext = {
        translateButtonId: 'btn-trans-story', languageToggleId: '', enhanceButtonId: 'btn-enh-story', generateButtonId: '', descriptionFieldId: 'story-script-field'
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const fileList = Array.from(e.target.files);
            fileList.forEach((file: File) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    if (typeof reader.result === 'string') {
                        setProtagonists(prev => [...prev, reader.result as string]);
                    }
                };
                reader.readAsDataURL(file);
            });
        }
    };

    const removeProtagonist = (index: number) => {
        setProtagonists(prev => prev.filter((_, i) => i !== index));
    };

    // Location Reference Handlers
    const handleLocationUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const fileList = Array.from(e.target.files);
            fileList.forEach((file: File) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    if (typeof reader.result === 'string') {
                        setLocationRefs(prev => [...prev, reader.result as string]);
                    }
                };
                reader.readAsDataURL(file);
            });
        }
    };

    const removeLocationRef = (index: number) => {
        setLocationRefs(prev => prev.filter((_, i) => i !== index));
    };

    const handleEnhanceScript = async () => {
        if (!script) return;
        setIsEnhancing(true);
        const res = await GeminiService.enhanceDescription(script, lang, 'medium', uiContextForEnhance);
        if (res.type === 'enhanceDescription') {
            setScript(res.enhanced_description);
        }
        setIsEnhancing(false);
    };

    const handleTranslateScript = async () => {
        if (!script) return;
        setIsTranslating(true);
        const target = lang === 'ar' ? 'en' : 'ar';
        const res = await GeminiService.translateDescription(script, target, uiContextForEnhance);
        if (res.type === 'translateDescription') {
            setScript(res.translated_text);
        }
        setIsTranslating(false);
    };

    // Step 1: Generate Heroes
    const handleCreateHeroes = async () => {
        if (!script) return;
        setIsGeneratingHeroes(true);
        setGeneratedHeroes([]);

        const profileRes = await GeminiService.generateCharacterProfiles(script, lang);

        if ('characters' in profileRes) {
            const heroesWithImages: CharacterProfile[] = [];
            const profiles = (profileRes as { characters: CharacterProfile[] }).characters;

            // Generate images in parallel
            const heroPromises = profiles.map(async (char) => {
                const prompt = `Character design of ${char.name}, ${char.visual_description}. Full body, standing pose, neutral expression, white background. High quality character sheet style. Style: ${style}.`;

                const imgRes = await GeminiService.generateImageBatch(
                    prompt,
                    [], // No input images, generating from scratch
                    '1:1', // Square for character sheets
                    1,
                    { translateButtonId: '', languageToggleId: '', enhanceButtonId: '', generateButtonId: '', descriptionFieldId: '' }
                );

                if (imgRes.type === 'batchEdits' && imgRes.results[0].outputs.length > 0) {
                    return {
                        ...char,
                        image_url: imgRes.results[0].outputs[0].image_url
                    } as CharacterProfile;
                }
                return null;
            });

            const results = await Promise.all(heroPromises);
            const validHeroes = results.filter(h => h !== null) as CharacterProfile[];
            setGeneratedHeroes(validHeroes);
        } else {
            // Handle error
            alert('Failed to identify or generate characters.');
        }
        setIsGeneratingHeroes(false);
    };

    // Step 2: Generate Story
    const handleCreateStory = async () => {
        if (!script) return;
        setIsPlanning(true);
        setScenes([]);

        // Check flow: Do we have manual protagonists OR generated heroes?
        const hasCharacters = protagonists.length > 0 || generatedHeroes.length > 0;

        if (!hasCharacters) {
            setIsPlanning(false);
            // This state should theoretically be prevented by UI disabling, but as a fallback:
            alert(lang === 'ar' ? 'يرجى إنشاء أبطال القصة أولاً.' : 'Please create story heroes first.');
            return;
        }

        // 1. Generate Text Plan
        const res = await GeminiService.generateStoryPlan(script, style, lang, sceneCount);
        if (res.type === 'storyboard') {
            const textScenes = res.plan.scenes.map(s => ({ ...s, isLoading: true }));
            setScenes(textScenes);
            setIsPlanning(false); // Stop main loading, switch to per-scene loading

            // 2. Generate Images for each scene
            const updatedScenes = [...textScenes];
            const uiContext: UIContext = { translateButtonId: '', languageToggleId: '', enhanceButtonId: '', generateButtonId: 'btn-story-gen', descriptionFieldId: '' };

            // Collect all reference images: Character References + Location References
            // Characters: Manual Uploads (Priority) OR Generated Heroes
            const characterRefs = [
                ...protagonists,
                ...generatedHeroes.map(h => h.image_url).filter(url => !!url) as string[]
            ];

            // Combine all references: Characters first, then locations
            // Note: The geminiService prompt structure handles character vs location appropriately
            const allReferenceImages = [...characterRefs, ...locationRefs];

            for (let i = 0; i < updatedScenes.length; i++) {
                const scene = updatedScenes[i];

                // Build enhanced prompt with location context if available
                let scenePrompt = scene.image_generation.prompt || scene.description;
                if (locationRefs.length > 0) {
                    scenePrompt = `LOCATION REFERENCE: Use the location/architecture from reference images as the background. Match the exact architecture, textures, and atmosphere.\n\n${scenePrompt}`;
                }

                const imgRes = await GeminiService.generateImageBatch(
                    scenePrompt,
                    allReferenceImages,
                    aspect,
                    1,
                    uiContext,
                    'scene',
                    style
                );

                if (imgRes.type === 'batchEdits' && imgRes.results[0].outputs.length > 0) {
                    updatedScenes[i].image_url = imgRes.results[0].outputs[0].image_url;
                }
                updatedScenes[i].isLoading = false;
                setScenes([...updatedScenes]);
            }

            // Save to History
            await HistoryService.saveItem({
                id: `story-${Date.now()}`,
                timestamp: Date.now(),
                type: 'story',
                title: res.plan.title,
                script: script,
                scenes: updatedScenes
            });

        } else {
            setIsPlanning(false);
            alert('Failed to generate story plan.');
        }
    };

    const openEditScene = (idx: number) => {
        setEditingSceneIndex(idx);
        setEditSceneModification(''); // Reset to empty to allow user to describe the change
    };

    const regenerateScene = async () => {
        if (editingSceneIndex === null || !editSceneModification) return;
        setIsRegenerating(true);

        const uiContext: UIContext = {
            translateButtonId: '', languageToggleId: '', enhanceButtonId: '', generateButtonId: 'btn-regen', descriptionFieldId: ''
        };

        const currentScene = scenes[editingSceneIndex];
        // Combine original description with user modification
        let combinedPrompt = `Original Scene: ${currentScene.description}. 
      Modification Request: ${editSceneModification}. 
      Re-generate the scene image implementing this change while keeping the same characters and style.`;

        // Add location context if available
        if (locationRefs.length > 0) {
            combinedPrompt = `LOCATION REFERENCE: Use the location/architecture from reference images as the background.\n\n${combinedPrompt}`;
        }

        // Use same references (characters + locations)
        const allReferenceImages = [
            ...protagonists,
            ...generatedHeroes.map(h => h.image_url).filter(url => !!url) as string[],
            ...locationRefs
        ];

        const res = await GeminiService.generateImageBatch(
            combinedPrompt,
            allReferenceImages,
            aspect,
            1,
            uiContext,
            'scene', // Keep scene mode for consistency
            style
        );

        if (res.type === 'batchEdits' && res.results[0].outputs.length > 0) {
            const updatedScenes = [...scenes];
            updatedScenes[editingSceneIndex].image_url = res.results[0].outputs[0].image_url;
            setScenes(updatedScenes);
            setEditingSceneIndex(null);
        } else {
            console.error("Failed to regen scene");
        }
        setIsRegenerating(false);
    };

    const styles = [
        { id: 'Basic', label: lang === 'ar' ? 'أساسي (أسلوب الصورة)' : 'Basic (Image Style)' },
        { id: 'Pixar', label: lang === 'ar' ? 'بيكسار' : 'Pixar' },
        { id: 'Disney', label: lang === 'ar' ? 'ديزني' : 'Disney' },
        { id: '2D Animation', label: lang === 'ar' ? 'ثنائي الأبعاد' : '2D Animation' },
        { id: 'Cinematic', label: lang === 'ar' ? 'سينمائي' : 'Cinematic' },
        { id: 'Anime', label: lang === 'ar' ? 'أنيمي' : 'Anime' },
        { id: 'Realistic', label: lang === 'ar' ? 'واقعي' : 'Realistic' },
        { id: 'Watercolor', label: lang === 'ar' ? 'ألوان مائية' : 'Watercolor' },
        { id: 'Cyberpunk', label: lang === 'ar' ? 'سايبر بانك' : 'Cyberpunk' },
        { id: '3D Render', label: lang === 'ar' ? 'ثلاثي الأبعاد' : '3D Render' },
    ];

    const labels = {
        scriptPh: lang === 'ar' ? 'اكتب فكرة القصة هنا (يمكنك الإشارة للشخصيات بالأرقام: البطل 1، البطل 2)...' : 'Write your story idea here (refer to characters by number: Hero 1, Hero 2)...',
        style: lang === 'ar' ? 'الأسلوب الفني' : 'Art Style',
        aspect: lang === 'ar' ? 'الأبعاد' : 'Aspect Ratio',
        sceneCount: lang === 'ar' ? 'عدد المشاهد' : 'Number of Scenes',
        heroes: lang === 'ar' ? 'أضف أبطال قصتك' : 'Add your story heroes',
        location: lang === 'ar' ? 'مرجع الموقع/الخلفية' : 'Location/Background Reference',
        createHeroes: lang === 'ar' ? 'إنشاء أبطال القصة' : 'Create Story Heroes',
        createStory: lang === 'ar' ? 'إنشاء القصة' : 'Create Story',
        scenes: lang === 'ar' ? 'المشاهد' : 'Scenes',
        editScene: lang === 'ar' ? 'تعديل المشهد' : 'Edit Scene',
        apply: lang === 'ar' ? 'تطبيق التعديل' : 'Apply Change',
        preview: lang === 'ar' ? 'تفاصيل المشهد' : 'Scene Details',
        enhance: lang === 'ar' ? 'تحسين الوصف' : 'Enhance Prompt',
        translate: lang === 'ar' ? 'ترجمة' : 'Translate',
        modificationPh: lang === 'ar' ? 'اكتب التعديل المطلوب على المشهد (مثال: اجعل السماء تمطر، غير ملابس البطل للون الأحمر)...' : 'Describe the change (e.g., make it rain, change hero clothes to red)...'
    };

    // Logic to control button state
    // Disabled if no script, OR if we already have manual protagonists (user provided them, no need to generate)
    const isCreateHeroesDisabled = !script || protagonists.length > 0;

    const hasCharacters = protagonists.length > 0 || generatedHeroes.length > 0;
    const canCreateStory = script && hasCharacters;

    const currentStyleLabel = styles.find(s => s.id === style)?.label || style;

    return (
        <div className="flex flex-col gap-6 pb-24 animate-fade-in">

            {/* Controls Grid (Inputs) */}
            <div className="grid md:grid-cols-3 gap-6">
                {/* Left Col: Inputs */}
                <div className="md:col-span-1 space-y-6">
                    {/* Character Upload */}
                    <div>
                        <label className="text-app-muted text-xs mb-2 block">{labels.heroes}</label>
                        <div className="grid grid-cols-3 gap-2">
                            {/* Manual Uploads */}
                            {protagonists.map((img, idx) => (
                                <div key={`manual-${idx}`} className="relative aspect-square border border-zinc-700 rounded-lg overflow-hidden group">
                                    <img src={img} alt={`Hero ${idx + 1}`} className="w-full h-full object-cover" />
                                    <div className="absolute top-1 left-1 bg-brand-primary text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold shadow-md">
                                        {idx + 1}
                                    </div>
                                    <button
                                        onClick={() => removeProtagonist(idx)}
                                        className="absolute top-1 right-1 bg-black/60 p-0.5 rounded-full text-white hover:bg-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}

                            {/* Generated Heroes */}
                            {generatedHeroes.map((hero, idx) => (
                                <div key={`gen-${idx}`} className="relative aspect-square border border-brand-primary/50 rounded-lg overflow-hidden group">
                                    <img src={hero.image_url} alt={hero.name} className="w-full h-full object-cover bg-white" />
                                    <div className="absolute top-1 left-1 bg-brand-primary text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold shadow-md">
                                        {protagonists.length + idx + 1}
                                    </div>
                                    <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[8px] text-white p-1 truncate text-center">
                                        {hero.name}
                                    </div>
                                </div>
                            ))}

                            <div className="relative aspect-square border-2 border-dashed border-app-border rounded-lg flex items-center justify-center hover:border-brand-primary text-app-muted hover:text-brand-primary transition-colors cursor-pointer bg-app-surface/30">
                                <Plus size={24} />
                                <input
                                    type="file"
                                    multiple
                                    onChange={handleFileUpload}
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    accept="image/*"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Location Reference Upload */}
                    <div>
                        <label className="text-app-muted text-xs mb-2 flex items-center gap-1">
                            <MapPin size={12} /> {labels.location}
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {/* Location Photos */}
                            {locationRefs.map((img, idx) => (
                                <div key={`loc-${idx}`} className="relative aspect-square border border-emerald-500/50 rounded-lg overflow-hidden group">
                                    <img src={img} alt={`Location ${idx + 1}`} className="w-full h-full object-cover" />
                                    <div className="absolute top-1 left-1 bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold shadow-md flex items-center gap-0.5">
                                        <Building2 size={10} />
                                    </div>
                                    <button
                                        onClick={() => removeLocationRef(idx)}
                                        className="absolute top-1 right-1 bg-black/60 p-0.5 rounded-full text-white hover:bg-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}

                            {/* Add Location Button */}
                            <div className="relative aspect-square border-2 border-dashed border-emerald-500/30 rounded-lg flex flex-col items-center justify-center hover:border-emerald-500 text-app-muted hover:text-emerald-500 transition-colors cursor-pointer bg-emerald-500/5">
                                <MapPin size={20} />
                                <span className="text-[8px] mt-1">{lang === 'ar' ? 'موقع' : 'Location'}</span>
                                <input
                                    type="file"
                                    multiple
                                    onChange={handleLocationUpload}
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    accept="image/*"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Aspect Ratio */}
                    <div>
                        <label className="text-app-muted text-xs mb-2 block">{labels.aspect}</label>
                        <div className="flex gap-2 bg-app-surface p-1 rounded-xl border border-app-border">
                            {['16:9', '9:16', '1:1'].map(r => (
                                <button
                                    key={r}
                                    onClick={() => setAspect(r)}
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${aspect === r ? 'bg-app-surface-2 text-brand-primary' : 'text-app-muted hover:text-app-text'}`}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Scene Count */}
                    <div>
                        <label className="text-app-muted text-xs mb-2 block">{labels.sceneCount}</label>
                        <div className="flex gap-2 bg-app-surface p-1 rounded-xl border border-app-border">
                            {[6, 8, 10, 12].map(c => (
                                <button
                                    key={c}
                                    onClick={() => setSceneCount(c)}
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${sceneCount === c ? 'bg-app-surface-2 text-brand-primary' : 'text-app-muted hover:text-app-text'}`}
                                >
                                    {c}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Style Dropdown */}
                    <div className="relative">
                        <label className="text-app-muted text-xs mb-2 block">{labels.style}</label>
                        <button
                            onClick={() => setIsStyleOpen(!isStyleOpen)}
                            className="w-full flex items-center justify-between bg-app-surface border border-app-border p-3 rounded-xl text-app-text hover:border-brand-primary transition-colors text-xs font-bold"
                        >
                            <span>{currentStyleLabel}</span>
                            <ChevronDown size={16} className={`transition-transform duration-300 ${isStyleOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isStyleOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setIsStyleOpen(false)} />
                                <div className="absolute top-full mt-2 left-0 right-0 z-20 bg-app-surface border border-app-border rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-app-border">
                                    {styles.map(s => (
                                        <button
                                            key={s.id}
                                            onClick={() => { setStyle(s.id); setIsStyleOpen(false); }}
                                            className={`w-full text-left p-3 text-xs font-medium hover:bg-app-surface-2 hover:text-brand-primary transition-colors ${style === s.id ? 'text-brand-primary bg-app-surface-2/50' : 'text-app-text'}`}
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Right Col: Script and Buttons */}
                <div className="md:col-span-2 flex flex-col gap-4">
                    <div className="bg-app-surface rounded-2xl p-4 border border-app-border flex-1 flex flex-col relative group">
                        <textarea
                            value={script}
                            onChange={(e) => setScript(e.target.value)}
                            placeholder={labels.scriptPh}
                            className="w-full bg-transparent text-app-text placeholder-app-muted outline-none resize-none flex-1 min-h-[200px] text-lg leading-relaxed"
                            dir={lang === 'ar' ? 'rtl' : 'ltr'}
                        />

                        {/* Tools */}
                        <div className="flex justify-between items-center mt-4 border-t border-app-border pt-4">
                            <div className="flex gap-2">
                                <Button
                                    variant="secondary"
                                    onClick={handleEnhanceScript}
                                    isLoading={isEnhancing}
                                    className="text-xs px-3 py-1.5"
                                >
                                    <Wand2 className="w-3 h-3" /> {labels.enhance}
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={handleTranslateScript}
                                    isLoading={isTranslating}
                                    className="text-xs px-3 py-1.5"
                                >
                                    <Languages className="w-3 h-3" /> {labels.translate}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="relative group">
                            <Button
                                onClick={handleCreateHeroes}
                                isLoading={isGeneratingHeroes}
                                disabled={isCreateHeroesDisabled}
                                className="w-full py-4 text-lg"
                                variant="secondary"
                            >
                                <Users className="w-5 h-5" /> {labels.createHeroes}
                            </Button>
                            {isCreateHeroesDisabled && (
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                    {lang === 'ar' ? 'لديك أبطال بالفعل' : 'Heroes already exist'}
                                </div>
                            )}
                        </div>

                        <Button
                            id="btn-story-gen"
                            onClick={handleCreateStory}
                            isLoading={isPlanning}
                            disabled={!canCreateStory}
                            className="w-full py-4 text-lg shadow-brand-primary/20"
                        >
                            <Film className="w-5 h-5" /> {labels.createStory}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Generated Scenes Stage (Moved to Bottom) */}
            <div className="min-h-[300px] bg-app-surface/50 border-2 border-dashed border-app-border rounded-3xl p-6 flex flex-col items-center justify-center transition-all duration-500 relative overflow-hidden w-full mt-4">
                {scenes.length > 0 || isPlanning ? (
                    <div className="w-full">
                        <div className="flex justify-between items-center mb-4 px-2">
                            <h3 className="text-app-muted font-bold flex items-center gap-2">
                                <Film size={16} /> {labels.scenes}
                            </h3>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 w-full">
                            {scenes.map((scene, idx) => {
                                let displayImg = scene.image_url;
                                const isSceneLoading = scene.isLoading;

                                return (
                                    <div key={idx} className="group relative rounded-xl overflow-hidden aspect-video border border-app-border hover:border-brand-primary transition-all shadow-lg animate-fade-in bg-black">
                                        {isSceneLoading ? (
                                            <div className="absolute inset-0 flex items-center justify-center text-brand-primary">
                                                <Wand2 size={24} className="animate-spin" />
                                            </div>
                                        ) : displayImg ? (
                                            <img src={displayImg} alt={`Scene ${scene.scene_number}`} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center text-zinc-700">
                                                <Film size={24} />
                                            </div>
                                        )}

                                        <div className="absolute top-2 left-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                                            {scene.scene_number}
                                        </div>

                                        {/* Overlay Actions */}
                                        {displayImg && (
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-sm">
                                                {/* Preview */}
                                                <button onClick={() => setPreviewScene(scene)} className="p-2 bg-zinc-800 text-white rounded-full hover:bg-brand-primary hover:text-white transition-colors" title={labels.preview}>
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                {/* Edit */}
                                                <button onClick={() => openEditScene(idx)} className="p-2 bg-zinc-800 text-white rounded-full hover:bg-brand-primary hover:text-white transition-colors" title={labels.editScene}>
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                {/* Download */}
                                                <a href={displayImg} download={`scene-${idx}.png`} className="p-2 bg-zinc-800 text-white rounded-full hover:bg-brand-primary hover:text-white transition-colors" title="Download">
                                                    <Download className="w-4 h-4" />
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="text-app-muted flex flex-col items-center gap-3 animate-pulse">
                        <div className="w-16 h-16 rounded-full bg-app-surface flex items-center justify-center">
                            <Film className="w-8 h-8 opacity-40" />
                        </div>
                        <p className="font-medium">{lang === 'ar' ? 'مشاهد القصة ستظهر هنا' : 'Story scenes will appear here'}</p>
                    </div>
                )}

                {/* Loading Overlay */}
                {isPlanning && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                        <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="text-brand-primary font-bold animate-pulse">{lang === 'ar' ? 'جاري تخطيط القصة...' : 'Planning Story...'}</p>
                    </div>
                )}
            </div>

            {/* Modals */}
            {/* Preview Modal */}
            <Modal isOpen={!!previewScene} onClose={() => setPreviewScene(null)} title={labels.preview}>
                {previewScene && (
                    <div className="space-y-6">
                        {/* Image and Basic Info */}
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="rounded-xl overflow-hidden border border-app-border">
                                {previewScene.image_url ? (
                                    <img src={previewScene.image_url} alt="Preview" className="w-full h-auto" />
                                ) : (
                                    <div className="aspect-video bg-black flex items-center justify-center text-zinc-700">No Image</div>
                                )}
                            </div>
                            <div className="space-y-4">
                                {/* Scene Info Badges */}
                                <div className="flex flex-wrap gap-2">
                                    {previewScene.camera_movement && (
                                        <span className="px-2 py-1 bg-brand-primary/20 text-brand-primary rounded-full text-xs font-bold flex items-center gap-1">
                                            <Video size={12} /> {previewScene.camera_movement}
                                        </span>
                                    )}
                                    {previewScene.scene_duration && (
                                        <span className="px-2 py-1 bg-app-surface-2 text-app-muted rounded-full text-xs font-bold flex items-center gap-1">
                                            <Clock size={12} /> {previewScene.scene_duration}s
                                        </span>
                                    )}
                                    {previewScene.mood && (
                                        <span className="px-2 py-1 bg-app-surface-2 text-app-muted rounded-full text-xs font-bold">
                                            {previewScene.mood}
                                        </span>
                                    )}
                                </div>

                                {/* Prompt Language Toggle */}
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => setPreviewPromptLang('ar')} className={`text-xs px-2 py-1 rounded ${previewPromptLang === 'ar' ? 'bg-brand-primary text-black' : 'bg-app-surface-2 text-app-text'}`}>AR</button>
                                    <button onClick={() => setPreviewPromptLang('en')} className={`text-xs px-2 py-1 rounded ${previewPromptLang === 'en' ? 'bg-brand-primary text-black' : 'bg-app-surface-2 text-app-text'}`}>EN</button>
                                </div>
                                <div className="p-4 bg-app-surface-2/30 rounded-xl border border-app-border text-sm text-app-text leading-relaxed h-32 overflow-y-auto">
                                    {previewPromptLang === 'ar' ? previewScene.prompt_ar : previewScene.prompt_en}
                                </div>

                                {/* Voiceovers */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-app-surface p-3 rounded-lg border border-app-border">
                                        <h5 className="text-xs text-app-muted mb-1 flex items-center gap-1"><Mic size={12} /> Fusha</h5>
                                        <p className="text-xs text-app-text line-clamp-3">{previewScene.voiceover_fusha}</p>
                                    </div>
                                    <div className="bg-app-surface p-3 rounded-lg border border-app-border">
                                        <h5 className="text-xs text-app-muted mb-1 flex items-center gap-1"><Mic2 size={12} /> Egyptian</h5>
                                        <p className="text-xs text-app-text line-clamp-3">{previewScene.voiceover_egyptian}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Video Prompt Section */}
                        {previewScene.video_prompt && (
                            <div className="bg-gradient-to-r from-brand-primary/10 to-brand-secondary/10 p-4 rounded-xl border border-brand-primary/30">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="font-bold text-brand-primary flex items-center gap-2">
                                        <Video size={16} /> {lang === 'ar' ? 'برومبت الفيديو (Veo 3.1)' : 'Video Prompt (Veo 3.1)'}
                                    </h4>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(previewScene.video_prompt || '');
                                        }}
                                        className="px-3 py-1.5 bg-brand-primary text-white rounded-lg text-xs font-bold flex items-center gap-1 hover:brightness-110 transition-all"
                                    >
                                        <Copy size={12} /> {lang === 'ar' ? 'نسخ' : 'Copy'}
                                    </button>
                                </div>
                                <pre className="bg-black/40 p-4 rounded-lg text-xs text-app-text font-mono whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                                    {previewScene.video_prompt}
                                </pre>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* Edit Modal */}
            <Modal isOpen={editingSceneIndex !== null} onClose={() => setEditingSceneIndex(null)} title={labels.editScene}>
                <div className="space-y-4">
                    <div className="bg-app-surface/50 p-4 rounded-xl border border-app-border text-sm text-app-muted">
                        Original: {editingSceneIndex !== null && scenes[editingSceneIndex]?.description}
                    </div>
                    <textarea
                        value={editSceneModification}
                        onChange={(e) => setEditSceneModification(e.target.value)}
                        placeholder={labels.modificationPh}
                        className="w-full bg-app-input p-4 rounded-xl border border-app-border focus:border-brand-primary outline-none text-app-text resize-none h-32"
                        dir={lang === 'ar' ? 'rtl' : 'ltr'}
                    />
                    <Button onClick={regenerateScene} isLoading={isRegenerating}>
                        <Wand2 className="w-4 h-4" /> {labels.apply}
                    </Button>
                </div>
            </Modal>

        </div>
    );
};

