import uvicorn
from fastapi import FastAPI, UploadFile, File
import pytesseract
from PIL import Image
import io
import os
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np

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
    'birth': 'PSA Application Form for Birth Certificate',
    'cef': 'COMELEC Voter Registration Form (CEF-1A)',
    'comelec-transfer': 'COMELEC Application for Transfer of Registration',
    'death': 'PSA Application Form for Death Certificate',
    'marriage': 'PSA Application Form for Marriage Certificate',
    'pmrf': 'PHILHEALTH Member Registration Form (PMRF)',
    'senior': 'Senior Citizen Registration Form'
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

def detect_form_visually(image_pil):
    if not template_data:
        return "UNKNOWN"
        
    img_cv = cv2.cvtColor(np.array(image_pil), cv2.COLOR_RGB2GRAY)
    kp_img, des_img = orb.detectAndCompute(img_cv, None)
    
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
    image = Image.open(io.BytesIO(contents)).convert('RGB')
    
    # 1. Visual Form Detection (OpenCV)
    form_type = detect_form_visually(image)
    print(f"Visual classification result: {form_type}")
    
    # Run Tesseract with custom model
    # Note: Make sure myformmodel.traineddata is in your Tesseract tessdata folder!
    try:
        data = pytesseract.image_to_data(image, lang='myformmodel', output_type=pytesseract.Output.DICT)
        print("OCR successful!")
    except Exception as e:
        print(f"OCR Error: {str(e)}")
        print("Fallback to English OCR...")
        data = pytesseract.image_to_data(image, lang='eng', output_type=pytesseract.Output.DICT)
    
    boxes = []
    n_boxes = len(data['level'])
    for i in range(n_boxes):
        if int(data['conf'][i]) > 0: # Filter out empty/invalid boxes
            text = data['text'][i].strip()
            if text:
                boxes.append({
                    "text": text,
                    "x": data['left'][i],
                    "y": data['top'][i],
                    "width": data['width'][i],
                    "height": data['height'][i]
                })
    
    return {"formType": form_type, "boxes": boxes}

if __name__ == "__main__":
    print("========================================")
    print("Starting Desktop OCR Server on port 8000")
    print("Make sure you allow Python through your Windows Firewall if asked!")
    print("========================================")
    uvicorn.run(app, host="0.0.0.0", port=8000)
