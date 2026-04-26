import cv2
import numpy as np
from PIL import Image

def auto_frame_face(img_pil: Image, target_aspect: float) -> Image:
    """
    Detects face and crops the PIL image to optimally frame the face 
    for an ID card using target_aspect (width/height).
    """
    # 1. Convert PIL to CV2 grayscale
    img_cv = np.array(img_pil.convert('RGB'))
    img_cv = img_cv[:, :, ::-1].copy() # RGB to BGR
    gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
    
    # 2. Detect face
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    face_cascade = cv2.CascadeClassifier(cascade_path)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
    
    if len(faces) == 0:
        return img_pil # No face found, fallback to original
        
    # Pick the largest face
    fx, fy, fw, fh = max(faces, key=lambda rect: rect[2] * rect[3])
    
    # 3. Calculate ideal crop boundaries
    # Standard ID photo: face occupies about 40% of the width
    ideal_w = fw / 0.4 
    ideal_h = ideal_w / target_aspect
    
    # Center horizontally on face
    cx = fx + fw / 2
    # Vertically, face should be roughly 20% from the top
    # The top of the crop should be fy - (ideal_h * 0.2)
    top = fy - (ideal_h * 0.2)
    left = cx - (ideal_w / 2)
    bottom = top + ideal_h
    right = left + ideal_w
    
    # 4. Constrain to image boundaries
    # To keep aspect ratio, if we hit a boundary, we should shrink the ideal rectangle
    # but we can simply crop and let the downstream resize handle slight aspect ratio mismatches
    img_w, img_h = img_pil.size
    
    left = max(0, int(left))
    top = max(0, int(top))
    right = min(img_w, int(right))
    bottom = min(img_h, int(bottom))
    
    if right - left < fw or bottom - top < fh:
        return img_pil # Math bounds collapsed safely abort
        
    return img_pil.crop((left, top, right, bottom))

print("Script parsed successfully.")
