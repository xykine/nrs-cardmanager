import io
import base64
import cv2
import numpy as np
from PIL import Image, ImageOps

from .opencv_helpers import load_haar_cascade

def calculate_auto_frame_params(photo_data: str, container_w: float = 208, container_h: float = 208):
    """
    Reverse engineers the frontend React Avatar Editor coordinates for a natively perfectly framed 
    person without manually tweaking it. Returns (photo_x, photo_y, photo_scale).
    """
    try:
        # Decode Base64 Data URI
        if photo_data.startswith("data:"):
            header, encoded = photo_data.split(",", 1)
        else:
            encoded = photo_data

        data = base64.b64decode(encoded)
        img_pil = Image.open(io.BytesIO(data))
        img_pil = ImageOps.exif_transpose(img_pil)
        
        # 1. Convert PIL to CV2 grayscale
        img_cv = np.array(img_pil.convert('RGB'))
        img_cv = img_cv[:, :, ::-1].copy() # RGB to BGR
        gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
        
        # Improve contrast for better face detection
        gray = cv2.equalizeHist(gray)
        
        face_cascade = load_haar_cascade("haarcascade_frontalface_default.xml")
        if face_cascade is None:
            return 0, 0, "1.0"
        
        img_h, img_w = img_cv.shape[:2]
        min_face_size = (int(img_w * 0.08), int(img_h * 0.08))
        
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=min_face_size)
        
        if len(faces) == 0:
            return 0, 0, "1.0"
            
        # Pick the largest face by area
        faces = sorted(faces, key=lambda f: f[2]*f[3], reverse=True)
        cx, cy, cw, ch = faces[0]
        
        # Math calculation
        image_w, image_h = img_pil.size
        
        # Center of the person/face in the original image
        center_x = cx + cw / 2.0
        
        # Top of the frame we want to capture (leaving 45% of face height as hair clearance)
        top_y = cy - (ch * 0.45)
        
        # UI scales image based on object-fit: cover equivalent logic
        base_scale = max(container_w / image_w, container_h / image_h)
        
        # Face width occupies about 45% of the crop width
        photo_scale = (container_w * 0.45) / (cw * base_scale)
        
        # S is the overall absolute scale from image pixels to UI CSS pixels
        S = base_scale * photo_scale
        
        # Translate pixels computation for Avatar Editor
        photo_x = S * (image_w / 2.0 - center_x)
        photo_y = S * (image_h / 2.0 - top_y) - (container_h / 2.0)
        
        # Bound limits logically
        photo_scale = max(0.1, min(5.0, photo_scale))
        
        return int(np.round(photo_x)), int(np.round(photo_y)), f"{photo_scale:.2f}"
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("Contour parameter calc failed", exc_info=True)
        return 0, 0, "1.0"
