
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
    historical_context: { type: Type.STRING, description: "Brief historical context for the entire story - era, location, key historical facts" },
    scenes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          scene_number: { type: Type.INTEGER },
          description: { type: Type.STRING },
          prompt_ar: { type: Type.STRING, description: "Detailed scene prompt in Arabic" },
          prompt_en: { type: Type.STRING, description: "Detailed scene prompt in English" },
          voiceover_fusha: { type: Type.STRING, description: "Voiceover script in Standard Arabic (Fusha) - educational and historically accurate" },
          camera: { type: Type.STRING },
          style: { type: Type.STRING },
          // Veo 3.1 Video Fields
          video_prompt: { type: Type.STRING, description: "Complete English video prompt for Veo 3.1. MUST include full character descriptions, camera movement, scene action, mood, and technical specs." },
          camera_movement: { type: Type.STRING, description: "Camera movement type: 'static', 'dolly in', 'dolly out', 'pan left', 'pan right', 'tilt up', 'tilt down', 'orbit', 'tracking', 'crane up', 'crane down'" },
          scene_duration: { type: Type.INTEGER, description: "Scene duration in seconds (default: 8)" },
          mood: { type: Type.STRING, description: "Emotional tone: 'tense', 'joyful', 'mysterious', 'calm', 'exciting', 'sad', 'romantic'" },
          // Historical Accuracy Fields
          historical_facts: { type: Type.STRING, description: "Key verified historical facts mentioned in this scene - dates, events, people, architectural details" },
          historical_period: { type: Type.STRING, description: "The historical era/period: e.g., 'Roman Era (146 BC - 439 AD)', 'Byzantine Period', 'Islamic Golden Age'" },
          image_generation: {
            type: Type.OBJECT,
            properties: {
              prompt: { type: Type.STRING },
              negative_prompt: { type: Type.STRING }
            }
          }
        },
        required: ["scene_number", "description", "prompt_ar", "prompt_en", "voiceover_fusha", "video_prompt", "camera_movement", "scene_duration", "mood", "historical_facts", "historical_period", "image_generation"]
      }
    }
  },
  required: ["title", "scene_count", "character_bible", "historical_context", "scenes"]
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

// Research Historical Location - Auto-fetch facts using AI
export interface LocationResearch {
  location_name: string;
  historical_era: string;
  key_facts: string[];
  landmarks: string[];
  notable_figures: string[];
  historical_significance: string;
  recommended_scenes: string[];
}

export const researchLocation = async (
  locationName: string,
  lang: Lang
): Promise<{ research: LocationResearch } | ErrorResponse> => {
  try {
    const prompt = lang === 'ar'
      ? `أنت مؤرخ خبير. ابحث عن الموقع التاريخي: "${locationName}"

قدم معلومات موثقة ودقيقة فقط. إذا كنت غير متأكد، قل ذلك.

أريد:
1. الحقبة التاريخية (مثال: "العصر الروماني 146 ق.م - 439 م")
2. 5-8 حقائق تاريخية رئيسية موثقة
3. المعالم والآثار الموجودة
4. الشخصيات التاريخية المرتبطة بالموقع
5. الأهمية التاريخية للموقع
6. 8 أفكار لمشاهد وثائقية مدتها 8 ثوانٍ لكل منها

أجب بالعربية الفصحى.`
      : `You are an expert historian. Research the historical location: "${locationName}"

Provide ONLY verified, accurate information. If unsure, say so.

I need:
1. Historical era (e.g., "Roman Period 146 BC - 439 AD")
2. 5-8 key verified historical facts
3. Existing landmarks and archaeological sites
4. Notable historical figures connected to the location
5. Historical significance of the location
6. 8 documentary scene ideas (8 seconds each)

Respond in English.`;

    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        location_name: { type: Type.STRING },
        historical_era: { type: Type.STRING },
        key_facts: { type: Type.ARRAY, items: { type: Type.STRING } },
        landmarks: { type: Type.ARRAY, items: { type: Type.STRING } },
        notable_figures: { type: Type.ARRAY, items: { type: Type.STRING } },
        historical_significance: { type: Type.STRING },
        recommended_scenes: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["location_name", "historical_era", "key_facts", "landmarks", "historical_significance", "recommended_scenes"]
    };

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    const result = JSON.parse(response.text || '{}');

    return { research: result as LocationResearch };
  } catch (e: any) {
    return createError(e.message);
  };
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
You are a professional Storyboard Artist, Director, Historian, and Educational Content Creator.
Create a coherent story plan with EXACTLY ${sceneCount} scenes based on this idea: "${script}".
Style: ${style}.
Language for voiceovers: Arabic (Fusha - Standard Arabic ONLY). Language for video_prompt: English.

