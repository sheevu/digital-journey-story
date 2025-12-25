
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Footprints, Car, Loader2, ArrowDownCircle, Cpu, MapPin, Sparkles, Layers, Activity, Sunrise } from 'lucide-react';
import { AudioStory, RouteDetails, StorySegment } from '../types';
import InlineMap from './InlineMap';

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

interface Props {
  story: AudioStory;
  route: RouteDetails;
  onSegmentChange: (index: number) => void;
  onSmoothProgressUpdate: (progress: number) => void;
  isBackgroundGenerating: boolean;
  smoothProgress: number;
}

const StoryPlayer: React.FC<Props> = ({ story, route, onSegmentChange, onSmoothProgressUpdate, isBackgroundGenerating, smoothProgress }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0); 
  const segmentOffsetRef = useRef<number>(0); 
  const rafRef = useRef<number>(null);
  
  const indexRef = useRef(currentSegmentIndex);
  const textContainerRef = useRef<HTMLDivElement>(null);

  const currentSegment = story.segments[currentSegmentIndex];
  const progressPercent = Math.min(100, (currentSegmentIndex / story.totalSegmentsEstimate) * 100);
  const bufferPercent = Math.min(100, (story.segments.length / story.totalSegmentsEstimate) * 100);

  useEffect(() => {
    const updateProgress = () => {
      if (isPlaying && !isBuffering && audioContextRef.current && currentSegment?.audioBuffer) {
        const elapsed = audioContextRef.current.currentTime - startTimeRef.current;
        const duration = currentSegment.audioBuffer.duration;
        const segmentProgress = Math.min(1, elapsed / duration);
        const totalProgress = (currentSegmentIndex + segmentProgress) / story.totalSegmentsEstimate;
        onSmoothProgressUpdate(totalProgress);
      }
      rafRef.current = requestAnimationFrame(updateProgress);
    };

    rafRef.current = requestAnimationFrame(updateProgress);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPlaying, isBuffering, currentSegmentIndex, story.totalSegmentsEstimate, currentSegment, onSmoothProgressUpdate]);

  useEffect(() => { indexRef.current = currentSegmentIndex; }, [currentSegmentIndex]);

  useEffect(() => {
    return () => {
      stopAudio();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  useEffect(() => { onSegmentChange(currentSegmentIndex); }, [currentSegmentIndex, onSegmentChange]);

  useEffect(() => {
      const segmentNowReady = story.segments[currentSegmentIndex];
      if (isBuffering && isPlaying && segmentNowReady?.audioBuffer) {
          setIsBuffering(false);
          playSegment(segmentNowReady, 0);
      }
  }, [story.segments, currentSegmentIndex, isBuffering, isPlaying]);

  useEffect(() => {
      if (autoScroll && textContainerRef.current) {
          const lastParagraph = textContainerRef.current.lastElementChild;
          lastParagraph?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
  }, [story.segments.length, currentSegmentIndex, autoScroll]);

  const stopAudio = () => {
      if (sourceRef.current) {
          sourceRef.current.onended = null;
          try { sourceRef.current.stop(); } catch (e) {}
          sourceRef.current = null;
      }
  };

  const playSegment = async (segment: StorySegment, offset: number = 0) => {
      if (!segment?.audioBuffer) {
           setIsBuffering(true);
           return;
      }

      if (!audioContextRef.current) {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          audioContextRef.current = new AudioContextClass();
      }
      if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
      }

      stopAudio();

      const source = audioContextRef.current.createBufferSource();
      source.buffer = segment.audioBuffer;
      source.connect(audioContextRef.current.destination);
      sourceRef.current = source;

      source.onended = () => {
          const duration = segment.audioBuffer!.duration;
          if (!audioContextRef.current) return;
          const elapsed = audioContextRef.current.currentTime - startTimeRef.current;
          if (elapsed >= duration - 0.5) { 
              handleSegmentEnd();
          }
      };

      startTimeRef.current = audioContextRef.current.currentTime - offset;
      source.start(0, offset);
  };

  const handleSegmentEnd = () => {
      const currentIndex = indexRef.current;
      const nextIndex = currentIndex + 1;
      if (nextIndex < story.totalSegmentsEstimate || story.segments[nextIndex]) {
          setCurrentSegmentIndex(nextIndex);
          segmentOffsetRef.current = 0;
          if (story.segments[nextIndex]?.audioBuffer) {
              playSegment(story.segments[nextIndex], 0);
          } else {
              setIsBuffering(true);
          }
      } else {
          setIsPlaying(false);
      }
  };

  const togglePlayback = async () => {
    if (isPlaying) {
      if (audioContextRef.current && !isBuffering) {
          segmentOffsetRef.current = audioContextRef.current.currentTime - startTimeRef.current;
      }
      stopAudio();
      setIsPlaying(false);
      setAutoScroll(false);
    } else {
      setIsPlaying(true);
      if (currentSegment?.audioBuffer) {
         setIsBuffering(false);
         playSegment(currentSegment, segmentOffsetRef.current);
         setAutoScroll(true);
      } else {
          setIsBuffering(true);
      }
    }
  };

  const ModeIcon = route.travelMode === 'DRIVING' ? Car : Footprints;

  return (
    <div className="w-full max-w-5xl mx-auto animate-fade-in pb-24 px-4 md:px-0">
      
      <div className="w-full aspect-[4/3] md:aspect-video bg-stone-100 rounded-[2rem] md:rounded-[3rem] shadow-2xl overflow-hidden relative mb-8 md:mb-12 border-2 md:border-4 border-white group">
           <InlineMap 
              route={route} 
              smoothProgress={smoothProgress} 
              totalSegments={story.totalSegmentsEstimate}
           />
           
           <div className="absolute bottom-4 left-4 right-4 md:bottom-6 md:left-6 md:right-auto bg-white/95 backdrop-blur-lg p-4 md:p-6 rounded-[1.5rem] md:rounded-[2.5rem] shadow-2xl border border-white/50 flex items-center gap-4 md:gap-6 z-10 max-w-[calc(100%-2rem)]">
                <div className="bg-editorial-900 text-white p-3 md:p-5 rounded-full shrink-0 shadow-xl">
                    <ModeIcon size={20} className="md:w-7 md:h-7" />
                </div>
                <div className="min-w-0">
                    <div className="text-[8px] md:text-[10px] text-stone-400 font-bold uppercase tracking-[0.2em] mb-0.5 md:mb-1">Destination</div>
                    <div className="text-editorial-900 font-serif text-lg md:text-2xl leading-tight truncate">{route.endAddress}</div>
                </div>
            </div>

            {isBuffering && (
                <div className="absolute inset-0 bg-editorial-900/60 backdrop-blur-md z-30 flex items-center justify-center transition-all duration-500">
                    <div className="bg-white/90 backdrop-blur p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] shadow-2xl flex flex-col items-center gap-4 md:gap-6 animate-scale-in border border-white mx-6">
                        <div className="relative">
                            <Activity size={32} className="text-editorial-900 animate-pulse md:w-12 md:h-12" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Loader2 size={48} className="animate-spin text-editorial-900/10 md:w-16 md:h-16" />
                            </div>
                        </div>
                        <div className="text-center space-y-1">
                            <p className="text-editorial-900 font-serif text-lg md:text-xl italic">Preparing Chapter...</p>
                            <div className="flex items-center gap-2 justify-center text-stone-400 text-[8px] md:text-[9px] font-bold uppercase tracking-widest">
                                <Sparkles size={10} className="text-editorial-900" />
                                <span>Segments: {story.segments.length} / {story.totalSegmentsEstimate}</span>
                            </div>
                        </div>
                        <div className="w-48 md:w-64 h-2 bg-stone-100 rounded-full overflow-hidden relative">
                            <div 
                                className="h-full bg-editorial-900 transition-all duration-1000 ease-out" 
                                style={{ width: `${(story.segments.length / story.totalSegmentsEstimate) * 100}%` }} 
                            />
                        </div>
                    </div>
                </div>
            )}
      </div>

      {/* Realistic Landmark Highlights - High Resolution 3D Illustrations */}
      {story.landmarkImages.length > 0 && (
          <div className="mb-16 md:mb-24 animate-fade-in px-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                  <div className="space-y-1">
                      <h3 className="text-stone-900 font-serif text-2xl md:text-3xl italic">Expedition Highlights</h3>
                      <p className="text-orange-500 text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2">
                          <Sunrise size={12} /> Spiritual Landmarks En Route
                      </p>
                  </div>
                  <div className="hidden md:block h-px flex-1 bg-stone-200 mx-8"></div>
                  <div className="flex items-center gap-2 text-stone-400 text-[10px] font-bold uppercase tracking-widest bg-stone-50 px-4 py-2 rounded-full border border-stone-100">
                      <Sparkles size={14} className="text-orange-400" />
                      Sudarshan 3D Imagery
                  </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
                  {story.landmarkImages.map((img, i) => (
                      <div 
                        key={i} 
                        className="group relative aspect-[4/5] rounded-[2rem] overflow-hidden bg-stone-100 shadow-xl border-4 border-white transition-all hover:scale-[1.02] md:hover:scale-[1.04] hover:shadow-2xl animate-scale-in"
                        style={{ animationDelay: `${i * 150}ms` }}
                      >
                          {/* AI Generation Badge */}
                          <div className="absolute top-4 right-4 z-20 bg-white/10 backdrop-blur-md border border-white/20 px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-[8px] font-black text-white uppercase tracking-tighter">AI 3D RENDER</span>
                          </div>

                          <img 
                            src={img} 
                            alt={`Spiritual Landmark Highlight ${i + 1}`} 
                            className="w-full h-full object-cover transition-transform duration-[4s] ease-out group-hover:scale-110" 
                          />
                          
                          {/* Overlay with glass effect */}
                          <div className="absolute inset-0 bg-gradient-to-t from-stone-900/90 via-stone-900/20 to-transparent opacity-60 group-hover:opacity-100 transition-opacity"></div>
                          
                          <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-8">
                              <div className="space-y-2 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                                  <div className="flex items-center gap-2">
                                      <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></div>
                                      <span className="text-[9px] font-black text-orange-200 uppercase tracking-[0.2em]">Sanctum {i + 1}</span>
                                  </div>
                                  <p className="font-serif text-white text-xl md:text-2xl leading-tight">
                                    {i === 0 ? 'Sacred Entrance' : i === 1 ? 'Temple Spire' : i === 2 ? 'Inner Sanctum' : 'Eternal Gate'}
                                  </p>
                                  <div className="flex items-center gap-1.5 pt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-700 delay-100">
                                      <MapPin size={10} className="text-orange-400" />
                                      <span className="text-[10px] text-stone-300 font-medium">Digital Twin Architecture</span>
                                  </div>
                              </div>
                          </div>
                          
                          {/* Interaction Ring */}
                          <div className="absolute inset-0 border-[6px] border-orange-400/0 group-hover:border-orange-400/10 transition-all duration-700 pointer-events-none rounded-[2rem]"></div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* Optimized Control Panel for Mobile */}
      <div className="sticky top-4 md:top-6 z-40 bg-editorial-900 text-white rounded-[2rem] md:rounded-[3rem] p-4 md:p-6 shadow-2xl mb-12 md:mb-16 flex flex-col gap-4 md:gap-6 ring-4 md:ring-8 ring-editorial-100/50">
         <div className="flex items-center justify-between px-2 md:px-4">
            <div className="flex items-center gap-3 md:gap-6">
                <button
                    onClick={togglePlayback}
                    className="bg-white text-editorial-900 p-3.5 md:p-5 rounded-full hover:scale-105 active:scale-90 transition-all shadow-xl"
                >
                    {isPlaying && !isBuffering ? <Pause size={24} className="fill-current md:w-8 md:h-8" /> : <Play size={24} className="fill-current ml-1 md:w-8 md:h-8 md:ml-1.5" />}
                </button>
                <div>
                    <div className="text-[7px] md:text-[10px] text-stone-500 font-bold uppercase tracking-[0.2em] md:tracking-[0.3em] mb-0.5 md:mb-1">
                        {isPlaying ? 'Live Session' : 'Standby'}
                    </div>
                    <div className="font-serif italic text-base md:text-xl">Chapter {currentSegmentIndex + 1} / {story.totalSegmentsEstimate}</div>
                </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
                {isBackgroundGenerating && <Sparkles size={16} className="text-stone-500 animate-pulse md:w-5 md:h-5" />}
                <button onClick={() => setAutoScroll(!autoScroll)} className={`p-2.5 md:p-3 rounded-full transition-all ${autoScroll ? 'text-white bg-white/10' : 'text-stone-700 hover:text-white'}`}>
                    <ArrowDownCircle size={18} className="md:w-6 md:h-6" />
                </button>
            </div>
         </div>

         <div className="px-2 md:px-4">
            <div className="relative h-1 md:h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div className="absolute top-0 left-0 h-full bg-white/20 transition-all duration-1000" style={{ width: `${bufferPercent}%` }} />
                <div className="absolute top-0 left-0 h-full bg-white transition-all duration-500" style={{ width: `${progressPercent}%` }} />
            </div>
         </div>
      </div>

      <div ref={textContainerRef} className="max-w-3xl mx-auto space-y-12 md:space-y-24 pb-32 px-2 md:px-0">
          {story.segments.map((segment) => (
              <div 
                key={segment.index} 
                className={`transition-all duration-1000 ease-in-out ${segment.index === currentSegmentIndex + 1 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-10 blur-[1px] translate-y-10 scale-95'}`}
              >
                  <p className="text-2xl md:text-5xl font-serif leading-[1.6] text-editorial-900">
                    {segment.text}
                  </p>
              </div>
          ))}
      </div>
    </div>
  );
};

export default StoryPlayer;
