import React, { useState } from 'react';
import { Upload, Wand2, Languages, Image as ImageIcon, X, AlertCircle, Eye, Download, PenLine } from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { Lang, UIContext, BatchEditsResponse, ErrorResponse } from '../types';
import * as GeminiService from '../services/geminiService';
import * as HistoryService from '../services/historyService';

interface ImageEditorProps {
  lang: Lang;
}

export const ImageEditor: React.FC<ImageEditorProps> = ({ lang }) => {
  const [images, setImages] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [aspect, setAspect] = useState('custom'); // Default to custom/original
  const [count, setCount] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Preview & Edit States
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [isApplyingEdit, setIsApplyingEdit] = useState(false);

  const uiContext: UIContext = {
    translateButtonId: 'btn-trans-1',
    languageToggleId: 'lang-tog',
    enhanceButtonId: 'btn-enh-1',
    generateButtonId: 'btn-gen-1',
    descriptionFieldId: 'desc-field-1'
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const fileList = Array.from(e.target.files);
      fileList.forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setImages(prev => [...prev, reader.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleEnhance = async () => {
    if (!description) return;
    setIsEnhancing(true);
    const res = await GeminiService.enhanceDescription(description, lang, 'medium', uiContext);
    if (res.type === 'enhanceDescription') {
      setDescription(res.enhanced_description);
    }
    setIsEnhancing(false);
  };

  const handleTranslate = async () => {
    if (!description) return;
    const target = lang === 'ar' ? 'en' : 'ar';
    const res = await GeminiService.translateDescription(description, target, uiContext);
    if (res.type === 'translateDescription') {
      setDescription(res.translated_text);
    }
  };

  const handleGenerate = async () => {
    if (!description && images.length === 0) return;
    setIsGenerating(true);
    setResults([]);
    setError(null);
    
    const res = await GeminiService.generateImageBatch(description, images, aspect, count, uiContext);
    
    if (res.type === 'batchEdits') {
      const outputList = (res as BatchEditsResponse).results[0].outputs;
      if (outputList && outputList.length > 0) {
        const urls = outputList.map(o => o.image_url);
        setResults(urls);

        // Save to History
        await HistoryService.saveItem({
            id: `img-${Date.now()}`,
            timestamp: Date.now(),
            type: 'image',
            prompt: description || "Image Edit/Fusion",
            images: urls
        });

      } else {
        setError(lang === 'ar' ? 'فشل التوليد، يرجى المحاولة مرة أخرى.' : 'Generation failed, please try again.');
      }
    } else if (res.type === 'error') {
      setError((res as ErrorResponse).error.message);
    }
    setIsGenerating(false);
  };

  const openEditModal = (imgUrl: string) => {
      setEditingImage(imgUrl);
      setEditPrompt('');
  };

  const applyEdit = async () => {
      if(!editingImage || !editPrompt) return;
      setIsApplyingEdit(true);
      
      // Generate new image based on the editing image + prompt
      const res = await GeminiService.generateImageBatch(editPrompt, [editingImage], aspect, 1, uiContext);
      
      if (res.type === 'batchEdits' && res.results[0].outputs.length > 0) {
          // Add result to the list
          setResults(prev => [...prev, res.results[0].outputs[0].image_url]);
          setEditingImage(null); // Close modal
      } else if (res.type === 'error') {
          alert((res as ErrorResponse).error.message);
      }
      setIsApplyingEdit(false);
  };

  const labels = {
    upload: lang === 'ar' ? 'ارفع صورك (يمكنك دمج أكثر من صورة)' : 'Upload your images (supports multiple)',
    descPlaceholder: lang === 'ar' ? 'صف التعديل أو الصورة التي تريد إنشاءها...' : 'Describe the edit or fusion you want...',
    enhance: lang === 'ar' ? 'تحسين الوصف' : 'Enhance',
    translate: lang === 'ar' ? 'ترجمة' : 'Translate',
    generate: lang === 'ar' ? 'توليد' : 'Generate',
    aspect: lang === 'ar' ? 'الأبعاد' : 'Aspect Ratio',
    count: lang === 'ar' ? 'العدد' : 'Count',
    results: lang === 'ar' ? 'النتائج' : 'Results',
    preview: lang === 'ar' ? 'معاينة' : 'Preview',
    edit: lang === 'ar' ? 'تعديل' : 'Edit',
    editTitle: lang === 'ar' ? 'تعديل النتيجة' : 'Edit Result',
    apply: lang === 'ar' ? 'تطبيق' : 'Apply',
    editPlaceholder: lang === 'ar' ? 'صف التعديلات الإضافية...' : 'Describe additional edits...',
    placeholder: lang === 'ar' ? 'الصور المولدة ستظهر هنا' : 'Generated images will appear here'
  };

  const infoSteps = [
    {
      icon: <ImageIcon className="w-6 h-6 text-brand-primary" />,
      title: lang === 'ar' ? 'ارفع صورك' : 'Upload Images',
      desc: lang === 'ar' ? 'يدعم صور متعددة للدمج وتعديل الصور' : 'Supports multiple images for fusion & editing'
    },
    {
      icon: <Wand2 className="w-6 h-6 text-brand-primary" />,
      title: lang === 'ar' ? 'اكتب الوصف' : 'Write Prompt',
      desc: lang === 'ar' ? 'صف خيالك بدقة لدمج الصور أو تعديلها' : 'Describe your vision to fuse or edit images'
    },
    {
      icon: <Download className="w-6 h-6 text-brand-primary" />,
      title: lang === 'ar' ? 'حمل النتيجة' : 'Download',
      desc: lang === 'ar' ? 'احصل على صور بجودة عالية' : 'Get high-quality generated images'
    }
  ];

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-24">
      
      {/* Infographics Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        {infoSteps.map((step, idx) => (
           <div 
             key={idx}
             className="bg-app-surface/40 border border-app-border p-6 rounded-2xl flex flex-col items-center text-center gap-3 hover:bg-app-surface transition-colors animate-float"
             style={{ animationDelay: `${idx * 1.2}s` }}
           >
             <div className="w-14 h-14 rounded-full bg-app-surface-2 flex items-center justify-center flex-shrink-0 shadow-inner mb-1">
               {step.icon}
             </div>
             <div>
               <h4 className="font-bold text-lg text-app-text mb-1">{step.title}</h4>
               <p className="text-sm text-app-muted">{step.desc}</p>
             </div>
           </div>
        ))}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-500 p-4 rounded-xl flex items-center gap-3 mt-4">
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
        </div>
      )}

      {/* Controls Container */}
      <div className="flex flex-col gap-6 mt-4">
          {/* Upload & Prompt Grid */}
          <div className="grid md:grid-cols-12 gap-6">
              
              {/* Left: Upload */}
              <div className="md:col-span-4 flex flex-col gap-4">
                  <div className="relative group border-2 border-dashed border-app-border hover:border-brand-primary rounded-2xl aspect-square flex items-center justify-center transition-colors bg-app-surface/30">
                    <input 
                    type="file" 
                    multiple 
                    accept="image/*"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    onChange={handleFileUpload}
                    />
                    <div className="flex flex-col items-center justify-center text-app-muted group-hover:text-brand-primary transition-colors p-4 text-center">
                    <Upload className="w-10 h-10 mb-3" />
                    <p className="text-sm font-medium">{labels.upload}</p>
                    </div>
                  </div>

                  {/* Uploaded Previews (Horizontal Scroll) */}
                  {images.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                    {images.map((img, i) => (
                        <div key={i} className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border border-app-border group">
                        <img src={img} alt={`upload-${i}`} className="w-full h-full object-cover" />
                        <button 
                            onClick={() => setImages(images.filter((_, idx) => idx !== i))}
                            className="absolute top-0 right-0 bg-black/60 p-0.5 text-white hover:bg-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <X size={12} />
                        </button>
                        </div>
                    ))}
                    </div>
                  )}
              </div>

              {/* Right: Prompt & Settings */}
              <div className="md:col-span-8 flex flex-col gap-4">
                   {/* Prompt Area */}
                   <div className="bg-app-surface rounded-2xl p-4 border border-app-border flex-1 flex flex-col">
                        <textarea
                        id={uiContext.descriptionFieldId}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={labels.descPlaceholder}
                        className="w-full bg-transparent text-app-text placeholder-app-muted outline-none resize-none flex-1 min-h-[120px] text-lg"
                        dir={lang === 'ar' ? 'rtl' : 'ltr'}
                        />
                        <div className="flex justify-between items-center mt-4 border-t border-app-border pt-4">
                        <div className="flex gap-2">
                            <Button 
                            id={uiContext.enhanceButtonId}
                            variant="secondary" 
                            onClick={handleEnhance} 
                            isLoading={isEnhancing}
                            className="text-xs px-3 py-1.5"
                            >
                            <Wand2 className="w-3 h-3" /> {labels.enhance}
                            </Button>
                            <Button 
                            id={uiContext.translateButtonId}
                            variant="secondary" 
                            onClick={handleTranslate}
                            className="text-xs px-3 py-1.5"
                            >
                            <Languages className="w-3 h-3" /> {labels.translate}
                            </Button>
                        </div>
                        </div>
                    </div>

                    {/* Settings Row */}
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="flex-1 min-w-[150px]">
                            <label className="text-app-muted text-xs mb-2 block">{labels.aspect}</label>
                            <div className="flex gap-2 bg-app-surface p-1 rounded-xl border border-app-border">
                                {['custom', '1:1', '9:16', '16:9'].map(r => (
                                <button 
                                    key={r}
                                    onClick={() => setAspect(r)}
                                    className={`flex-1 py-2 rounded-lg text-[10px] md:text-xs font-bold transition-colors ${aspect === r ? 'bg-app-surface-2 text-brand-primary' : 'text-app-muted hover:text-app-text'}`}
                                >
                                    {r === 'custom' ? (lang === 'ar' ? 'أصلية' : 'Orig') : r}
                                </button>
                                ))}
                            </div>
                        </div>
                        <div className="min-w-[100px]">
                            <label className="text-app-muted text-xs mb-2 block">{labels.count}</label>
                            <div className="flex gap-2 bg-app-surface p-1 rounded-xl border border-app-border">
                                {[1, 2, 4].map(c => (
                                <button 
                                    key={c}
                                    onClick={() => setCount(c)}
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${count === c ? 'bg-app-surface-2 text-brand-primary' : 'text-app-muted hover:text-app-text'}`}
                                >
                                    {c}
                                </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    
                    {/* Generate Button */}
                    <Button 
                        id={uiContext.generateButtonId}
                        onClick={handleGenerate}
                        isLoading={isGenerating}
                        className="w-full py-4 text-xl shadow-brand-primary/20"
                    >
                        <Wand2 className="w-6 h-6" /> {labels.generate}
                    </Button>
              </div>
          </div>
      </div>

      {/* Results Stage (Moved to Bottom) */}
      <div className="min-h-[300px] bg-app-surface/50 border-2 border-dashed border-app-border rounded-3xl p-6 flex flex-col items-center justify-center transition-all duration-500 relative overflow-hidden">
         {results.length > 0 ? (
            <div className="w-full">
                <div className="flex justify-between items-center mb-4 px-2">
                    <h3 className="text-app-muted font-bold flex items-center gap-2">
                        <Wand2 size={16} /> {labels.results}
                    </h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                    {results.map((url, idx) => (
                        <div key={idx} className="group relative rounded-xl overflow-hidden aspect-square border border-app-border hover:border-brand-primary transition-all shadow-lg animate-fade-in">
                            <img src={url} alt="Result" className="w-full h-full object-cover" />
                            
                            {/* Overlay Actions */}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-sm">
                                    {/* Preview */}
                                    <button onClick={() => setPreviewImage(url)} className="p-2 bg-zinc-800 text-white rounded-full hover:bg-brand-primary hover:text-white transition-colors" title={labels.preview}>
                                    <Eye className="w-4 h-4" />
                                    </button>
                                    {/* Edit */}
                                    <button onClick={() => openEditModal(url)} className="p-2 bg-zinc-800 text-white rounded-full hover:bg-brand-primary hover:text-white transition-colors" title={labels.edit}>
                                    <PenLine className="w-4 h-4" />
                                    </button>
                                    {/* Download */}
                                    <a href={url} download={`generated-${idx}.png`} className="p-2 bg-zinc-800 text-white rounded-full hover:bg-brand-primary hover:text-white transition-colors" title="Download">
                                    <Download className="w-4 h-4" />
                                    </a>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
         ) : (
            <div className="text-app-muted flex flex-col items-center gap-3 animate-pulse">
                <div className="w-16 h-16 rounded-full bg-app-surface flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 opacity-40" />
                </div>
                <p className="font-medium">{labels.placeholder}</p>
            </div>
         )}
         
         {/* Loading Overlay */}
         {isGenerating && (
             <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                 <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                 <p className="text-brand-primary font-bold animate-pulse">{lang === 'ar' ? 'جاري التوليد...' : 'Generating...'}</p>
             </div>
         )}
      </div>

      {/* Full Preview Modal */}
      <Modal isOpen={!!previewImage} onClose={() => setPreviewImage(null)} title={labels.preview}>
        {previewImage && (
             <img src={previewImage} alt="Full Preview" className="w-full h-auto rounded-lg" />
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editingImage} onClose={() => setEditingImage(null)} title={labels.editTitle}>
        <div className="flex flex-col gap-4">
             {editingImage && (
                 <div className="h-64 w-full bg-black rounded-lg overflow-hidden flex items-center justify-center">
                      <img src={editingImage} alt="To Edit" className="h-full object-contain" />
                 </div>
             )}
             <textarea 
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                placeholder={labels.editPlaceholder}
                className="w-full bg-app-input p-4 rounded-xl border border-app-border focus:border-brand-primary outline-none text-app-text resize-none h-32"
                dir={lang === 'ar' ? 'rtl' : 'ltr'}
             />
             <Button onClick={applyEdit} isLoading={isApplyingEdit}>
                 <Wand2 className="w-4 h-4" /> {labels.apply}
             </Button>
        </div>
      </Modal>

    </div>
  );
};