=== HISTORICAL ACCURACY IS MANDATORY ===

You MUST research and verify ALL historical information before including it. This is educational content.
- Use accurate dates, names, events, and descriptions
- Include specific architectural details that match the historical period
- Mention real historical figures, their actual achievements, and correct time periods
- Describe authentic clothing, tools, and customs of the era
- NEVER fabricate or guess historical facts - only include verified information

=== CRITICAL INSTRUCTIONS ===

1. **HISTORICAL CONTEXT** (Top Priority):
   - Create a "historical_context" field with: Era name, exact date range, location, key historical significance
   - Example: "Roman Tunisia (Ifriqiya) - The city of Uthina (Oudna) was founded as a Roman colony around 30 BC under Emperor Augustus. It became a prosperous agricultural center known for olive oil production. The amphitheater seated 16,000 spectators and was built in the 2nd century AD."

2. **CHARACTER HANDLING** (CRITICAL FOR REFERENCE-BASED GENERATION):
   
   IMPORTANT: The user will provide a CHARACTER REFERENCE IMAGE in Nano Banana Pro.
   Therefore, you must NOT describe the character's appearance in image_generation.prompt!
   
   - The character_bible field can contain a brief description for internal use
   - But image_generation.prompt MUST NEVER include character appearance details
   - Just use "Same character [NAME] from reference" and describe the SCENE only
   
   BAD (DO NOT DO THIS):
   "Same character فارس from reference. A young man, Faris, mid-20s, athletic build, 
    tan skin, brown eyes, short dark hair, linen tunic, leather boots..."
   
   GOOD (DO THIS):
   "Same character فارس from reference. Wide shot. At entrance of ancient ruins, 
    looking up in wonder. Golden hour light, soft shadows. Pixar style, cinematic."

3. **IMAGE_GENERATION.PROMPT** (For Nano Banana Pro - ENGLISH ONLY):
   
   Each scene's image_generation.prompt MUST follow this EXACT structure:
   
   "Same character [NAME] from reference. [SHOT TYPE]. [SCENE DESCRIPTION]. [LIGHTING]. [STYLE]."
   
   RULES:
   - Start with "Same character [NAME] from reference"
   - NO character appearance (age, hair, clothes, skin) - reference image provides this!
   - Describe only: location, action, camera angle, lighting, atmosphere
   - End with style (e.g., "Pixar style, cinematic")
   - MAX 40 words
   
   EXAMPLES:
   - "Same character فارس from reference. Wide shot. Standing at ancient Roman amphitheater entrance, looking up in awe. Golden hour, warm shadows. Pixar style, cinematic."
   - "Same character فارس from reference. Close-up. Hand touching weathered stone column with carvings. Soft natural light. Pixar style."
   - "Same character فارس from reference. Tracking shot. Walking through temple ruins. Bright midday sun. Pixar style, cinematic."

4. **PER-SCENE HISTORICAL ACCURACY**:
   - "historical_facts": Specific verified facts presented in this scene
   - "historical_period": The exact era with dates
   - Voiceover must contain ONLY accurate historical information

