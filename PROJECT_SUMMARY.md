# 📱 GovForm AI - Project Summary & Architecture Documentation

## 📌 Executive Summary

**GovForm AI** is a React Native mobile application built with **Expo SDK** and **Expo Router**. The app allows users to capture photos of government forms, process them via a local Python backend (running Tesseract OCR and Ollama LLM), and interactively tap recognized text using a **Google Lens-style bounding box overlay**.

---

## 🏗️ 1. Project Structure & Core Architecture

```text
Capstone_AI_APP/
├── src/
│   ├── app/
│   │   ├── _layout.tsx           # Root Stack Navigator (Splash -> Welcome -> Language -> Tabs)
│   │   ├── index.tsx             # Welcome / Splash screen with language persistence check
│   │   ├── language.tsx          # Initial Language Selection screen
│   │   ├── camera.tsx            # Live Google Lens Camera OCR screen
│   │   └── (tabs)/
│   │       ├── _layout.tsx       # Bottom Tab Navigator
│   │       ├── index.tsx         # Home Dashboard (Camera/Upload, Processing & Document Preview)
│   │       ├── forms.tsx         # Saved Forms placeholder
│   │       └── settings.tsx      # App Settings & Language Selector
│   ├── components/
│   │   └── animated-icon.tsx     # Animated splash overlay component
│   └── context/
│       └── LocalizationContext.tsx # Multi-language support context (English, Tagalog, Cebuano)
```

---

## 🌐 2. Key Features Implemented

### A. Persistent Language Selection & Localization

- **Storage**: Uses `expo-secure-store` to save the selected language locally on the device (`selectedLanguage`).
- **Auto-Bypass**: When launching the app, `index.tsx` checks if a language is saved:
  - **Saved**: Automatically navigates to `/(tabs)` dashboard.
  - **Not Saved**: Navigates to `/language` screen.
- **Settings Screen Integration**: Users can change their language preference anytime inside `src/app/(tabs)/settings.tsx`.
- **Supported Languages**: English, Tagalog, Cebuano.

---

### B. Home Dashboard & Figma UI Specification

- **Scrollable Layout**: Wrapped in `<ScrollView>` inside `SafeAreaView` for smooth scrolling on small screens.
- **Action Buttons**:
  - Exact dimensions: **306px × 173px**
  - Border radius: **35px**
  - Styled with `#2182DE` brand color and Ionicons icons.
- **State Machine Flow**:
  1. **Idle State**: Shows "Take a Picture" and "Choose Existing Photo" buttons.
  2. **Loading State ("Please Wait")**: Triggered after selecting an image. Displays a linear gradient progress bar (`expo-linear-gradient`) simulating OCR processing.
  3. **Document Preview State (Figma Mockup)**: Displays the document inside a dark `#2C2D30` container card with `24px` rounded corners.
- **Dynamic Tab Bar**: The bottom tab bar automatically hides (`tabBarStyle: { display: 'none' }`) during loading and document preview states to match the full-screen mockup.

---

### C. Google Lens-Style Camera OCR (`src/app/camera.tsx`)

- **Live Camera & Media Library**: Users can capture a new photo via `expo-camera` or upload from gallery via `expo-image-picker`.
- **API Integration (`expo-file-system`)**:
  - Replaced standard `fetch`/`Blob` polyfills with `FileSystem.uploadAsync` (using `expo-file-system/legacy` for Expo SDK 57 compatibility) to ensure pristine image transfer without binary corruption.
  - Sends a `MULTIPART` POST request to the local Python API.
- **Dynamic Coordinate Scaling Algorithm**:
  - Measures the layout dimensions (`containerWidth`, `containerHeight`) of the screen.
  - Calculates scaling ratios between original image pixel resolution and device display:

    ```typescript
    const scaleX = containerWidth / originalImageWidth;
    const scaleY = containerHeight / originalImageHeight;

    const boxStyle = {
      left: item.x * scaleX,
      top: item.y * scaleY,
      width: item.width * scaleX,
      height: item.height * scaleY,
    };
    ```

