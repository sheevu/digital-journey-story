
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect } from 'react';
import { MapPin, Navigation, Loader2, Plane, TrainFront, Car, Sparkles, ScrollText, Users, Baby, Compass, Sunrise, Heart } from 'lucide-react';
import { RouteDetails, AppState, StoryStyle } from '../types';

declare global {
  interface Window {
    google: any;
  }
}

interface Props {
  onRouteFound: (details: RouteDetails) => void;
  appState: AppState;
  externalError?: string | null;
}

type TravelMode = 'TRAIN' | 'FLIGHT' | 'DRIVING';

const STYLES: { id: StoryStyle; label: string; icon: React.ElementType; desc: string }[] = [
    { id: 'GUIDE', label: 'Yatra Margdarshak', icon: Compass, desc: 'Your personal guide for top attractions and sacred Hindu temples.' },
    { id: 'CHILDREN', label: 'Bachpan ki Kahaniyan', icon: Sparkles, desc: 'Engaging and moral-rich tales for the curious little travelers.' },
    { id: 'HISTORICAL', label: 'Aitihasik Gatha', icon: ScrollText, desc: 'Grand epics of Indian heritage and the kings of yore.' },
    { id: 'MYTHOLOGY', label: 'Pauranik Katha', icon: Sunrise, desc: 'Divine chronicles of Dev-Lok and our ancient spiritual roots.' },
];

const VOICES = [
    { id: 'Kore', label: 'Aarav (Gentle)', desc: 'Warm & Wise' },
    { id: 'Puck', label: 'Ishani (Bright)', desc: 'Sweet & Joyful' },
    { id: 'Charon', label: 'Arjun (Deep)', desc: 'Strong & Bold' },
    { id: 'Zephyr', label: 'Kavya (Soft)', desc: 'Poetic & Calm' },
    { id: 'Fenrir', label: 'Vikram (Bold)', desc: 'Powerful & Authoritative' },
];

