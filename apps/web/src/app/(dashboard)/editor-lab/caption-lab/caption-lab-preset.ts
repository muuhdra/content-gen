export type CaptionPosition = 'top' | 'center' | 'bottom' | 'custom';
export type AnimationStyle = 'none' | 'pop' | 'slide' | 'reveal' | 'bounce';
export type TypographyStyle = 'bold' | 'inter' | 'serif' | 'mono' | 'condensed' | 'typewriter';
export type ColorStyle = 'red' | 'yellow' | 'green' | 'blue' | 'purple';
export type StrokeColor = 'black' | 'white' | 'purple';
export type WatermarkPosition = 'top-left' | 'top-right' | 'bottom-right';

export type CaptionLabPreset = {
  captionPosition: CaptionPosition;
  animationStyle: AnimationStyle;
  animationIntensity: number;
  wordByWord: boolean;
  wordHighlight: boolean;
  typography: TypographyStyle;
  textSize: number;
  letterSpacing: number;
  colorStyle: ColorStyle;
  strokeEnabled: boolean;
  strokeWidth: number;
  strokeOpacity: number;
  strokeColor: StrokeColor;
  watermarkEnabled: boolean;
  watermarkText: string;
  watermarkOpacity: number;
  watermarkPosition: WatermarkPosition;
};

export const defaultCaptionLabPreset: CaptionLabPreset = {
  captionPosition: 'center',
  animationStyle: 'pop',
  animationIntensity: 62,
  wordByWord: true,
  wordHighlight: true,
  typography: 'bold',
  textSize: 52,
  letterSpacing: 1.5,
  colorStyle: 'purple',
  strokeEnabled: false,
  strokeWidth: 0,
  strokeOpacity: 0,
  strokeColor: 'black',
  watermarkEnabled: false,
  watermarkText: '',
  watermarkOpacity: 0,
  watermarkPosition: 'top-right',
};
