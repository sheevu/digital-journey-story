
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useRef } from 'react';
import { Headphones, Map as MapIcon, Sparkles, ArrowRight, Loader2, AlertTriangle, Key, Sunrise } from 'lucide-react';
import RoutePlanner from './components/RoutePlanner';
import StoryPlayer from './components/StoryPlayer';
import MapBackground from './components/MapBackground';
import InlineMap from './components/InlineMap';
import { AppState, RouteDetails, AudioStory } from './types';
import { 
    generateSegment, 
    generateSegmentAudio, 
    calculateTotalSegments, 
    generateStoryOutline, 
    getFamousLandmarks, 
    generateLandmarkImage 
} from './services/geminiService';

const MAPS_API_KEY = "AIzaSyDUh3L_i48tc_YWD59CYF1nzaPEES1y2EU";

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    webkitAudioContext: typeof AudioContext;
    aistudio?: AIStudio;
  }
}

const withTimeout = <T,>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> => {
    let timer: any;
    const timeoutPromise = new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(errorMsg)), ms);
    });
    return Promise.race([
        promise.then(val => { clearTimeout(timer); return val; }),
        timeoutPromise
    ]);
};

function App() {
  const [appState, setAppState] = useState<AppState>(AppState.PLANNING);
  const [route, setRoute] = useState<RouteDetails | null>(null);
  const [story, setStory] = useState<AudioStory | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isKeyRequired, setIsKeyRequired] = useState(false);

  const isGeneratingRef = useRef<boolean>(false);
  const [isBackgroundGenerating, setIsBackgroundGenerating] = useState(false);
  const [currentPlayingIndex, setCurrentPlayingIndex] = useState<number>(0);
  const [smoothProgress, setSmoothProgress] = useState<number>(0);

  useEffect(() => {
    const checkApiKeyStatus = async () => {
        if (window.aistudio) {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            if (!hasKey) setIsKeyRequired(true);
        }
    };
    checkApiKeyStatus();

    const SCRIPT_ID = 'google-maps-script';
    if (document.getElementById(SCRIPT_ID) || window.google?.maps) return;

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&loading=async&v=weekly&libraries=places,geometry`;
    script.async = true;
    script.defer = true;
    script.onerror = () => setScriptError("Google Maps failed to load.");
    
    // @ts-ignore
    window.gm_authFailure = () => setScriptError("Google Maps authentication failed.");
    document.head.appendChild(script);
  }, []);

  const handleOpenKeySelector = async () => {
      if (window.aistudio) {
          await window.aistudio.openSelectKey();
          setIsKeyRequired(false);
      }
  };

  useEffect(() => {
      if (!story || !route || appState < AppState.READY_TO_PLAY) return;
      const totalGenerated = story.segments.length;
      const neededBufferIndex = currentPlayingIndex + 2; 
      if (totalGenerated < neededBufferIndex && totalGenerated < story.totalSegmentsEstimate && !isGeneratingRef.current) {
          generateNextSegment(totalGenerated + 1);
      }
  }, [story, route, appState, currentPlayingIndex]);

  const generateNextSegment = async (index: number) => {
      if (!route || !story || isGeneratingRef.current) return;
      try {
          isGeneratingRef.current = true;
          setIsBackgroundGenerating(true);
          const allPreviousText = story.segments.map(s => s.text).join(" ").slice(-2000);
          const segmentOutline = story.outline[index - 1] || "Continue the path.";
          const segmentData = await withTimeout(
              generateSegment(route, index, story.totalSegmentsEstimate, segmentOutline, allPreviousText),
              60000, "Text generation timeout"
          );
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          const tempCtx = new AudioContextClass();
          const audioBuffer = await withTimeout(
              generateSegmentAudio(segmentData.text, tempCtx, route.voiceName),
              100000, "Audio generation timeout"
          );
          await tempCtx.close();
          setStory(prev => {
              if (!prev || prev.segments.some(s => s.index === index)) return prev;
              return {
                  ...prev,
                  segments: [...prev.segments, { ...segmentData, audioBuffer }].sort((a, b) => a.index - b.index)
              };
          });
      } catch (e) {
          console.error(`Failed segment ${index}`, e);
      } finally {
          isGeneratingRef.current = false;
          setIsBackgroundGenerating(false);
      }
  };

  const handleGenerateStory = async (details: RouteDetails) => {
    setRoute(details);
    setGenerationError(null);
    try {
      setAppState(AppState.GENERATING_INITIAL_SEGMENT);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const totalSegmentsEstimate = calculateTotalSegments(details.durationSeconds);
      setLoadingMessage("Sudarshan AI Labs: मंदिर खोज रहे हैं...");
      const landmarksPromise = getFamousLandmarks(details.endAddress).then(async (names) => {
          const imagePromises = names.map(name => generateLandmarkImage(name, details.endAddress));
          const results = await Promise.all(imagePromises);
          return results.filter((img): img is string => img !== null);
      });
      setLoadingMessage("पावन कथा तैयार हो रही है...");
      const outline = await withTimeout(generateStoryOutline(details, totalSegmentsEstimate), 60000, "Outline timeout");
      const seg1Data = await withTimeout(generateSegment(details, 1, totalSegmentsEstimate, outline[0], ""), 60000, "Initial text timeout");
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const tempCtx = new AudioContextClass();
      const seg1Audio = await withTimeout(generateSegmentAudio(seg1Data.text, tempCtx, details.voiceName), 100000, "Initial audio timeout");
      await tempCtx.close();
      const landmarkImages = await landmarksPromise;
      setStory({ totalSegmentsEstimate, outline, segments: [{ ...seg1Data, audioBuffer: seg1Audio }], landmarkImages });
      setAppState(AppState.READY_TO_PLAY);
    } catch (error: any) {
      setAppState(AppState.PLANNING);
      let message = "Failed to start story stream.";
      if (error.message?.includes("Requested entity was not found")) {
          setIsKeyRequired(true);
          message = "High-quality visuals require a paid API key.";
      }
      setGenerationError(message);
    }
  };

  const handleReset = () => {
      setAppState(AppState.PLANNING);
      setRoute(null);
      setStory(null);
      setCurrentPlayingIndex(0);
      setSmoothProgress(0);
      setGenerationError(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (isKeyRequired) {
      return (
          <div className="min-h-screen bg-editorial-100 flex items-center justify-center p-6 text-center">
              <div className="bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] shadow-2xl max-w-lg space-y-6 md:space-y-8 border border-editorial-900/10 animate-scale-in">
                  <div className="bg-orange-500/10 w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center mx-auto text-orange-600"><Key size={32} /></div>
                  <div className="space-y-3 md:space-y-4">
                      <h2 className="text-2xl md:text-3xl font-serif text-editorial-900">Paid API Key Required</h2>
                      <p className="text-stone-600 leading-relaxed text-sm md:text-base">Sudarshan AI Labs premium visuals require a billing-enabled API key for 3D temple rendering.</p>
                  </div>
                  <button onClick={handleOpenKeySelector} className="w-full bg-editorial-900 text-white py-4 md:py-5 rounded-full font-bold text-base md:text-lg hover:bg-stone-800 transition-all shadow-xl shadow-editorial-900/20">Select API Key</button>
              </div>
          </div>
      );
  }

  if (scriptError) {
      return (
          <div className="min-h-screen bg-editorial-100 flex items-center justify-center p-6 text-center">
              <div className="bg-white p-6 md:p-10 rounded-[2rem] shadow-xl max-w-md space-y-4 border-2 border-red-100 animate-scale-in">
                  <AlertTriangle size={40} className="text-red-500 mx-auto" />
                  <p className="text-stone-800 font-bold text-lg md:text-xl">{scriptError}</p>
              </div>
          </div>
      )
  }

  const isHeroVisible = appState < AppState.READY_TO_PLAY;

  return (
    <div className="min-h-screen bg-[#FFFDFB] text-editorial-900 relative selection:bg-orange-100 overflow-x-hidden">
      <MapBackground route={route} />
      
      {/* Aesthetic Mandala Background Element */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-orange-200/5 rounded-full blur-[120px] pointer-events-none -translate-y-1/2 translate-x-1/2"></div>
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-orange-400/5 rounded-full blur-[100px] pointer-events-none translate-y-1/2 -translate-x-1/2"></div>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-12 md:pt-16 pb-24 md:pb-32">
        <div className={`transition-all duration-1000 origin-top ease-in-out max-w-4xl mx-auto ${isHeroVisible ? 'opacity-100 translate-y-0 mb-12 md:mb-16' : 'opacity-0 -translate-y-20 h-0 overflow-hidden mb-0'}`}>
            <div className="flex items-center gap-2 mb-6">
                <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center text-white shadow-[0_8px_20px_rgba(234,88,12,0.3)]"><Sunrise size={20} /></div>
                <span className="text-sm font-black uppercase tracking-[0.4em] text-orange-600">Sudarshan AI Labs</span>
            </div>

            <h1 className="text-5xl md:text-8xl font-serif leading-[1] tracking-tight mb-8 text-stone-900">
                Turn your journey into <br className="hidden sm:block"/> <span className="italic text-orange-600">a living story.</span>
            </h1>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 md:gap-8 mt-12 mb-6 bg-white/80 backdrop-blur-md p-5 rounded-[2.5rem] border border-orange-100 w-full sm:w-fit shadow-lg shadow-orange-100/50">
                <div className="flex -space-x-4">
                    {[1,2,3].map(i => (
                        <div key={i} className="w-12 h-12 rounded-full border-4 border-white bg-stone-100 overflow-hidden shadow-xl ring-2 ring-orange-50">
                            <img src={`https://images.unsplash.com/photo-${1500000000000 + i * 100000}?auto=format&fit=crop&w=100&q=80`} alt="Traveler" className="w-full h-full object-cover" />
                        </div>
                    ))}
                    <div className="w-12 h-12 rounded-full border-4 border-white bg-editorial-900 flex items-center justify-center text-white text-[10px] font-black shadow-xl ring-2 ring-orange-50">+10k</div>
                </div>
                <div className="space-y-0.5">
                    <p className="text-[10px] font-black text-orange-500 uppercase tracking-[0.3em]">Curated Experiences</p>
                    <p className="text-sm font-semibold text-stone-800">Trusted by 10,000+ curious travelers globally</p>
                </div>
            </div>

            <p className="text-xl md:text-2xl text-stone-500 max-w-xl leading-relaxed font-light mt-10">
                Enter your route, and we'll generate a cheerful, crisp narrative that focuses on <span className="text-orange-600 font-semibold underline decoration-orange-200 underline-offset-8">sacred Hindu temples</span> and stunning Indian landmarks.
            </p>
        </div>

        <div className={`max-w-4xl mx-auto transition-all duration-700 ${appState > AppState.GENERATING_INITIAL_SEGMENT ? 'hidden' : 'block'}`}>
            <RoutePlanner onRouteFound={handleGenerateStory} appState={appState} externalError={generationError} />
        </div>

        {appState === AppState.GENERATING_INITIAL_SEGMENT && (
            <div className="mt-12 md:mt-16 flex flex-col items-center justify-center space-y-10 animate-fade-in text-center py-24 max-w-4xl mx-auto">
                <div className="relative">
                    <div className="absolute inset-0 bg-orange-200/40 blur-[80px] rounded-full scale-150 animate-pulse"></div>
                    <Loader2 size={64} className="animate-spin text-orange-500 opacity-20 md:w-20 md:h-20" />
                    <Sunrise size={32} className="absolute inset-0 m-auto text-orange-600 md:w-10 md:h-10" />
                </div>
                <div className="space-y-4 px-4">
                    <h3 className="text-3xl md:text-4xl font-serif text-stone-900 italic tracking-tight">{loadingMessage}</h3>
                    <p className="text-orange-500 uppercase tracking-[0.4em] text-[10px] font-black">Powered by Sudarshan AI Labs</p>
                </div>
            </div>
        )}

        {appState >= AppState.READY_TO_PLAY && story && route && (
            <div className="mt-4 md:mt-8 animate-fade-in">
                <StoryPlayer story={story} route={route} onSegmentChange={setCurrentPlayingIndex} onSmoothProgressUpdate={setSmoothProgress} isBackgroundGenerating={isBackgroundGenerating} smoothProgress={smoothProgress} />
                <div className="mt-16 md:mt-24 text-center border-t border-stone-200 pt-10 md:pt-12">
                    <button onClick={handleReset} className="group bg-white hover:bg-orange-50 text-stone-900 px-8 py-4 rounded-full font-bold flex items-center gap-3 mx-auto transition-all border-2 border-stone-100 hover:border-orange-200 shadow-xl text-base">
                        End Journey & Start New <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>
        )}
      </main>
    </div>
  );
}

export default App;
