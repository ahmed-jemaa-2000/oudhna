
import { GoogleGenAI, Schema, Type, GenerateContentResponse, Part } from "@google/genai";
import {
  TranslateResponse,
  EnhanceResponse,
  BatchEditsResponse,
  StoryboardResponse,
  ErrorResponse,
  Lang,
  UIContext,
  GeneratedImageOutput,
  CharacterProfile
} from '../types';

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// --- Helper Types for Gemini Response Parsing ---

const TRANSLATE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    original_text: { type: Type.STRING },
    translated_text: { type: Type.STRING },
    lang: { type: Type.STRING, enum: ["ar", "en"] },
    direction: { type: Type.STRING, enum: ["rtl", "ltr"] },
  },
  required: ["translated_text", "lang", "direction"]
};

const ENHANCE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    original_description: { type: Type.STRING },
    enhanced_description: { type: Type.STRING },
    lang: { type: Type.STRING, enum: ["ar", "en"] },
    diff: {
      type: Type.OBJECT,
      properties: {
        added_phrases: { type: Type.ARRAY, items: { type: Type.STRING } },
        removed_phrases: { type: Type.ARRAY, items: { type: Type.STRING } },
        modified_phrases: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { from: { type: Type.STRING }, to: { type: Type.STRING } }
          }
        }
      }
    }
  },
  required: ["enhanced_description", "diff"]
};

const CHARACTER_PROFILES_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    characters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          visual_description: { type: Type.STRING, description: "Detailed visual description of face, hair, body, and clothing." }
        },
        required: ["name", "visual_description"]
      }
    }
  },
  required: ["characters"]
};

const STORYBOARD_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    scene_count: { type: Type.INTEGER },
    character_bible: { type: Type.STRING, description: "Complete visual description of ALL main characters. This MUST be included in every video_prompt for consistency." },
    scenes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          scene_number: { type: Type.INTEGER },
          description: { type: Type.STRING },
          prompt_ar: { type: Type.STRING, description: "Detailed scene prompt in Arabic" },
          prompt_en: { type: Type.STRING, description: "Detailed scene prompt in English" },
          voiceover_fusha: { type: Type.STRING, description: "Voiceover script in Standard Arabic (Fusha)" },
          voiceover_egyptian: { type: Type.STRING, description: "Voiceover script in Egyptian Arabic (Ammeya)" },
          camera: { type: Type.STRING },
          style: { type: Type.STRING },
          // New Veo 3.1 Video Fields
          video_prompt: { type: Type.STRING, description: "Complete English video prompt for Veo 3.1. MUST include full character descriptions, camera movement, scene action, mood, and technical specs." },
          camera_movement: { type: Type.STRING, description: "Camera movement type: 'static', 'dolly in', 'dolly out', 'pan left', 'pan right', 'tilt up', 'tilt down', 'orbit', 'tracking', 'crane up', 'crane down'" },
          scene_duration: { type: Type.INTEGER, description: "Scene duration in seconds (default: 8)" },
          mood: { type: Type.STRING, description: "Emotional tone: 'tense', 'joyful', 'mysterious', 'calm', 'exciting', 'sad', 'romantic'" },
          image_generation: {
            type: Type.OBJECT,
            properties: {
              prompt: { type: Type.STRING },
              negative_prompt: { type: Type.STRING }
            }
          }
        },
        required: ["scene_number", "description", "prompt_ar", "prompt_en", "voiceover_fusha", "voiceover_egyptian", "video_prompt", "camera_movement", "scene_duration", "mood", "image_generation"]
      }
    }
  },
  required: ["title", "scene_count", "character_bible", "scenes"]
};


// --- Service Functions ---

// Helper: Retry mechanism with exponential backoff
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 5): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      const status = error.status || error.response?.status;
      // Retry only on rate limits (429) or service unavailable (503)
      const shouldRetry = (status === 429 || status === 503) && attempt <= maxRetries;

      if (!shouldRetry) throw error;

      // Delay: 800ms * 2^(attempt-1) + jitter
      const delay = 800 * Math.pow(2, attempt - 1) + Math.random() * 300;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

