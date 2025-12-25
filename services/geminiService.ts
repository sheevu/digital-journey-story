
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, Modality, Type } from "@google/genai";
import { RouteDetails, StorySegment, StoryStyle } from "../types";
import { decode, decodeAudioData } from "./audioUtils";

const TARGET_SEGMENT_DURATION_SEC = 20; 
const WORDS_PER_MINUTE = 110; 
const WORDS_PER_SEGMENT = Math.round((TARGET_SEGMENT_DURATION_SEC / 60) * WORDS_PER_MINUTE);

export const calculateTotalSegments = (durationSeconds: number): number => {
    const calculated = Math.max(2, Math.ceil(durationSeconds / 60));
    return Math.min(calculated, 4); 
};

const getStyleInstruction = (style: StoryStyle, route: RouteDetails): string => {
    const familyContext = route.withFamily ? `This journey is with family and ${route.kidsCount} children. Make the content safe, engaging for all ages, and warm.` : "This is a solo/professional journey.";
    
    switch (style) {
        case 'GUIDE':
            return `Style: Tourist Guide (Sanskriti Guide). Briefly explain top attractions and famous Hindu Temples. Keep it crisp, factual but cheerful. ${familyContext}`;
        case 'CHILDREN':
            return `Style: Bal Kahani (Children's Story). Focus on magical aspects of the route, simplified Hindi, and joyful mythological references. ${familyContext}`;
        case 'HISTORICAL':
            return `Style: Virasat Gatha (Historical). Focus on grand legends of Indian kings and architectural marvels of temples. ${familyContext}`;
        case 'MYTHOLOGY':
            return `Style: Dev Lok Chronicles (Mythological). Connect the landscape to ancient Vedic stories and divine interventions. ${familyContext}`;
        default:
            return `Style: Cheerful and spiritual. ${familyContext}`;
    }
};

export const generateStoryOutline = async (
    route: RouteDetails,
    totalSegments: number
): Promise<string[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const styleInstruction = getStyleInstruction(route.storyStyle, route);
    
    const prompt = `
    आप Sudarshan AI Labs के एक विशेषज्ञ कहानीकार हैं। आपको हिंदी (Hindi) में एक बहुत ही संक्षिप्त और उत्साही यात्रा कहानी का खाका तैयार करना है।
    कुल अध्याय: ${totalSegments}
    मार्ग: ${route.startAddress} से ${route.endAddress} तक।
    ${styleInstruction}

    नियम:
    1. कहानी "Short and Crisp" होनी चाहिए।
    2. मार्ग में स्थित प्रसिद्ध "Hindu Temples" और धार्मिक स्थलों को प्राथमिकता दें।
    3. परिवार के बच्चों (${route.kidsCount}) के लिए कहानी को रोचक बनाएं।
    4. आउटपुट केवल एक JSON array of strings होना चाहिए।
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { 
                responseMimeType: 'application/json',
                tools: [{ googleMaps: {} }]
            }
        });
        const text = response.text?.trim();
        return JSON.parse(text || "[]").slice(0, totalSegments);
    } catch (error) {
        return Array(totalSegments).fill("एक पावन यात्रा की शुरुआत।");
    }
};

export const getFamousLandmarks = async (destination: string): Promise<string[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Identify exactly 3 to 4 most iconic Hindu Temples and stunning landmarks in ${destination}. Return as a JSON array of strings in English.`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                tools: [{ googleMaps: {} }],
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            }
        });
        const landmarks = JSON.parse(response.text || "[]");
        return landmarks.slice(0, 4); 
    } catch (e) {
        return ["Holy Temple", "Historical Gate", "Sacred River"];
    }
};

export const generateLandmarkImage = async (landmark: string, destination: string): Promise<string | null> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `A highly realistic 3D architectural illustration of ${landmark} in ${destination}. Cinematic sunrise lighting, spiritual atmosphere, incredibly detailed 3D rendering for Sudarshan AI Labs travel app.`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: { parts: [{ text: prompt }] },
            config: { imageConfig: { aspectRatio: "16:9", imageSize: "1K" } }
        });
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
        }
        return null;
    } catch (e) {
        return null;
    }
};

export const generateSegment = async (
    route: RouteDetails,
    segmentIndex: number,
    totalSegmentsEstimate: number,
    segmentOutline: string,
    previousContext: string = ""
): Promise<StorySegment> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const styleInstruction = getStyleInstruction(route.storyStyle, route);

  const prompt = `
    आप Sudarshan AI Labs के एक इमर्सिव हिंदी ऑडियो स्टोरीटेलर हैं।
    अध्याय: ${segmentIndex} / ${totalSegmentsEstimate}
    मार्ग: ${route.startAddress} से ${route.endAddress} (${route.travelMode})
    ${styleInstruction}

    निर्देश:
    1. अत्यंत मधुर और सुखद (Happy/Cheerful) हिंदी का प्रयोग करें।
    2. हिन्दू मंदिरों और उनके धार्मिक महत्व को उजागर करें।
    3. संक्षिप्त रहें (Short & Crisp)।
    4. यदि यात्रा परिवार के साथ है, तो बच्चों को संबोधित करें।
    
    सिर्फ कहानी का टेक्स्ट लिखें।
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
          tools: [{ googleMaps: {} }]
      }
    });
    return {
      index: segmentIndex,
      text: response.text?.trim() || "एक सुखद अनुभव आपका इंतजार कर रहा है।",
      audioBuffer: null 
    };
  } catch (error) {
    throw error;
  }
};

export const generateSegmentAudio = async (text: string, audioContext: AudioContext, voiceName: string): Promise<AudioBuffer> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text: `Read this with a very happy, clear, and spiritual tone in Hindi for a premium family app: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } }
        }
      }
    });

    const part = response.candidates?.[0]?.content?.parts?.[0];
    const audioData = part?.inlineData?.data;
    if (!audioData) throw new Error("No audio data.");

    return await decodeAudioData(decode(audioData), audioContext, 24000, 1);
  } catch (error) {
    throw error;
  }
};
