import os
import uuid
import pytesseract
from PIL import Image, ImageOps
from flask import Flask, request, jsonify
from flask_cors import CORS
from pytesseract import Output
import cv2
import numpy as np

# Point to your local Tesseract installation
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

app = Flask(__name__)
# Enable CORS so your React Native app can communicate with this API
CORS(app)

# Ensure there is an uploads folder to temporarily store photos sent from the phone
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def is_blurry(image, threshold=100.0):
    """
    Computes the variance of the Laplacian of the image. 
    If it's below the threshold, the image is considered blurry.
    """
    # Convert PIL Image to OpenCV format
    cv_image = np.array(image.convert('RGB'))
    # Convert to grayscale
    gray = cv2.cvtColor(cv_image, cv2.COLOR_RGB2GRAY)
    # Calculate the variance of the Laplacian
    fm = cv2.Laplacian(gray, cv2.CV_64F).var()
    print(f"🔍 Image Blur Score (Laplacian Variance): {fm}")
    return fm < threshold

@app.route('/scan', methods=['POST'])
def scan_image():
    if 'file' not in request.files:
        return jsonify({"error": "No image uploaded"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Empty file name"}), 400

    # Save the file temporarily
    filename = f"{uuid.uuid4()}.jpg"
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)
    
    try:
        print(f"📸 Image received! Running OCR on {filename}...")
        from PIL import ImageOps
        img = Image.open(filepath)
        # Fix EXIF rotation which often causes Tesseract coordinates to be completely swapped!
        img = ImageOps.exif_transpose(img)
        
        # Check for blurriness
        if is_blurry(img, threshold=80.0):  # 80.0 is a good baseline, can be adjusted
            print("🚨 Image is too blurry! Rejecting request.")
            os.remove(filepath)
            return jsonify({"error": "BLURRY", "message": "The photo is too blurry. Please hold the camera steady and try again."}), 400

        # Run Tesseract to get bounding boxes and text
        # --psm 11 looks for sparse text (good for forms and scattered words)
        custom_config = r'--psm 11'
        ocr_data = pytesseract.image_to_data(img, output_type=Output.DICT, config=custom_config)
        
        bounding_boxes = []
        
        # We need to process the data row by row.
        # ocr_data contains arrays for each attribute: 'text', 'left', 'top', 'width', 'height', 'conf'
        n_boxes = len(ocr_data['level'])
        
        # Optional: Group words into lines/sentences (basic grouping by block_num and line_num)
        lines = {}
        for i in range(n_boxes):
            text = ocr_data['text'][i].strip()
            if text and int(ocr_data['conf'][i]) > 10: # Only keep words with > 10% confidence
                line_key = f"{ocr_data['block_num'][i]}_{ocr_data['line_num'][i]}"
                if line_key not in lines:
                    lines[line_key] = []
                lines[line_key].append(text)
                
        # Now create the final bounding box array
        for i in range(n_boxes):
            text = ocr_data['text'][i].strip()
            conf = int(ocr_data['conf'][i])
            
            # Only send back words that have actual text and reasonable confidence
            if text and conf > 10:
                line_key = f"{ocr_data['block_num'][i]}_{ocr_data['line_num'][i]}"
                full_sentence = " ".join(lines[line_key])
                
                box = {
                    "text": text,
                    "sentence": full_sentence,
                    "x": ocr_data['left'][i],
                    "y": ocr_data['top'][i],
                    "width": ocr_data['width'][i],
                    "height": ocr_data['height'][i]
                }
                bounding_boxes.append(box)
                
        print(f"✅ OCR Complete! Found {len(bounding_boxes)} words. Sending to React Native...")
        
        # Delete the temp file to save space
        os.remove(filepath)
        
        return jsonify(bounding_boxes), 200

    except Exception as e:
        print(f"🚨 Error processing image: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/', methods=['GET'])
def health_check():
    return jsonify({"status": "Backend is running!"})

if __name__ == '__main__':
    # Listen on all local IP addresses at port 5000 (0.0.0.0 exposes it to your local network)
    app.run(host='0.0.0.0', port=5000, debug=True)
