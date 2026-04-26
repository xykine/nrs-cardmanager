import cv2
import numpy as np

def extract_background_mask_contour(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # Blur
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    # Canny edges
    edges = cv2.Canny(blurred, 50, 150)
    
    # Dilate edges to close gaps
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)
    closed = cv2.dilate(closed, kernel, iterations=2)
    
    # Find contours
    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Create a mask for the background (initially everything is background)
    bg_mask = np.ones(img.shape[:2], dtype=np.uint8) * 255
    
    if contours:
        # Get the bounding box of all contours to represent the 'person'
        # Or draw the contours filled on the bg_mask to exclude them
        cv2.drawContours(bg_mask, contours, -1, 0, thickness=cv2.FILLED)
        
        # Alternatively, using bounding box of the largest contour
        # (Assuming the largest contour is the person)
        c = max(contours, key=cv2.contourArea)
        x, y, w, h = cv2.boundingRect(c)
        # Mark the bounding box area as NOT background (foreground = 0)
        # bg_mask[y:y+h, x:x+w] = 0
        
    return bg_mask

print("Test script ready")