export const translateDescription = async (
  text: string,
  targetLang: Lang,
  uiContext: UIContext
): Promise<TranslateResponse | ErrorResponse> => {
  const startTime = Date.now();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Translate the following description to ${targetLang === 'ar' ? 'Arabic' : 'English'}.
      Input: "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: TRANSLATE_SCHEMA
      }
    });

    const result = JSON.parse(response.text || '{}');

    return {
      type: 'translateDescription',
      original_text: text,
      translated_text: result.translated_text,
      lang: result.lang,
      direction: result.direction,
      audit: { requestId: `req-${Date.now()}`, timestamp: new Date().toISOString(), attempts: 1 },
      timing: { analysis_ms: 0, generation_ms: Date.now() - startTime },
      ui_updates: {
        elementId: uiContext.descriptionFieldId,
        set_text: result.translated_text,
        translate_button: {
          elementId: uiContext.translateButtonId,
          tooltip: targetLang === 'ar' ? 'تمت الترجمة' : 'Translated'
        }
      }
    };
  } catch (e: any) {
    return createError(e.message);
  }
};

export const enhanceDescription = async (
  description: string,
  lang: Lang,
  level: 'light' | 'medium' | 'strong',
  uiContext: UIContext
): Promise<EnhanceResponse | ErrorResponse> => {
  const startTime = Date.now();
  try {
    const prompt = `Enhance the following image description for an AI image generator. 
    Level: ${level}. Language: ${lang}.
    Description: "${description}"
    Maintain the core meaning but add details about lighting, style, and camera.
    Return strictly JSON matching the schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: ENHANCE_SCHEMA
      }
    });

    const result = JSON.parse(response.text || '{}');

    return {
      type: 'enhanceDescription',
      ...result,
      audit: { requestId: `req-${Date.now()}`, timestamp: new Date().toISOString(), attempts: 1 },
      timing: { analysis_ms: 0, generation_ms: Date.now() - startTime },
      ui_updates: {
        elementId: uiContext.enhanceButtonId,
        button_state: 'completed',
        apply_to_field: uiContext.descriptionFieldId
      }
    };
  } catch (e: any) {
    return createError(e.message);
  }
};

export const generateCharacterProfiles = async (
  script: string,
  lang: Lang
): Promise<{ characters: CharacterProfile[] } | ErrorResponse> => {
  try {
    const prompt = `Identify the main characters in the following story script. 
        Extract their names and provide a detailed visual description for each (face, body, clothes, key features) to be used for image generation.
        Script: "${script}"
        Language: ${lang}.
        `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: CHARACTER_PROFILES_SCHEMA
      }
    });

    const result = JSON.parse(response.text || '{}');
    return result; // Returns { characters: [...] }
  } catch (e: any) {
    return createError(e.message);
  }
}

export const generateStoryPlan = async (
  script: string,
  style: string,
  lang: Lang,
  sceneCount: number = 6
): Promise<StoryboardResponse | ErrorResponse> => {
  const startTime = Date.now();
  try {
    const prompt = `
You are a professional Storyboard Artist, Director, and Video Prompt Engineer.
Create a coherent story plan with EXACTLY ${sceneCount} scenes based on this idea: "${script}".
Style: ${style}.
Language for voiceovers: Arabic (Fusha and Egyptian). Language for video_prompt: English.

=== CRITICAL INSTRUCTIONS ===

1. **CHARACTER BIBLE** (Top Priority):
   - Create a detailed "character_bible" field with COMPLETE visual descriptions of ALL main characters.
   - Include: Name, age, height, body type, skin tone, face shape, eye color, hair style/color, facial hair, clothing, accessories, distinguishing features.
   - Example: "Ahmed: A 35-year-old Egyptian man, tall (185cm), athletic build, olive skin, oval face, brown eyes, short black curly hair, trimmed beard, warm smile. Wearing a navy blue linen shirt, khaki pants, brown leather sandals, silver watch on left wrist."

2. **VIDEO PROMPT** (For Veo 3.1 - ENGLISH ONLY):
   Each scene's "video_prompt" MUST follow this structure:
   
   [SHOT TYPE]: [CAMERA MOVEMENT]
   
   SCENE: [Detailed action description with environment, lighting, time of day]
   
   CHARACTER IDENTITY (PRESERVE EXACTLY FROM CHARACTER BIBLE):
   [Copy the FULL character descriptions here - do NOT abbreviate]
   
   STYLE: ${style}, [lighting description], [atmosphere]
   
   AUDIO: "[Arabic voiceover text]" - spoken naturally over 8 seconds
   
   TECHNICAL: 16:9 aspect ratio, cinematic color grading, smooth motion, 8 seconds duration

3. **CAMERA MOVEMENTS** (Choose appropriate for each scene):
   - "static" - No movement, focus on emotion/dialogue
   - "dolly in" - Move toward subject, build tension/intimacy
   - "dolly out" - Pull away, reveal context
   - "pan left/right" - Horizontal sweep, reveal environment
   - "tilt up/down" - Vertical movement, show scale
   - "orbit" - Circle around subject, dynamic energy
   - "tracking" - Follow subject movement
   - "crane up/down" - Dramatic vertical rise/fall

4. **SCENE DURATION**: Always 8 seconds per scene.

5. **MOOD** per scene: Choose from: "tense", "joyful", "mysterious", "calm", "exciting", "sad", "romantic", "dramatic", "peaceful", "comedic"

6. **VOICEOVERS** (Arabic):
   - 'voiceover_fusha': Professional Standard Arabic (Formal/Dramatic)
   - 'voiceover_egyptian': Egyptian Arabic Dialect (Natural/Conversational)
   - Each voiceover must be timed to fit within 8 seconds when spoken naturally.

7. **IMAGE GENERATION PROMPT**: Include full character descriptions for image consistency.

8. **NARRATIVE COHERENCE**: Scenes must form a complete story with beginning, middle, and end.

Return valid JSON matching the schema.
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: STORYBOARD_SCHEMA
      }
    });

    const result = JSON.parse(response.text || '{}');

    return {
      type: 'storyboard',
      plan: result,
      audit: { requestId: `req-${Date.now()}`, timestamp: new Date().toISOString(), attempts: 1 },
      timing: { analysis_ms: 0, generation_ms: Date.now() - startTime }
    };
  } catch (e: any) {
    return createError(e.message);
  }
}

