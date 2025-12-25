
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export type StoryStyle = 'GUIDE' | 'CHILDREN' | 'HISTORICAL' | 'MYTHOLOGY';

export interface RouteDetails {
  startAddress: string;
  endAddress: string;
  distance: string;
  duration: string;
  durationSeconds: number;
  travelMode: string; 
  voiceName: string;
  storyStyle: StoryStyle;
  withFamily: boolean;
  kidsCount: number;
}

export interface StorySegment {
    index: number; // 1-based index
    text: string;
    audioBuffer: AudioBuffer | null;
}

export interface AudioStory {
  totalSegmentsEstimate: number;
  outline: string[];
  segments: StorySegment[];
  landmarkImages: string[];
}

export enum AppState {
  PLANNING,
  CALCULATING_ROUTE,
  ROUTE_CONFIRMED,
  GENERATING_INITIAL_SEGMENT,
  READY_TO_PLAY,
  PLAYING
}
