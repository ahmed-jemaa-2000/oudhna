
export type Lang = 'ar' | 'en';
export type Direction = 'rtl' | 'ltr';
export type ToolType = 'imageEditor' | 'storyMaker' | 'magicEraser';

export interface UIContext {
  translateButtonId: string;
  languageToggleId: string;
  enhanceButtonId: string;
  generateButtonId: string;
  descriptionFieldId: string;
}

// Schemas based on the prompt instructions

export interface Audit {
  requestId: string;
  timestamp: string;
  attempts: number;
}

export interface Timing {
  analysis_ms: number;
  generation_ms: number;
}

export interface UIUpdates {
  elementId: string;
  set_text?: string;
  button_state?: 'loading' | 'idle' | 'disabled' | 'completed';
  button_color?: string;
  spinner?: boolean;
  progress?: { completed: number; total: number };
  translate_button?: {
    elementId: string;
    tooltip: string;
  };
  icon_state?: 'active' | 'inactive';
  animation?: 'flip' | 'fade';
  apply_to_field?: string;
}

export interface BaseResponse {
  type: string;
  audit: Audit;
  timing: Timing;
  ui_updates?: UIUpdates;
}

export interface TranslateResponse extends BaseResponse {
  type: 'translateDescription';
  original_text: string;
  translated_text: string;
  lang: Lang;
  direction: Direction;
}

export interface EnhanceResponse extends BaseResponse {
  type: 'enhanceDescription';
  original_description: string;
  enhanced_description: string;
  lang: Lang;
  diff: {
    added_phrases: string[];
    removed_phrases: string[];
    modified_phrases: { from: string; to: string }[];
  };
}

export interface GeneratedImageOutput {
  image_url: string; // Base64 or URL
  seed: string | null;
  model_used: string;
  width: number;
  height: number;
  aspect_ratio: string;
  cost_estimate_tokens: number;
}

export interface BatchResult {
  input_index: number;
  outputs: GeneratedImageOutput[];
  error: null | { code: string; message: string };
}

export interface BatchEditsResponse extends BaseResponse {
  type: 'batchEdits';
  results: BatchResult[];
}

export interface RemoveWatermarkResponse extends BaseResponse {
  type: 'removeWatermark';
  original_image: string;
  clean_image: string;
  watermarkDescription: string;
  comparison: {
    slider_start_pct: number;
    slider_end_pct: number;
  };
  notes: string;
}

export interface StoryScene {
  scene_number: number;
  description: string; // The visual description used for generation
  prompt_ar?: string; // Prompt in Arabic
  prompt_en?: string; // Prompt in English
  voiceover_fusha?: string; // Voiceover in Standard Arabic
  voiceover_egyptian?: string; // Voiceover in Egyptian Arabic
  camera: string;
  style: string;
  image_url?: string; // Generated image
  isLoading?: boolean; // UI state
  image_generation: {
    prompt: string;
    negative_prompt: string;
  };
  // Veo 3.1 Video Prompt Fields
  video_prompt?: string;        // English video prompt optimized for Veo 3.1
  camera_movement?: string;     // e.g., "dolly in slowly", "orbit clockwise", "static"
  scene_duration?: number;      // Duration in seconds (default: 8)
  character_bible?: string;     // Full character description repeated for consistency
  mood?: string;                // Emotional tone: "tense", "joyful", "mysterious", etc.
}

export interface StoryboardResponse extends BaseResponse {
  type: 'storyboard';
  plan: {
    title: string;
    scene_count: number;
    scenes: StoryScene[];
  }
}

export interface CharacterProfile {
  name: string;
  visual_description: string;
  image_url?: string;
}

export interface ErrorResponse extends BaseResponse {
  type: 'error';
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

// History Types
export type HistoryType = 'image' | 'story' | 'eraser';

export interface BaseHistoryItem {
  id: string;
  timestamp: number;
  type: HistoryType;
}

export interface ImageHistoryItem extends BaseHistoryItem {
  type: 'image';
  prompt: string;
  images: string[]; // List of generated image URLs
}

export interface StoryHistoryItem extends BaseHistoryItem {
  type: 'story';
  title: string;
  script: string;
  scenes: StoryScene[];
}

export interface EraserHistoryItem extends BaseHistoryItem {
  type: 'eraser';
  original: string;
  result: string;
}

export type HistoryItem = ImageHistoryItem | StoryHistoryItem | EraserHistoryItem;