// Generate Images using Gemini 2.5 Flash Image
export const generateImageBatch = async (
  prompt: string,
  base64Images: string[], // Optional input images for editing/fusion
  aspectRatio: string,
  count: number,
  uiContext: UIContext,
  mode: 'fusion' | 'scene' | 'edit' = 'fusion', // Added mode
  style: string = '' // Added style for scenes
): Promise<BatchEditsResponse | ErrorResponse> => {
  const startTime = Date.now();
  try {
    const generatedResults: GeneratedImageOutput[] = [];
    let lastError: any = null;

    // Construct Prompt based on Mode
    let effectivePrompt = "";

    if (mode === 'scene') {
      // Story Mode Prompting - ULTRA STRICT CHARACTER CONSISTENCY
      if (base64Images.length > 0) {
        // CRITICAL: Character reference comes FIRST with absolute identity lock
        effectivePrompt = `
=== ABSOLUTE CHARACTER IDENTITY LOCK ===
The input reference image(s) show the EXACT character that MUST appear in ALL output images.

MANDATORY - COPY EXACTLY FROM REFERENCE (NO CHANGES ALLOWED):
✓ SAME face shape, nose shape, eye shape, eye color, eyebrow thickness
✓ SAME skin tone and complexion (exact shade)
✓ SAME hair style, hair color, hair length
✓ SAME age appearance (if child, KEEP as child - do NOT age up)
✓ SAME body proportions and build
✓ SAME outfit, clothing colors, and accessories
✓ SAME any distinctive features (hat, glasses, backpack, etc.)

STRICTLY FORBIDDEN - DO NOT:
✗ DO NOT change ANY facial features
✗ DO NOT change skin color or tone
✗ DO NOT change hair style or color
✗ DO NOT change clothes or accessories
✗ DO NOT make the character look older or younger
✗ DO NOT add or remove any accessories (hats, bags, etc.)
✗ DO NOT change the art style of the character (if reference is Pixar, keep Pixar)
✗ DO NOT stylize or cartoonize differently than the reference

=== SCENE TO GENERATE ===
${prompt}

RENDERING INSTRUCTIONS:
- Place the EXACT character from reference into this scene
- Match the reference's art style: ${style}
- The character's identity is MORE IMPORTANT than the scene - if there's any conflict, preserve the character
`;
      } else {
        // No uploaded characters - Rely on detailed text description
        effectivePrompt = `Generate a high quality story scene. Style: ${style}.
Scene Description: "${prompt}".

CHARACTER CONSISTENCY INSTRUCTION:
Ensure the character described in the prompt maintains EXACTLY the same appearance throughout.
Do NOT change any facial features, clothing, or accessories from the description.`;
      }
    } else if (mode === 'edit') {
      // Specific Edit Mode for Scenes or Images
      effectivePrompt = `Edit the provided image (or generate a new one if no image) to match this modified description: "${prompt}". 
         Maintain the original style and character consistency. High quality.`;
    } else {
      // Default / Fusion
      if (base64Images.length > 1) {
        effectivePrompt = `Combine all uploaded images into one coherent visual output according to this description: ${prompt}. Maintain consistent lighting, perspective, and realism. No text, no logos, no watermarks.`;
      } else if (base64Images.length === 1) {
        effectivePrompt = `Edit the image based on this instruction: ${prompt}. Keep the original composition where possible unless asked to change it. High quality.`;
      } else {
        effectivePrompt = `Generate an image described as: ${prompt}`;
      }
    }

    // Enforce high quality
    effectivePrompt += " Generate high quality, 8k resolution, detailed image. Ensure the image is fully generated and not empty.";

    // STRICT: Reinforce aspect ratio in text prompt ONLY if not custom
    if (aspectRatio !== 'custom') {
      effectivePrompt += ` The output image must be generated with a strict ${aspectRatio} aspect ratio, cropping or filling as necessary to fit the frame perfectly.`;
    } else {
      effectivePrompt += ` Follow the natural aspect ratio of the input image(s) or the most appropriate composition.`;
    }

    // Perform batch generation loop
    for (let i = 0; i < count; i++) {
      const parts: Part[] = [];

      // Add images if present
      for (const b64 of base64Images) {
        let mimeType = "image/png";
        let data = b64;

        // Extract correct MIME type from Data URL
        if (b64.includes(';base64,')) {
          const split = b64.split(';base64,');
          mimeType = split[0].replace('data:', '');
          data = split[1];
        } else if (b64.startsWith('data:')) {
          const split = b64.split(',');
          mimeType = split[0].replace('data:', '').split(';')[0];
          data = split[1];
        }

        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: data
          }
        });
      }

      // Add prompt
      parts.push({ text: effectivePrompt });

      try {
        const generationConfig: any = {
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
          ]
        };

        if (aspectRatio !== 'custom') {
          generationConfig.imageConfig = { aspectRatio: aspectRatio };
        }

        // Call API with Retry
        const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: { parts },
          config: generationConfig
        }));

        // Extract image
        let imageUrl = "";
        let textOutput = "";

        const candidate = response.candidates?.[0];

        if (candidate) {
          if (candidate.finishReason && candidate.finishReason !== "STOP") {
            console.warn(`Generation candidate finished with reason: ${candidate.finishReason}`);
            if (candidate.finishReason === 'SAFETY') {
              throw new Error("Image generation was blocked by safety filters.");
            }
          }

          if (candidate.content?.parts) {
            for (const part of candidate.content.parts) {
              if (part.inlineData && part.inlineData.data) {
                imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
              } else if (part.text) {
                textOutput += part.text;
              }
            }
          }
        } else {
          throw new Error("No candidates returned from the model.");
        }

        if (imageUrl) {
          generatedResults.push({
            image_url: imageUrl,
            seed: "12345",
            model_used: "gemini-2.5-flash-image",
            width: 1024,
            height: 1024,
            aspect_ratio: aspectRatio,
            cost_estimate_tokens: 100
          });
        } else {
          const reason = textOutput ? `Model refused: ${textOutput}` : "No image data found. The model may have blocked the content.";
          console.error("Image generation failed for item " + i, reason);
          throw new Error(reason);
        }
      } catch (innerError: any) {
        console.error(`Failed to generate image ${i + 1}/${count}:`, innerError);
        lastError = innerError;
      }
    }

    if (generatedResults.length === 0) {
      throw new Error(lastError?.message || "Failed to generate any images after retries.");
    }

    return {
      type: 'batchEdits',
      results: [{
        input_index: 0,
        outputs: generatedResults,
        error: null
      }],
      audit: { requestId: `req-${Date.now()}`, timestamp: new Date().toISOString(), attempts: 1 },
      timing: { analysis_ms: 0, generation_ms: Date.now() - startTime },
      ui_updates: {
        elementId: uiContext.generateButtonId,
        button_state: 'idle',
        button_color: '#FF7A00',
        spinner: false,
        progress: { completed: generatedResults.length, total: count }
      }
    };
  } catch (e: any) {
    return {
      type: 'error',
      error: { code: 'MODEL_ERROR', message: e.message || "Unknown error during generation", retryable: true },
      audit: { requestId: `err-${Date.now()}`, timestamp: new Date().toISOString(), attempts: 1 },
      timing: { analysis_ms: 0, generation_ms: 0 },
      ui_updates: {
        elementId: uiContext.generateButtonId,
        button_state: 'idle',
        button_color: '#FF7A00',
        spinner: false
      }
    };
  }
};


function createError(msg: string): ErrorResponse {
  return {
    type: 'error',
    error: {
      code: "API_ERROR",
      message: msg,
      retryable: true
    },
    audit: { requestId: "err", timestamp: new Date().toISOString(), attempts: 1 },
    timing: { analysis_ms: 0, generation_ms: 0 }
  };
}
