import { NativeModule, requireNativeModule } from 'expo';

export interface DocumentScannerOptions {
  mode?: 'base' | 'filter' | 'full';
  galleryImportAllowed?: boolean;
  maxNumDocuments?: number;
}

export interface DocumentScannerResult {
  status: 'success' | 'cancel';
  scannedImages: string[];
}

declare class ExpoBlurDetectorModule extends NativeModule {
  getBlurScore(imageUri: string): Promise<number>;
  sharpenImage?(imageUri: string): Promise<string>;
  scanDocument?(options?: DocumentScannerOptions): Promise<DocumentScannerResult>;
}

export default requireNativeModule<ExpoBlurDetectorModule>('ExpoBlurDetector');

