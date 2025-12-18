import React, { useState } from 'react';
import { Eraser, Upload, Eye, Download, PenLine, Wand2 } from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { Lang, UIContext } from '../types';
import * as GeminiService from '../services/geminiService';
import * as HistoryService from '../services/historyService';

interface MagicEraserProps {
  lang: Lang;
}

export const MagicEraser: React.FC<MagicEraserProps> = ({ lang }) => {
  const [image, setImage] = useState<string | null>(null);
  const [watermarkDesc, setWatermarkDesc] = useState('');
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sliderVal, setSliderVal] = useState(50);

  // Actions State
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [isRefining, setIsRefining] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
          setImage(reader.result as string);
          setProcessedImage(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleErase = async () => {
    if (!image) return;
    setIsProcessing(true);
    
    // Construct strict prompt. If description is empty, use a smart default to detect watermarks automatically.
    const desc = watermarkDesc || "all watermarks, logos, and text overlays";
    const prompt = `Remove only the described watermark: ${desc}. Preserve all real content, lighting, and texture. Do not invent new major elements.`;
    
    const uiContext: UIContext = {
        translateButtonId: '', languageToggleId: '', enhanceButtonId: '', generateButtonId: 'btn-erase', descriptionFieldId: ''
    };

    // Use 'custom' aspect ratio to preserve input dimensions
    const res = await GeminiService.generateImageBatch(prompt, [image], 'custom', 1, uiContext);

    if (res.type === 'batchEdits' && res.results[0].outputs.length > 0) {
        const resultUrl = res.results[0].outputs[0].image_url;
        setProcessedImage(resultUrl);
        setSliderVal(50);

        // Save to History
        await HistoryService.saveItem({
            id: `erase-${Date.now()}`,
            timestamp: Date.now(),
            type: 'eraser',
            original: image,
            result: resultUrl
        });
    }
    setIsProcessing(false);
  };

  const openRefineModal = () => {
      setIsEditing(true);
      setRefinePrompt(watermarkDesc);
  };

  const handleRefine = async () => {
      if (!processedImage || !refinePrompt) return;
      setIsRefining(true);
      
      const uiContext: UIContext = {
        translateButtonId: '', languageToggleId: '', enhanceButtonId: '', generateButtonId: 'btn-refine', descriptionFieldId: ''
      };
      
      // Refine using the processed image as input, maintaining custom aspect ratio
      const res = await GeminiService.generateImageBatch(refinePrompt, [processedImage], 'custom', 1, uiContext);

      if (res.type === 'batchEdits' && res.results[0].outputs.length > 0) {
          setProcessedImage(res.results[0].outputs[0].image_url);
          setIsEditing(false);
      }
      setIsRefining(false);
  };

  const labels = {
    upload: lang === 'ar' ? 'ارفع صورة لإزالة العلامة المائية' : 'Upload image to remove watermark',
    descPh: lang === 'ar' ? 'صف العلامة المائية (اختياري - سيتم الحذف تلقائياً إن ترك فارغاً)...' : 'Describe the watermark (Optional - auto-remove if empty)...',
    erase: lang === 'ar' ? 'إزالة' : 'Erase',
    preview: lang === 'ar' ? 'معاينة' : 'Preview',
    edit: lang === 'ar' ? 'تعديل' : 'Edit',
    apply: lang === 'ar' ? 'تطبيق' : 'Apply',
  };

  return (
    <div className="flex flex-col gap-6 pb-24 animate-fade-in max-w-4xl mx-auto">
        
        {/* Input Area */}
        <div className="grid md:grid-cols-2 gap-6">
            <div className="relative aspect-square bg-app-surface rounded-2xl overflow-hidden border border-app-border group">
                 {!image ? (
                     <div className="absolute inset-0 flex flex-col items-center justify-center text-app-muted">
                         <Upload className="w-8 h-8 mb-2 group-hover:text-brand-primary transition-colors" />
                         <span className="text-center px-4">{labels.upload}</span>
                     </div>
                 ) : (
                     <img src={image} alt="Original" className="w-full h-full object-contain" />
                 )}
                 <input type="file" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>

            <div className="flex flex-col justify-center gap-4">
                 <textarea
                    value={watermarkDesc}
                    onChange={(e) => setWatermarkDesc(e.target.value)}
                    placeholder={labels.descPh}
                    className="w-full h-32 bg-app-surface rounded-xl p-4 text-app-text outline-none border border-app-border focus:border-brand-primary transition-colors resize-none"
                    dir={lang === 'ar' ? 'rtl' : 'ltr'}
                 />
                 <Button id="btn-erase" onClick={handleErase} isLoading={isProcessing} disabled={!image}>
                     <Eraser className="w-4 h-4" /> {labels.erase}
                 </Button>
            </div>
        </div>

        {/* Comparison Result */}
        {processedImage && image && (
            <div className="mt-8">
                {/* 
                   Comparison Slider Container
                   - Removed aspect-square/video to allow container to adapt to image height.
                   - Uses the "Before" image to define the container size.
                */}
                <div className="relative w-full rounded-2xl overflow-hidden cursor-ew-resize select-none border border-brand-primary/30 shadow-2xl shadow-brand-primary/10 group">
                    
                    {/* Before Image (Background/Size Reference) */}
                    <img src={image} alt="Before" className="block w-full h-auto" />
                    
                    {/* After Image (Clipped on top) */}
                    <div 
                        className="absolute inset-0 overflow-hidden"
                        style={{ clipPath: `inset(0 ${100 - sliderVal}% 0 0)` }}
                    >
                        {/* Force full size to match container */}
                        <img src={processedImage} alt="After" className="w-full h-full" />
                    </div>

                    {/* Slider Handle */}
                    <div 
                        className="absolute inset-y-0 w-0.5 bg-brand-primary/80 shadow-[0_0_15px_#8B5CF6]"
                        style={{ left: `${sliderVal}%` }}
                    >
                        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-brand-primary rounded-full flex items-center justify-center shadow-lg text-black font-bold text-xs">
                            <span className="sr-only">Slide</span>
                            ↔
                        </div>
                    </div>

                    {/* Interaction Layer */}
                    <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={sliderVal} 
                        onChange={(e) => setSliderVal(Number(e.target.value))}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20 m-0 p-0"
                    />

                    {/* Overlay Action Buttons (Visible on Hover) */}
                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-30">
                        <button onClick={() => setPreviewImage(processedImage)} className="p-2 bg-black/80 text-white rounded-full hover:bg-brand-primary" title={labels.preview}>
                            <Eye size={16} />
                        </button>
                        <button onClick={openRefineModal} className="p-2 bg-black/80 text-white rounded-full hover:bg-brand-primary" title={labels.edit}>
                            <PenLine size={16} />
                        </button>
                        <a href={processedImage} download="magic-eraser-result.png" className="p-2 bg-black/80 text-white rounded-full hover:bg-brand-primary" title="Download">
                            <Download size={16} />
                        </a>
                    </div>
                </div>
            </div>
        )}

        {/* Preview Modal */}
        <Modal isOpen={!!previewImage} onClose={() => setPreviewImage(null)} title={labels.preview}>
            {previewImage && <img src={previewImage} alt="Result Preview" className="w-full rounded-lg" />}
        </Modal>

        {/* Refine Modal */}
        <Modal isOpen={isEditing} onClose={() => setIsEditing(false)} title={labels.edit}>
            <div className="flex flex-col gap-4">
                 {processedImage && (
                     <div className="h-40 w-full bg-black rounded-lg overflow-hidden flex items-center justify-center">
                          <img src={processedImage} alt="To Refine" className="h-full object-contain" />
                     </div>
                 )}
                 <textarea 
                    value={refinePrompt}
                    onChange={(e) => setRefinePrompt(e.target.value)}
                    placeholder="Describe further edits..."
                    className="w-full bg-app-input p-4 rounded-xl border border-app-border focus:border-brand-primary outline-none text-app-text resize-none h-32"
                    dir={lang === 'ar' ? 'rtl' : 'ltr'}
                 />
                 <Button onClick={handleRefine} isLoading={isRefining}>
                     <Wand2 className="w-4 h-4" /> {labels.apply}
                 </Button>
            </div>
        </Modal>

    </div>
  );
};
