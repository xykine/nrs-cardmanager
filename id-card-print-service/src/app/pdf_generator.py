import io
from fpdf import FPDF
from PIL import Image
from typing import List, Tuple, Union

def create_id_card_pdf(
    card_images: List[Tuple[Union[str, Image.Image], Union[str, Image.Image]]], 
    output_path: str,
    orientation: str = "P"
) -> str:
    """
    Generates a PDF with Front and Back images for ID cards.
    Accepts file paths OR PIL Image objects.
    """
    
    # Init FPDF with standard A4 page (Portrait)
    # A4 is 210 x 297 mm
    pdf = FPDF(orientation='P', unit='mm', format='A4')
    pdf.set_auto_page_break(False)
    
    # CR80 Dimensions (Portrait)
    # Width: 2.125 inches
    # Height: 3.375 inches
    # 1 inch = 25.4 mm
    card_w = 2.125 * 25.4  # ~53.975 mm
    card_h = 3.375 * 25.4  # ~85.725 mm

    # Page Dimensions (A4)
    page_w = 210
    page_h = 297

    # Calculate centered position
    x = (page_w - card_w) / 2
    y = (page_h - card_h) / 2
    
    for front_src, back_src in card_images:
        # --- Front Page ---
        pdf.add_page()
        
        # Determine if we need to stream it
        if isinstance(front_src, Image.Image):
            # Convert PIL to BytesIO
            # fpdf2 allows passing the PIL image directly? 
            # It's safer to pass it, fpdf2 handles it, but let's be explicit if needed.
            # actually fpdf2.image(img) works if img is PIL.Image.
            pdf.image(front_src, x, y, card_w, card_h)
        else:
             pdf.image(front_src, x, y, card_w, card_h)
        
        # --- Back Page ---
        pdf.add_page()
        
        if isinstance(back_src, Image.Image):
            pdf.image(back_src, x, y, card_w, card_h)
        else:
            pdf.image(back_src, x, y, card_w, card_h)
        
    pdf.output(output_path)
    return output_path