const RoutePlanner: React.FC<Props> = ({ onRouteFound, appState, externalError }) => {
  const [startAddress, setStartAddress] = useState('');
  const [endAddress, setEndAddress] = useState('');
  const [travelMode, setTravelMode] = useState<TravelMode>('TRAIN');
  const [selectedStyle, setSelectedStyle] = useState<StoryStyle>('GUIDE');
  const [selectedVoice, setSelectedVoice] = useState<string>('Kore');
  const [withFamily, setWithFamily] = useState(true);
  const [kidsCount, setKidsCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const startInputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (externalError) setError(externalError);
  }, [externalError]);

  useEffect(() => {
    let isMounted = true;
    const initAutocomplete = async () => {
        if (!window.google?.maps?.places) return;
        try {
             const setupAutocomplete = (inputElement: HTMLInputElement | null, setAddress: (addr: string) => void) => {
                 if (!inputElement) return;
                 const autocomplete = new window.google.maps.places.Autocomplete(inputElement, {
                     fields: ['formatted_address', 'geometry', 'name'],
                     types: ['geocode', 'establishment']
                 });
                 autocomplete.addListener('place_changed', () => {
                     if (!isMounted) return;
                     const place = autocomplete.getPlace();
                     if (!place.geometry || !place.geometry.location) return;
                     const address = place.formatted_address || place.name;
                     setAddress(address);
                     inputElement.value = address;
                 });
             };
             setupAutocomplete(startInputRef.current, setStartAddress);
             setupAutocomplete(endInputRef.current, setEndAddress);
        } catch (e) {
            if (isMounted) setError("Location search failed.");
        }
    };

    if (window.google?.maps?.places) {
        initAutocomplete();
    } else {
        const interval = setInterval(() => {
            if (window.google?.maps?.places) {
                clearInterval(interval);
                initAutocomplete();
            }
        }, 300);
        return () => { isMounted = false; clearInterval(interval); };
    }
    return () => { isMounted = false; };
  }, []);

  const handleCalculate = () => {
    const finalStart = startInputRef.current?.value || startAddress;
    const finalEnd = endInputRef.current?.value || endAddress;

    if (!finalStart || !finalEnd) {
      setError("Please select both locations.");
      return;
    }

    setError(null);
    setIsLoading(true);

    const directionsService = new window.google.maps.DirectionsService();
    const googleMode = travelMode === 'TRAIN' ? window.google.maps.TravelMode.TRANSIT : window.google.maps.TravelMode.DRIVING;

    directionsService.route(
      {
        origin: finalStart,
        destination: finalEnd,
        travelMode: googleMode,
      },
      (result: any, status: any) => {
        setIsLoading(false);
        if (status === window.google.maps.DirectionsStatus.OK) {
          const leg = result.routes[0].legs[0];
          onRouteFound({
            startAddress: leg.start_address,
            endAddress: leg.end_address,
            distance: leg.distance.text,
            duration: leg.duration.text,
            durationSeconds: leg.duration.value,
            travelMode: travelMode,
            voiceName: selectedVoice,
            storyStyle: selectedStyle,
            withFamily,
            kidsCount
          });
        } else {
          setError("Route not found. Try again.");
        }
      }
    );
  };

  const isLocked = appState > AppState.ROUTE_CONFIRMED;

  const currentStyleData = STYLES.find(s => s.id === selectedStyle);
  const StyleIcon = currentStyleData?.icon;

  return (
    <div className={`transition-all duration-700 max-w-2xl mx-auto ${isLocked ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
      <div className="space-y-6 bg-white/95 backdrop-blur-2xl p-6 md:p-12 rounded-[3rem] shadow-[0_20px_50px_rgba(255,165,0,0.1)] border border-orange-100 relative group animate-scale-in">
        
        {/* Sudarshan AI Labs Branding */}
        <div className="absolute top-8 right-10 flex flex-col items-end pointer-events-none">
            <span className="text-[10px] font-black text-orange-600 uppercase tracking-[0.4em] drop-shadow-sm">Sudarshan AI Labs</span>
            <div className="w-12 h-0.5 bg-orange-500 rounded-full mt-1.5 opacity-50"></div>
        </div>

        <div className="space-y-1">
            <h2 className="text-2xl md:text-3xl font-serif text-stone-900 tracking-tight">Plan Your Journey</h2>
            <p className="text-stone-400 text-sm">Customize your spiritual road map.</p>
        </div>

        <div className="space-y-4">
          <div className="relative group/input h-14 bg-white border border-stone-200 rounded-2xl transition-all shadow-sm focus-within:shadow-md focus-within:border-orange-400">
            <input
                ref={startInputRef}
                type="text"
                placeholder="Starting Point"
                className="w-full h-full bg-transparent px-6 text-stone-900 outline-none font-medium text-sm md:text-base placeholder:text-stone-300"
                disabled={isLocked}
            />
          </div>

          <div className="relative group/input h-14 bg-white border border-stone-200 rounded-2xl transition-all shadow-sm focus-within:shadow-md focus-within:border-orange-400">
            <input
                ref={endInputRef}
                type="text"
                placeholder="Destination"
                className="w-full h-full bg-transparent px-6 text-stone-900 outline-none font-medium text-sm md:text-base placeholder:text-stone-300"
                disabled={isLocked}
            />
          </div>
        </div>

        <div className="space-y-4 pt-2">
            <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 space-y-3">
                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                        <Users size={12} className="text-orange-500" /> Going with Family?
                    </label>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setWithFamily(true)}
                            className={`flex-1 py-3 rounded-xl border font-bold text-xs transition-all ${withFamily ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-stone-400 border-stone-100 hover:border-orange-200'}`}
                        >
                            Yes
                        </button>
                        <button 
                            onClick={() => setWithFamily(false)}
                            className={`flex-1 py-3 rounded-xl border font-bold text-xs transition-all ${!withFamily ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-stone-400 border-stone-100 hover:border-orange-200'}`}
                        >
                            No
                        </button>
                    </div>
                </div>
                {withFamily && (
                    <div className="flex-1 space-y-3">
                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                            <Baby size={12} className="text-orange-500" /> No. of Kids?
                        </label>
                        <div className="flex items-center gap-3 bg-stone-50 p-1.5 rounded-xl border border-stone-100">
                            <button onClick={() => setKidsCount(Math.max(0, kidsCount - 1))} className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center font-bold">-</button>
                            <span className="flex-1 text-center font-bold text-sm">{kidsCount}</span>
                            <button onClick={() => setKidsCount(kidsCount + 1)} className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center font-bold">+</button>
                        </div>
                    </div>
                )}
            </div>
        </div>

        <div className="space-y-3">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Travel Mode</label>
            <div className="flex gap-3 h-20">
                {(['DRIVING', 'TRAIN', 'FLIGHT'] as TravelMode[]).map((mode) => (
                    <button
                        key={mode}
                        onClick={() => setTravelMode(mode)}
                        disabled={isLocked}
                        className={`flex-1 flex flex-col items-center justify-center gap-1.5 rounded-2xl border transition-all ${
                            travelMode === mode 
                                ? 'bg-white text-orange-600 border-orange-100 shadow-[0_10px_25px_-5px_rgba(255,165,0,0.2)] scale-105 z-10' 
                                : 'bg-stone-50/50 text-stone-400 border-transparent hover:bg-stone-100'
                        }`}
                    >
                        {mode === 'DRIVING' && <Car size={20} />}
                        {mode === 'TRAIN' && <TrainFront size={20} />}
                        {mode === 'FLIGHT' && <Plane size={20} />}
                        <span className="text-[10px] font-bold uppercase tracking-wider">{mode === 'DRIVING' ? 'Driving' : mode.charAt(0) + mode.slice(1).toLowerCase()}</span>
                    </button>
                ))}
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Swar (Indian Voice)</label>
                <div className="relative">
                    <select
                        value={selectedVoice}
                        onChange={(e) => setSelectedVoice(e.target.value)}
                        disabled={isLocked}
                        className="w-full h-12 bg-white border border-stone-200 rounded-2xl px-4 text-stone-800 font-bold outline-none focus:border-orange-400 transition-all appearance-none text-sm cursor-pointer shadow-sm"
                    >
                        {VOICES.map((v) => (
                            <option key={v.id} value={v.id}>{v.label}</option>
                        ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400">▼</div>
                </div>
            </div>

            <div className="space-y-3">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Story Style</label>
                <div className="relative">
                    <select
                        value={selectedStyle}
                        onChange={(e) => setSelectedStyle(e.target.value as StoryStyle)}
                        disabled={isLocked}
                        className="w-full h-12 bg-white border border-stone-200 rounded-2xl px-4 text-stone-800 font-bold outline-none focus:border-orange-400 transition-all appearance-none text-sm cursor-pointer shadow-sm"
                    >
                        {STYLES.map((s) => (
                            <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400">▼</div>
                </div>
            </div>
        </div>

        <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100/50 flex items-start gap-4">
            <div className="bg-orange-100 p-2 rounded-lg text-orange-600">
                {StyleIcon && <StyleIcon size={18} />}
            </div>
            <p className="text-[11px] leading-relaxed text-stone-600 font-medium">
                {currentStyleData?.desc}
            </p>
        </div>

        {error && <p className="text-red-500 text-xs font-bold bg-red-50 p-3 rounded-xl border border-red-100 animate-shake">{error}</p>}

        <button
          onClick={handleCalculate}
          disabled={isLoading || isLocked || !startAddress || !endAddress}
          className="w-full h-16 bg-orange-600 text-white rounded-full font-black text-base hover:bg-orange-700 transition-all shadow-[0_15px_30px_rgba(234,88,12,0.3)] flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 group/btn"
        >
          {isLoading ? <Loader2 className="animate-spin" size={20} /> : (
              <>
                Dharmik Yatra Shuru Karein
                <Sparkles size={18} className="transition-transform group-hover/btn:rotate-12" />
              </>
          )}
        </button>
      </div>

      {/* Decorative Interactive Element */}
      <div className="mt-12 flex justify-center opacity-30 pointer-events-none">
          <div className="w-24 h-24 relative animate-[spin_20s_linear_infinite]">
              {[...Array(8)].map((_, i) => (
                  <div key={i} className="absolute inset-0 border border-orange-300 rounded-[30%] opacity-40" style={{ transform: `rotate(${i * 45}deg)` }} />
              ))}
              <div className="absolute inset-4 border-2 border-orange-400 rounded-full opacity-60"></div>
          </div>
      </div>
    </div>
  );
};

export default RoutePlanner;
