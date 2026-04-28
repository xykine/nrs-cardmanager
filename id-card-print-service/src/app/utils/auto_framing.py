import io
import base64
import cv2
import numpy as np
from PIL import Image, ImageOps

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
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        
        # 2. Adaptive Canny Edge closing to find contour
        v = np.median(blurred)
        sigma = 0.33
        lower = int(max(0, (1.0 - sigma) * v))
        upper = int(min(255, (1.0 + sigma) * v))
        edges = cv2.Canny(blurred, lower, upper)
        
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
        closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)
        closed = cv2.dilate(closed, kernel, iterations=3)
        
        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            return 0, 0, "1.0"
            
        largest_contour = max(contours, key=cv2.contourArea)
        cx, cy, cw, ch = cv2.boundingRect(largest_contour)
        
        # Math calculation
        image_w, image_h = img_pil.size
        
        # Center of the person in the original image
        center_x = cx + cw / 2.0
        # Highest point of the person
        top_y = cy
        
        # UI scales image based on object-fit: cover equivalent logic:
        # base_scale = max(container_w / image_w, container_h / image_h)
        base_scale = max(container_w / image_w, container_h / image_h)
        
        # We want the width of the contour cw to map to 75% of the container width
        # cw * base_scale * photo_scale = container_w * 0.75
        photo_scale = (container_w * 0.75) / (cw * base_scale)
        
        # S is the overall absolute scale from image pixels to UI CSS pixels
        S = base_scale * photo_scale
        
        # Translate pixels computation
        photo_x = S * (image_w / 2.0 - center_x)
        photo_y = S * (image_h / 2.0 - top_y) - container_h * 0.42
        
        # Bound limits logically
        photo_scale = max(0.1, min(5.0, photo_scale))
        
        return int(np.round(photo_x)), int(np.round(photo_y)), f"{photo_scale:.2f}"
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("Contour parameter calc failed", exc_info=True)
        return 0, 0, "1.0"
