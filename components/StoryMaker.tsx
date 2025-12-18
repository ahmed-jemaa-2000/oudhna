
import React, { useState } from 'react';
import { BookOpen, User, Film, Play, Download, Edit, Eye, Wand2, X, Plus, Languages, Mic, AlignLeft, Users, ChevronDown, Copy, Video, Clock, MapPin, Building2, Trash2, Route } from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { Lang, StoryScene, UIContext, CharacterProfile, TourStop } from '../types';
import * as GeminiService from '../services/geminiService';
import * as HistoryService from '../services/historyService';

interface StoryMakerProps {
    lang: Lang;
}

export const StoryMaker: React.FC<StoryMakerProps> = ({ lang }) => {
    const [script, setScript] = useState('');
    const [style, setStyle] = useState('Pixar'); // Default to Pixar
    const [aspect, setAspect] = useState('16:9');
    const [protagonists, setProtagonists] = useState<string[]>([]);
    const [generatedHeroes, setGeneratedHeroes] = useState<CharacterProfile[]>([]);

    // Character Profile (Explorer)
    const [characterName, setCharacterName] = useState('');
    const [characterAge, setCharacterAge] = useState('10-15');

    // Single Location Mode (8 scenes × 8 seconds = 64 seconds)
    const [locationNameAr, setLocationNameAr] = useState('');
    const [locationNameEn, setLocationNameEn] = useState('');
    const [locationPhotos, setLocationPhotos] = useState<string[]>([]);
    const [knowledgeBase, setKnowledgeBase] = useState('');
    const FIXED_SCENE_COUNT = 8; // Fixed 8 scenes for structured documentary

    // Export Modal
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportTab, setExportTab] = useState<'character' | 'scenes' | 'video' | 'voiceover'>('character');

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

    // Location Photo Handlers (max 3 photos)
    const handleLocationPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || locationPhotos.length >= 3) return;
        const fileList = Array.from(e.target.files);
        fileList.forEach((file: File) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                    setLocationPhotos(prev => prev.length < 3 ? [...prev, reader.result as string] : prev);
                }
            };
            reader.readAsDataURL(file);
        });
    };

    const removeLocationPhoto = (index: number) => {
        setLocationPhotos(prev => prev.filter((_, i) => i !== index));
    };

    // Fixed 8 scenes × 8 seconds = 64 seconds
    const totalDuration = FIXED_SCENE_COUNT * 8;

    // AI Research for location
    const [isResearching, setIsResearching] = useState(false);

    // Generate Character DNA for export
    const generateCharacterDNA = () => {
        const name = characterName || (lang === 'ar' ? 'المستكشف' : 'Explorer');
        const ageLang = lang === 'ar' ?
            (characterAge === '5-9' ? '٧ سنوات' : characterAge === '10-15' ? '١٢ سنة' : '١٨ سنة') :
            (characterAge === '5-9' ? '7 years old' : characterAge === '10-15' ? '12 years old' : '18 years old');

        return lang === 'ar'
            ? `${name}: نفس الشخصية من الصورة المرجعية. ${ageLang}، بشرة زيتونية دافئة. يرتدي ملابس مستكشف عصرية. أسلوب ${style}.`
            : `${name}: Same character from reference image. ${ageLang}, warm olive skin. Modern explorer outfit. ${style} style.`;
    };

    const handleResearchLocation = async () => {
        const locationName = locationNameAr || locationNameEn;
        if (!locationName) {
            alert(lang === 'ar' ? 'يرجى إدخال اسم الموقع أولاً' : 'Please enter location name first');
            return;
        }

        setIsResearching(true);
        const result = await GeminiService.researchLocation(locationName, lang);

        if ('research' in result) {
            const research = result.research;
            const explorerName = characterName || (lang === 'ar' ? 'المستكشف' : 'the explorer');

            // Format the research into knowledge base text
            const formattedFacts = [
                `📍 ${research.location_name}`,
                `📅 ${research.historical_era}`,
                '',
                lang === 'ar' ? '📚 الحقائق التاريخية:' : '📚 Historical Facts:',
                ...research.key_facts.map(f => `• ${f}`),
                '',
                lang === 'ar' ? '🏛️ المعالم:' : '🏛️ Landmarks:',
                ...research.landmarks.map(l => `• ${l}`),
                '',
                lang === 'ar' ? '📖 الأهمية:' : '📖 Significance:',
                research.historical_significance
            ].join('\n');

            setKnowledgeBase(formattedFacts);

            // Generate character-aware script with 8 scene structure
            const characterScript = lang === 'ar'
                ? `رحلة ${explorerName} إلى ${research.location_name}:

المشهد 1 (الوصول): ${explorerName} يصل إلى ${research.location_name}، ينظر بإعجاب إلى الأطلال العريقة.
المشهد 2 (الاكتشاف): ${explorerName} يكتشف ${research.landmarks[0] || 'المعالم الأثرية'}.
المشهد 3 (التفاصيل): ${explorerName} يتأمل التفاصيل المعمارية القديمة.
المشهد 4 (التاريخ): ${explorerName} يستمع إلى قصة ${research.location_name}: ${research.key_facts[0] || ''}.
المشهد 5 (الاستكشاف): ${explorerName} يتجول في ${research.landmarks[1] || 'أرجاء الموقع'}.
المشهد 6 (الإعجاب): ${explorerName} يقف مندهشاً أمام عظمة الحضارة القديمة.
المشهد 7 (التعلم): ${explorerName} يقرأ النقوش ويتعلم ${research.key_facts[1] || 'عن التاريخ'}.
المشهد 8 (الوداع): ${explorerName} ينظر إلى ${research.location_name} مع غروب الشمس، يعد بالعودة.`
                : `${explorerName}'s Journey to ${research.location_name}:

Scene 1 (Arrival): ${explorerName} arrives at ${research.location_name}, looking up at ancient ruins in wonder.
Scene 2 (Discovery): ${explorerName} discovers ${research.landmarks[0] || 'the archaeological sites'}.
Scene 3 (Detail): ${explorerName} examines ancient architectural details.
Scene 4 (History): ${explorerName} learns: ${research.key_facts[0] || ''}.
Scene 5 (Exploration): ${explorerName} walks through ${research.landmarks[1] || 'the site'}.
Scene 6 (Wonder): ${explorerName} stands in awe of ancient civilization.
Scene 7 (Learning): ${explorerName} reads inscriptions, discovering ${research.key_facts[1] || 'history'}.
Scene 8 (Farewell): ${explorerName} gazes at ${research.location_name} at sunset, promising to return.`;

            setScript(characterScript);
        } else {
            alert(lang === 'ar' ? 'فشل البحث. حاول مرة أخرى.' : 'Research failed. Please try again.');
        }

        setIsResearching(false);
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

    // Step 2: Generate Story (planOnly = true skips image generation)
    const handleCreateStory = async (planOnly: boolean = false) => {
        if (!script) return;
        setIsPlanning(true);
        setScenes([]);

        // Check flow: Do we have manual protagonists OR generated heroes?
        const hasCharacters = protagonists.length > 0 || generatedHeroes.length > 0;

        if (!hasCharacters) {
            setIsPlanning(false);
            alert(lang === 'ar' ? 'يرجى إنشاء أبطال القصة أولاً.' : 'Please create story heroes first.');
            return;
        }

        // Build knowledge base context
        const knowledgeBaseContext = knowledgeBase.trim()
            ? `=== ${locationNameAr || locationNameEn || 'Location'} ===\n${knowledgeBase}`
            : '';

        // Enhanced script with knowledge base
        const enhancedScript = knowledgeBaseContext
            ? `${script}\n\n=== USER-PROVIDED HISTORICAL FACTS (USE ONLY THESE) ===\n${knowledgeBaseContext}`
            : script;

        // 1. Generate Text Plan (fixed 8 scenes)
        const res = await GeminiService.generateStoryPlan(enhancedScript, style, lang, FIXED_SCENE_COUNT);
        if (res.type === 'storyboard') {
            const textScenes = res.plan.scenes.map(s => ({ ...s, isLoading: true }));
            setScenes(textScenes);
            setIsPlanning(false); // Stop main loading, switch to per-scene loading

            // 2. Generate Images for each scene (skip if planOnly)
            if (!planOnly) {
                const updatedScenes = [...textScenes];
                const uiContext: UIContext = { translateButtonId: '', languageToggleId: '', enhanceButtonId: '', generateButtonId: 'btn-story-gen', descriptionFieldId: '' };

                // Character references
                const characterRefs = [
                    ...protagonists,
                    ...generatedHeroes.map(h => h.image_url).filter(url => !!url) as string[]
                ];

                // Combine all references: Characters + Location photos
                const allReferenceImages = [...characterRefs, ...locationPhotos];

                for (let i = 0; i < updatedScenes.length; i++) {
                    const scene = updatedScenes[i];

                    // Build enhanced prompt with location context
                    let scenePrompt = scene.image_generation.prompt || scene.description;
                    if (locationPhotos.length > 0) {
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
                // Plan only: Mark scenes as ready (no images)
                const scenesWithoutLoading = textScenes.map(s => ({ ...s, isLoading: false }));
                setScenes(scenesWithoutLoading);
            }

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
        if (locationPhotos.length > 0) {
            combinedPrompt = `LOCATION REFERENCE: Use the location/architecture from reference images as the background.\n\n${combinedPrompt}`;
        }

        // Use same references (characters + locations)
        const allReferenceImages = [
            ...protagonists,
            ...generatedHeroes.map(h => h.image_url).filter(url => !!url) as string[],
            ...locationPhotos
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

                    {/* Explorer Character Profile */}
                    <div className="bg-gradient-to-br from-brand-primary/10 to-brand-primary/5 border border-brand-primary/30 rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <User size={16} className="text-brand-primary" />
                            <span className="text-brand-primary font-bold text-sm">
                                {lang === 'ar' ? '👤 شخصية المستكشف' : '👤 Explorer Character'}
                            </span>
                        </div>

                        {/* Character Name */}
                        <div>
                            <label className="text-[10px] text-app-muted mb-1 block">
                                {lang === 'ar' ? 'اسم المستكشف:' : 'Explorer Name:'}
                            </label>
                            <input
                                type="text"
                                placeholder={lang === 'ar' ? 'مثال: فارس' : 'Example: Fares'}
                                value={characterName}
                                onChange={(e) => setCharacterName(e.target.value)}
                                className="w-full bg-app-surface-2 border border-app-border rounded-lg px-3 py-2 text-sm text-app-text placeholder:text-app-muted/50"
                            />
                        </div>

                        {/* Character Age */}
                        <div>
                            <label className="text-[10px] text-app-muted mb-1 block">
                                {lang === 'ar' ? 'الفئة العمرية:' : 'Age Group:'}
                            </label>
                            <div className="flex gap-2">
                                {[
                                    { id: '5-9', label: lang === 'ar' ? '٥-٩ سنوات' : '5-9 years' },
                                    { id: '10-15', label: lang === 'ar' ? '١٠-١٥ سنة' : '10-15 years' },
                                    { id: '16-25', label: lang === 'ar' ? '١٦-٢٥ سنة' : '16-25 years' }
                                ].map(age => (
                                    <button
                                        key={age.id}
                                        onClick={() => setCharacterAge(age.id)}
                                        className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all ${characterAge === age.id
                                            ? 'bg-brand-primary text-white'
                                            : 'bg-app-surface-2 text-app-muted hover:text-app-text'
                                            }`}
                                    >
                                        {age.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Photo Upload Label */}
                        <label className="text-app-muted text-xs flex items-center justify-between">
                            <span>{labels.heroes}</span>
                            <span className="text-[10px] text-brand-primary">📷 {lang === 'ar' ? 'صورة واضحة للوجه' : 'Clear face photo'}</span>
                        </label>
                        <p className="text-[10px] text-app-muted/70 -mt-2">
                            {lang === 'ar'
                                ? '💡 نصيحة: استخدم صورة بإضاءة محايدة، وجه واضح، ملابس مميزة'
                                : '💡 Tip: Use neutral lighting, clear face, distinctive clothing'}
                        </p>
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

                    {/* Location Section */}
                    <div className="space-y-4 bg-app-surface border border-emerald-500/30 rounded-xl p-4">
                        <div className="flex items-center gap-2">
                            <MapPin size={16} className="text-emerald-500" />
                            <span className="text-emerald-500 font-bold text-sm">
                                {lang === 'ar' ? 'الموقع التاريخي' : 'Historical Location'}
                            </span>
                        </div>

                        {/* Location Name + Research Button */}
                        <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="text"
                                    placeholder={lang === 'ar' ? 'اسم الموقع بالعربية (مثال: قرطاج)' : 'Location name in Arabic'}
                                    value={locationNameAr}
                                    onChange={(e) => setLocationNameAr(e.target.value)}
                                    className="bg-app-surface-2 border border-app-border rounded-lg px-3 py-2 text-sm text-app-text placeholder:text-app-muted/50"
                                />
                                <input
                                    type="text"
                                    placeholder={lang === 'ar' ? 'اسم الموقع بالإنجليزية (مثال: Carthage)' : 'Location name in English'}
                                    value={locationNameEn}
                                    onChange={(e) => setLocationNameEn(e.target.value)}
                                    className="bg-app-surface-2 border border-app-border rounded-lg px-3 py-2 text-sm text-app-text placeholder:text-app-muted/50"
                                />
                            </div>
                            {/* AI Research Button */}
                            <button
                                onClick={handleResearchLocation}
                                disabled={isResearching || (!locationNameAr && !locationNameEn)}
                                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {isResearching ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        {lang === 'ar' ? 'جاري البحث...' : 'Researching...'}
                                    </>
                                ) : (
                                    <>
                                        <Wand2 size={16} />
                                        {lang === 'ar' ? '🔍 ابحث عن الحقائق التاريخية تلقائياً' : '🔍 Auto-Research Historical Facts'}
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Location Photos (1-3) */}
                        <div>
                            <label className="text-xs text-app-muted mb-2 block">
                                {lang === 'ar' ? 'صور الموقع (1-3 صور)' : 'Location Photos (1-3 images)'}
                            </label>
                            <div className="flex gap-2">
                                {locationPhotos.map((img, idx) => (
                                    <div key={idx} className="relative w-20 h-20 border border-emerald-500/50 rounded-lg overflow-hidden group">
                                        <img src={img} alt={`Location ${idx + 1}`} className="w-full h-full object-cover" />
                                        <button
                                            onClick={() => removeLocationPhoto(idx)}
                                            className="absolute top-1 right-1 bg-black/60 p-0.5 rounded-full text-white hover:bg-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                                {locationPhotos.length < 3 && (
                                    <div className="relative w-20 h-20 border-2 border-dashed border-emerald-500/30 rounded-lg flex flex-col items-center justify-center hover:border-emerald-500 text-app-muted hover:text-emerald-500 transition-colors cursor-pointer">
                                        <Building2 size={20} />
                                        <span className="text-[10px] mt-1">{lang === 'ar' ? 'إضافة' : 'Add'}</span>
                                        <input
                                            type="file"
                                            onChange={handleLocationPhotoUpload}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                            accept="image/*"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Knowledge Base */}
                        <div>
                            <label className="text-xs text-amber-500 mb-2 block font-bold flex items-center gap-1">
                                📚 {lang === 'ar' ? 'الحقائق التاريخية (اختياري)' : 'Historical Facts (optional)'}
                            </label>
                            <textarea
                                placeholder={lang === 'ar'
                                    ? 'أدخل الحقائق التاريخية الموثقة هنا...\n\nمثال:\n• أسسها الفينيقيون عام 814 ق.م\n• دمرتها روما عام 146 ق.م\n• الحروب البونيقية الثلاث...'
                                    : 'Enter verified historical facts here...\n\nExample:\n• Founded by Phoenicians in 814 BC\n• Destroyed by Rome in 146 BC...'}
                                value={knowledgeBase}
                                onChange={(e) => setKnowledgeBase(e.target.value)}
                                className="w-full bg-amber-500/5 border border-amber-500/30 rounded-lg px-3 py-2 text-sm text-app-text placeholder:text-amber-500/40 h-32 resize-none"
                            />
                            <p className="text-[10px] text-amber-500/70 mt-1">
                                {lang === 'ar' ? '⚠️ الذكاء الاصطناعي سيستخدم هذه المعلومات فقط في التعليق الصوتي' : '⚠️ AI will ONLY use these facts in voiceover'}
                            </p>
                        </div>

                        {/* Fixed Scene Structure */}
                        <div className="bg-brand-primary/10 border border-brand-primary/30 rounded-xl p-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-brand-primary font-bold flex items-center gap-2">
                                    <Film size={14} /> {lang === 'ar' ? 'هيكل القصة' : 'Story Structure'}
                                </span>
                                <span className="text-lg font-bold text-brand-primary">
                                    8 {lang === 'ar' ? 'مشاهد' : 'scenes'} × 8s = 64s
                                </span>
                            </div>
                            <p className="text-[10px] text-brand-primary/70 mt-1">
                                {lang === 'ar' ? 'وصول → مقدمة → استكشاف × 4 → حقيقة رئيسية → ختام' : 'Arrival → Introduction → Exploration ×4 → Key Fact → Conclusion'}
                            </p>
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

                        <div className="flex gap-2">
                            <Button
                                id="btn-story-gen"
                                onClick={() => handleCreateStory(false)}
                                isLoading={isPlanning}
                                disabled={!canCreateStory}
                                className="flex-1 py-4 text-sm shadow-brand-primary/20"
                            >
                                <Film className="w-4 h-4" /> {lang === 'ar' ? '🎬 إنشاء مع الصور' : '🎬 Create + Images'}
                            </Button>
                            <button
                                onClick={() => handleCreateStory(true)}
                                disabled={!canCreateStory || isPlanning}
                                className="flex-1 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                <Download className="w-4 h-4" /> {lang === 'ar' ? '📋 خطة فقط (تصدير)' : '📋 Plan Only (Export)'}
                            </button>
                        </div>
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
                            {scenes.length > 0 && (
                                <button
                                    onClick={() => setShowExportModal(true)}
                                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 hover:brightness-110 transition-all"
                                >
                                    <Download size={14} /> {lang === 'ar' ? '📋 تصدير للـ Flow' : '📋 Export for Flow'}
                                </button>
                            )}
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

                                {/* Voiceover (Fusha Only) */}
                                <div className="bg-app-surface p-3 rounded-lg border border-app-border">
                                    <h5 className="text-xs text-app-muted mb-1 flex items-center gap-1">
                                        <Mic size={12} /> {lang === 'ar' ? 'التعليق الصوتي (الفصحى)' : 'Voiceover (Fusha)'}
                                    </h5>
                                    <p className="text-sm text-app-text leading-relaxed">{previewScene.voiceover_fusha}</p>
                                </div>

                                {/* Historical Facts */}
                                {previewScene.historical_facts && (
                                    <div className="bg-amber-500/10 p-3 rounded-lg border border-amber-500/30">
                                        <h5 className="text-xs text-amber-500 mb-1 flex items-center gap-1 font-bold">
                                            📚 {lang === 'ar' ? 'الحقائق التاريخية' : 'Historical Facts'}
                                        </h5>
                                        <p className="text-xs text-app-text">{previewScene.historical_facts}</p>
                                        {previewScene.historical_period && (
                                            <span className="inline-block mt-2 px-2 py-0.5 bg-amber-500/20 text-amber-500 rounded text-[10px] font-bold">
                                                {previewScene.historical_period}
                                            </span>
                                        )}
                                    </div>
                                )}
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

            {/* Export Modal for Flow UI */}
            <Modal
                isOpen={showExportModal}
                onClose={() => setShowExportModal(false)}
                title={lang === 'ar' ? '📋 تصدير للـ Flow' : '📋 Export for Flow'}
            >
                <div className="space-y-4">
                    {/* Tabs */}
                    <div className="flex gap-1 bg-app-surface p-1 rounded-xl">
                        {[
                            { id: 'character', label: lang === 'ar' ? 'الشخصية' : 'Character' },
                            { id: 'scenes', label: lang === 'ar' ? 'المشاهد' : 'Scenes' },
                            { id: 'video', label: lang === 'ar' ? 'الفيديو' : 'Video' },
                            { id: 'voiceover', label: lang === 'ar' ? 'التعليق' : 'Voiceover' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setExportTab(tab.id as any)}
                                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${exportTab === tab.id
                                    ? 'bg-brand-primary text-white'
                                    : 'text-app-muted hover:text-app-text'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Character DNA Tab */}
                    {exportTab === 'character' && (
                        <div className="space-y-3">
                            <p className="text-xs text-app-muted">
                                {lang === 'ar'
                                    ? '📌 الصق هذا أولاً في Flow مع صورة الشخصية'
                                    : '📌 Paste this first in Flow with character photo'}
                            </p>
                            <div className="bg-app-surface-2 p-4 rounded-xl border border-app-border">
                                <pre className="text-sm text-app-text whitespace-pre-wrap" dir="auto">
                                    {generateCharacterDNA()}
                                </pre>
                            </div>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(generateCharacterDNA());
                                    alert(lang === 'ar' ? 'تم النسخ!' : 'Copied!');
                                }}
                                className="w-full py-2 bg-brand-primary text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2"
                            >
                                <Copy size={14} /> {lang === 'ar' ? 'نسخ Character DNA' : 'Copy Character DNA'}
                            </button>
                        </div>
                    )}

                    {/* Scene Prompts Tab */}
                    {exportTab === 'scenes' && (
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {scenes.map((scene, idx) => (
                                <div key={idx} className="bg-app-surface-2 p-3 rounded-xl border border-app-border">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-brand-primary">
                                            {lang === 'ar' ? `المشهد ${idx + 1}` : `Scene ${idx + 1}`}
                                        </span>
                                        <button
                                            onClick={() => {
                                                const prompt = `Same character ${characterName || 'explorer'} from reference image. ${scene.image_generation?.prompt || scene.description}. Keep exact appearance. ${style} style.`;
                                                navigator.clipboard.writeText(prompt);
                                            }}
                                            className="text-xs text-brand-primary hover:underline flex items-center gap-1"
                                        >
                                            <Copy size={10} /> {lang === 'ar' ? 'نسخ' : 'Copy'}
                                        </button>
                                    </div>
                                    <p className="text-xs text-app-muted line-clamp-3">
                                        {scene.image_generation?.prompt || scene.description}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Video Prompts Tab */}
                    {exportTab === 'video' && (
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {scenes.map((scene, idx) => (
                                <div key={idx} className="bg-app-surface-2 p-3 rounded-xl border border-app-border">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-emerald-500">
                                            🎬 {lang === 'ar' ? `فيديو ${idx + 1}` : `Video ${idx + 1}`}
                                        </span>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(scene.video_prompt || '');
                                            }}
                                            className="text-xs text-emerald-500 hover:underline flex items-center gap-1"
                                        >
                                            <Copy size={10} /> {lang === 'ar' ? 'نسخ' : 'Copy'}
                                        </button>
                                    </div>
                                    <p className="text-xs text-app-muted line-clamp-2">
                                        {scene.video_prompt || '-'}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Voiceover Tab */}
                    {exportTab === 'voiceover' && (
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {scenes.map((scene, idx) => (
                                <div key={idx} className="bg-app-surface-2 p-3 rounded-xl border border-app-border">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-amber-500">
                                            🎙️ {lang === 'ar' ? `تعليق ${idx + 1}` : `Voice ${idx + 1}`}
                                        </span>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(scene.voiceover_fusha || '');
                                            }}
                                            className="text-xs text-amber-500 hover:underline flex items-center gap-1"
                                        >
                                            <Copy size={10} /> {lang === 'ar' ? 'نسخ' : 'Copy'}
                                        </button>
                                    </div>
                                    <p className="text-xs text-app-muted line-clamp-2" dir="rtl">
                                        {scene.voiceover_fusha || '-'}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Copy All Button */}
                    <button
                        onClick={() => {
                            const allContent = [
                                '=== CHARACTER DNA ===',
                                generateCharacterDNA(),
                                '',
                                ...scenes.flatMap((scene, idx) => [
                                    `=== SCENE ${idx + 1} ===`,
                                    `IMAGE: Same character ${characterName || 'explorer'} from reference. ${scene.image_generation?.prompt || scene.description}`,
                                    `VIDEO: ${scene.video_prompt || '-'}`,
                                    `VOICEOVER: ${scene.voiceover_fusha || '-'}`,
                                    ''
                                ])
                            ].join('\n');
                            navigator.clipboard.writeText(allContent);
                            alert(lang === 'ar' ? 'تم نسخ الكل!' : 'All copied!');
                        }}
                        className="w-full py-3 bg-gradient-to-r from-brand-primary to-purple-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                    >
                        <Download size={16} /> {lang === 'ar' ? 'تصدير الكل' : 'Export All'}
                    </button>
                </div>
            </Modal>

        </div>
    );
};