5. **VIDEO PROMPT** (For Veo 3.1 with IMAGE REFERENCE - ENGLISH ONLY):
   
   CRITICAL: The generated scene image will be used as reference. DO NOT describe character appearance.
   Focus on: MOTION, ACTION, CAMERA, ATMOSPHERE, LIGHTING.
   
   Each video_prompt MUST be SHORT and follow this EXACT structure:
   
   "[CAMERA MOVE]. [CHARACTER ACTION]. [ENVIRONMENT DETAIL]. [LIGHTING/MOOD]. 8 seconds."
   
   GOOD EXAMPLES:
   - "Slow dolly in. Girl walks toward ancient ruins, looking up in wonder. Golden hour sun casts long shadows across Roman columns. Dust particles float in warm light. 8 seconds."
   - "Crane up and pull back. Character stands at amphitheater center, slowly turns to take in the massive stone seats. Soft morning mist. Cinematic. 8 seconds."
   - "Tracking shot following character. She traces her hand along weathered stone wall while walking. Dappled sunlight through olive trees. 8 seconds."
   - "Static wide shot. Character sits on ancient steps, opens a book. Wind gently moves her hair. Warm afternoon glow. 8 seconds."
   
   BAD (TOO LONG, DON'T DO THIS):
   - "CRANE UP: Dolly out slowly. SCENE: A young girl, Layla, walks towards..." (Character description not needed!)
   
   VIDEO PROMPT RULES:
   - MAX 50 words per prompt
   - Start with camera movement
   - Use present tense action verbs (walks, looks, touches, sits, stands, runs)
   - Include ONE atmospheric detail (lighting, weather, particles)
   - End with "8 seconds"
   - NO character appearance descriptions (image reference provides this)

6. **8-SCENE DOCUMENTARY STRUCTURE**:
   - Scene 1 (ARRIVAL): Wide establishing shot, character enters location
   - Scene 2 (DISCOVERY): Character explores, notices key landmark
   - Scene 3 (DETAIL): Close-up interaction with historical element
   - Scene 4 (HISTORY): Character at significant spot, voiceover shares key facts
   - Scene 5 (EXPLORATION): Walking through different area of site
   - Scene 6 (WONDER): Emotional moment, character appreciates the place
   - Scene 7 (LEARNING): Character examines artifacts/inscriptions
   - Scene 8 (FAREWELL): Character looks back, sunset/golden hour, closing

7. **CAMERA MOVEMENTS** (Choose one per scene, vary them):
   - "Static shot" (no movement, steady frame)
   - "Slow dolly in" (camera moves toward subject)
   - "Pull back" (camera moves away from subject)
   - "Pan left/right" (camera rotates horizontally)
   - "Tilt up/down" (camera rotates vertically)
   - "Orbit" (camera circles around subject)
   - "Tracking shot" (camera follows moving subject)
   - "Crane up" (camera lifts vertically)

8. **VOICEOVER** (Arabic Fusha ONLY):
   - Professional Standard Arabic (الفصحى)
   - Educational tone with specific historical facts
   - Each voiceover ~20-25 words (fits 8 seconds spoken naturally)
   - NO Egyptian dialect

8. **NARRATIVE COHERENCE**: Scenes form a complete educational journey with emotional arc.

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
      // Story Mode Prompting - OPTIMIZED FOR VEO 3.1 VIDEO REFERENCE
      if (base64Images.length > 0) {
        // Character reference + Video-ready scene
        effectivePrompt = `
=== CHARACTER IDENTITY (FROM REFERENCE IMAGE) ===
The reference image shows the EXACT character. Copy their appearance EXACTLY:
- Same face, hair, skin tone, age
- Same clothing and accessories
- Same art style (${style})

=== OUTPUT IMAGE REQUIREMENTS ===
Generate a HIGH QUALITY scene image optimized for VIDEO GENERATION:

COMPOSITION:
- Character clearly visible, not cropped
- Clean, uncluttered background
- Strong foreground/background separation
- Cinematic 16:9 framing

LIGHTING (CRITICAL FOR VIDEO):
- Neutral, even lighting (no harsh shadows)
- Golden hour or soft diffused light preferred
- Avoid complex multi-source lighting
- Consistent light direction

TECHNICAL:
- Sharp focus on character
- Smooth, film-like color grading
- No text, logos, or watermarks
- Static pose (easier for video animation)

=== SCENE TO GENERATE ===
${prompt}

STYLE: ${style}, cinematic, film quality, 4K detail
`;
      } else {
        // No uploaded characters - Generate with description
        effectivePrompt = `Generate a cinematic scene image optimized for video generation.

STYLE: ${style}
SCENE: ${prompt}

QUALITY REQUIREMENTS:
- Cinematic 16:9 composition
- Neutral, even lighting
- Clear subject focus
- No text or watermarks
- Film-like color grading
- Sharp details, 4K quality`;
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
