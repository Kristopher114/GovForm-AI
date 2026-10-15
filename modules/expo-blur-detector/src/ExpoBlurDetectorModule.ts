import { NativeModule, requireNativeModule } from 'expo';

declare class ExpoBlurDetectorModule extends NativeModule {
  getBlurScore(imageUri: string): Promise<number>;
  sharpenImage?(imageUri: string): Promise<string>;
}

export default requireNativeModule<ExpoBlurDetectorModule>('ExpoBlurDetector');
