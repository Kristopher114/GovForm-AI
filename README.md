# 📱 GovForm AI - Project Summary & Architecture Documentation

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start

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

---

## 📅 Changelog & Deployment Updates (August 13, 2026)

Today we successfully transitioned the application from a local testing environment to a production-ready cloud deployment!

### 1. Cloud Backend Deployment (Render)

- Created a `Dockerfile` and `requirements.txt` to install system-level dependencies (`tesseract-ocr`, `libgl1`) and Python packages.
- Deployed the `server.py` Flask backend to a live, public cloud server on **Render.com**.
- The API is now globally accessible at: `https://govform-ai-7uef.onrender.com`

### 2. Frontend React Native Updates

- Updated `PYTHON_API_URL` in `src/app/(tabs)/index.tsx` and `src/app/camera.tsx` to point to the new live Render backend instead of the local `127.0.0.1` address.

### 3. Production APK Separation

- **`app.json` Configuration**: Changed the app's visual name to **"GovForm AI (Live)"**.
- **Package Name Isolation**: Changed the Android package name to `com.anonymous.govform_ai_live`.
  - *Why?* This tells Android that this is a completely brand-new application. This allows you to safely install the final Live APK on your phone side-by-side with your old development/debug version without them overwriting each other!
- Safely removed the unused `ios` configuration block to keep the project clean.

---

## Update: August 20, 2026 (02:00 AM)

### 1. Camera Permissions Fix

- **`app.json` Plugin Fix**: Configured the `expo-camera` plugin properly and ensured `android.permission.CAMERA` was correctly defined so the live camera no longer crashes due to missing permissions.

### 2. Camera Payload Optimization

- **`expo-image-manipulator` integration**: Photos taken with the live camera were massive (multi-megabyte) which caused the free Render server to time out. Integrated `ImageManipulator` in `camera.tsx` to drastically compress and downscale images (1000px width, 70% JPEG quality) before uploading, ensuring fast and reliable OCR processing.
- **Removed Fake Data**: Discovered and removed a hardcoded fallback in `index.tsx` that silently loaded fake demo bounding boxes when the server crashed, ensuring the app correctly alerts users on connection failures.

### 3. Recent Scans & Persistent Storage

- **`storage.ts` Utility**: Built a robust local storage system combining `expo-file-system/legacy` (to permanently save image thumbnails) and `@react-native-async-storage/async-storage` (to save harvested words and metadata).
- **Forms Tab UI (`forms.tsx`)**: Completely redesigned the Forms tab to act as a history vault. It dynamically fetches and displays a list of recently scanned documents along with their thumbnail, date, and harvested word count.
- **Harvested Words Detail (`form-details.tsx`)**: Created a new screen that lists the raw text extracted from previous scans. When users tap on a recent scan in the Forms tab, it instantly displays the words without re-querying the cloud server, saving data and processing power.

---

## Update: August 21, 2026 (12:47 AM)

### 1. Fine-Tuned Local LLM Integration

- **Ollama Integration (`llm.ts`)**: Integrated the fine-tuned local `offline_dict_8b` model into the app, connecting directly via the laptop's Mobile Hotspot IP (`192.168.137.1`).
- **Dynamic Prompt Formatting**: Updated the prompt logic to precisely match the fine-tuned dataset format (`Define the word "..." in the context of this sentence: "..."`).
- **Context Sentence Harvesting (`storage.ts`)**: Upgraded the local storage system to save the surrounding context sentence along with the tapped word from the OCR scan, ensuring the LLM receives the full context it was trained on.
- **Language Selection Instruction**: Appended a specific instruction to the prompt (`Please generate the output in [Language]`) to force the model to output definitions in the user's selected language (Tagalog, Cebuano, or English).

### 2. Interactive AI Dictionary UI (`form-details.tsx`)

- **Slide-Up Modal**: Built an interactive slide-up modal that appears when a user taps a harvested word.
- **Dynamic Language Rendering**: Modified the UI to conditionally render the dictionary definition based *only* on the user's language setting (e.g., if Tagalog is selected, the English definition is strictly hidden).
- **Graceful JSON Fallback**: Added a robust error-handling fallback. If the LLM generates a non-standard JSON structure (which happens when an unknown word is tapped), the UI now seamlessly extracts the definition and renders it cleanly instead of crashing or showing raw JSON formatting.

### PLEASE TAKE NOTE NA WALA PA NA AYO ANG UI SA PAG GENERATE ESPECIALLY SA TAGALOG OG BISAYA