- **Tappable Bounding Boxes**:
  - Tapping a box highlights it in yellow (`#FFCC00`) and displays a detail card with the tapped word and its surrounding sentence context.

---

### D. Python OCR Backend & Blur Detection (`server.py`)

- **Virtual Environment**: Housed natively inside the `Capstone_AI_APP/venv` folder for clean dependencies.
- **OCR Engine**: Uses `pytesseract` (`--psm 11` for sparse text) and `Pillow` to extract raw bounding boxes and words.
- **EXIF Rotation Fix**: Uses `ImageOps.exif_transpose()` to ensure photos taken sideways by mobile phones are corrected before OCR, preserving correct coordinate mapping.
- **Blur Detection Algorithm**:
  - Uses OpenCV (`cv2.Laplacian(image).var()`).
  - Calculates the variance of the Laplacian to measure edge sharpness.
  - If the score is `< 80.0`, the server instantly deletes the image and returns a `400 Bad Request` before wasting CPU cycles on OCR.
- **React Native Blur Handling**: If `index.tsx` receives a `400` status, it clears the state, kicks the user back to the home screen, and alerts them: "The photo is too blurry. Please hold the camera steady and try again."

---

## 🛠️ 3. Troubleshooting & Compatibility Solved

1. **Worklets Babel Plugin Mismatch Fix**:
   - *Problem*: `Mismatch between JavaScript code version and Worklets Babel plugin version`.
   - *Fix*: Replaced `scheduleOnRN` from `react-native-worklets` with standard `runOnJS` from `react-native-reanimated` in `animated-icon.tsx`, and uninstalled `react-native-worklets`.
2. **Expo Go Crash Fix**:
   - *Problem*: Expo Go crashed immediately upon loading over LAN/Tunnel.
   - *Fix*: Removed incompatible experimental packages (`@expo/ui`, `expo-glass-effect`, `expo-symbols`, `expo-dev-client`) from `package.json` that are not pre-compiled into standard Expo Go.

---

## 🚀 4. How to Run the App

1. **Start the Expo Server**:

   ```bash
   npx expo start -c
   ```

2. **Open in Expo Go (Android/iOS)**:
   - Press **`s`** to ensure Expo Go mode is selected.
   - Press **`a`** for Android Emulator, or scan the terminal QR code with the **Expo Go** app on a physical phone.

3. **Local Python API Contract (`http://<LOCAL_IP>:5000/scan`)**:
   Expects `POST` request with `FormData` containing file key `file`.
   Returns JSON array:

   ```json
   [
     {
       "text": "APPLICATION",
       "sentence": "Republic of the Philippines Application Form",
       "x": 270,
       "y": 85,
       "width": 210,
       "height": 30
     }
   ]
   ```

4. **Run the Python Backend**:
   - The backend contains `Flask`, `pytesseract`, `opencv-python`, and `numpy`.
   - Run from the provided virtual environment:
   ```bash
   .\venv\Scripts\python.exe server.py
   ```

5. **Exposing the Server for Presentations (Three Options)**
   - **Option 1 (Best & Fastest - Mobile Hotspot)**: Connect phone to laptop's Mobile Hotspot. Update `PYTHON_API_URL` to `http://192.168.137.1:5000/scan`. No internet required.
   - **Option 2 (Public Tunnel)**: Run `npx localtunnel --port 5000` (or Ngrok) and copy the public URL into the app.
   - **Option 3 (Home Wi-Fi)**: Use your laptop's local IPv4 address (e.g., `192.168.1.41`).

6. **Compile to APK (Production Build)**
   Use Expo Application Services (EAS) to compile the APK directly on your laptop or in the cloud:
   ```bash
   npm install -g eas-cli
   eas login
   eas build -p android --profile preview --local
   ```
   *Note: Using `--local` skips the Expo free-tier queue and compiles the APK instantly on your PC.*
