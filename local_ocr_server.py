import uvicorn
from fastapi import FastAPI, UploadFile, File
import pytesseract
from PIL import Image, ImageOps
import io
import os
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np

# Point to Tesseract based on the Operating System
if os.name == 'nt' and os.path.exists(r"C:\Program Files\Tesseract-OCR\tesseract.exe"):
    pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

base_dir = os.path.dirname(os.path.abspath(__file__)).replace('\\', '/')
if "TESSDATA_PREFIX" not in os.environ:
    os.environ["TESSDATA_PREFIX"] = base_dir

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize ORB for visual template matching
orb = cv2.ORB_create(nfeatures=1000)
TEMPLATES_DIR = "templates"
if not os.path.exists(TEMPLATES_DIR):
    os.makedirs(TEMPLATES_DIR)

# Pre-load templates
template_data = {}

FOLDER_MAPPING = {
    'birth': 'psa-birth',
    'cef': 'comelec-cef1',
    'comelec-transfer': 'comelec-supp',
    'death': 'psa-death',
    'marriage': 'psa-marriage',
    'pmrf': 'philhealth-pmrf',
    'senior': 'ncsc-octo'
}

for root, _, files in os.walk(TEMPLATES_DIR):
    for file in files:
        if file.lower().endswith(('.png', '.jpg', '.jpeg')):
            path = os.path.join(root, file)
            img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
            if img is not None:
                kp, des = orb.detectAndCompute(img, None)
                
                # Determine form name
                folder_name = os.path.basename(root).lower()
                if folder_name in FOLDER_MAPPING:
                    form_name = FOLDER_MAPPING[folder_name]
                elif root == TEMPLATES_DIR:
                    form_name = os.path.splitext(file)[0]
                else:
                    form_name = os.path.basename(root)
                    
                template_data[path] = {'kp': kp, 'des': des, 'form_name': form_name}
                print(f"Loaded template: {path} mapped to '{form_name}' with {len(kp)} keypoints")

bf = cv2.BFMatcher(cv2.NORM_HAMMING)


def preprocess_for_ocr(image_pil: Image.Image):
    """
    OpenCV preprocessing pipeline optimized for physical paper captures:
    1. EXIF auto-rotation to align pixel axes with physical perspective.
    2. Background illumination division to eliminate shadows, uneven desk lighting, and paper yellowing.
    3. CLAHE (Contrast Limited Adaptive Histogram Equalization) to amplify faint ink & dot-matrix text.
    4. Gaussian smoothing (3x3) to remove high-frequency camera sensor noise.
    
    Returns:
        preprocessed_cv (numpy.ndarray): Clean grayscale image ready for Tesseract OCR.
        normalized_pil (Image.Image): Transposed PIL Image for downstream tasks.
    """
    # 1. EXIF auto-rotation
    image_transposed = ImageOps.exif_transpose(image_pil)
    
    # 2. Convert to OpenCV grayscale
    img_rgb = np.array(image_transposed.convert('RGB'))
    gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
    
    # 3. Morphological background illumination division (Shadow / Gradient removal)
    # Proportional kernel size (approx 1/40th of max dimension, minimum 21 pixels)
    k_size = max(21, int(max(gray.shape) / 40))
    if k_size % 2 == 0:
        k_size += 1
        
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (k_size, k_size))
    # Morphological closing creates an accurate estimate of the background illumination plane
    bg = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, kernel)
    
    # Division normalization: img / bg * 255
    # Pixels where ink is present stay dark; paper background becomes pure 255 white everywhere
    norm = np.clip((gray.astype(np.float32) / (bg.astype(np.float32) + 1e-5)) * 255.0, 0, 255).astype(np.uint8)
    
    # 4. CLAHE for contrast enhancement
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(norm)
    
    # 5. Gaussian blur (3x3) to eliminate paper grain & sensor speckles
    preprocessed_cv = cv2.GaussianBlur(enhanced, (3, 3), 0)
    
    return preprocessed_cv, image_transposed


def detect_form_visually(image_cv_gray):
    if not template_data:
        return "UNKNOWN"
        
    kp_img, des_img = orb.detectAndCompute(image_cv_gray, None)
    
    if des_img is None:
        return "UNKNOWN"
        
    best_match = "UNKNOWN"
    max_good_matches = 0
    
    for name, data in template_data.items():
        if data['des'] is None:
            continue
        # Use knnMatch and Lowe's ratio test for highly robust matching
        matches = bf.knnMatch(data['des'], des_img, k=2)
        
        good_matches = []
        for match_tuple in matches:
            if len(match_tuple) == 2:
                m, n = match_tuple
                if m.distance < 0.75 * n.distance:
                    good_matches.append(m)
        
        # Increased threshold to prevent false positives
        if len(good_matches) > max_good_matches and len(good_matches) > 40:
            max_good_matches = len(good_matches)
            best_match = data['form_name']
            
    return best_match


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    print(f"Received image: {file.filename}")
    contents = await file.read()
    raw_image = Image.open(io.BytesIO(contents)).convert('RGB')
    
    # Run OpenCV document preprocessing pipeline (removes shadows, equalizes contrast)
    preprocessed_img, clean_pil = preprocess_for_ocr(raw_image)
    
    # 1. Visual Form Detection (OpenCV with shadow-normalized image)
    form_type = detect_form_visually(preprocessed_img)
    print(f"Visual classification result: {form_type}")
    
    # 2. Run Tesseract on preprocessed image
    custom_model_file = os.path.join(base_dir, "myformmodel.traineddata")
    has_custom = os.path.exists(custom_model_file)
    
    data = None
    if has_custom:
        try:
            data = pytesseract.image_to_data(
                preprocessed_img,
                lang='myformmodel',
                config=f'--tessdata-dir {base_dir}',
                output_type=pytesseract.Output.DICT
            )
            print("OCR successful with custom model (myformmodel)!")
        except Exception as e:
            print(f"Custom model OCR error: {e}. Falling back to 'eng'...")
            
    if data is None:
        data = pytesseract.image_to_data(
            preprocessed_img,
            lang='eng',
            output_type=pytesseract.Output.DICT
        )
        print("OCR completed with 'eng' model.")
    
    boxes = []
    n_boxes = len(data['level'])
    for i in range(n_boxes):
        conf = int(data['conf'][i])
        # Filter out empty or low-confidence noise boxes (< 15)
        if conf > 15:
            text = data['text'][i].strip()
            if text:
                boxes.append({
                    "text": text,
                    "x": data['left'][i],
                    "y": data['top'][i],
                    "width": data['width'][i],
                    "height": data['height'][i]
                })
    
    print(f"Extracted {len(boxes)} high-confidence text boxes.")
    return {"formType": form_type, "boxes": boxes}

if __name__ == "__main__":
    print("========================================")
    print("Starting Desktop OCR Server on port 8000")
    print("Make sure you allow Python through your Windows Firewall if asked!")
    print("========================================")
    uvicorn.run(app, host="0.0.0.0", port=8000)

