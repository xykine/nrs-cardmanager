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
    pdf = FPDF(orientation=orientation, unit='mm', format=(53.98, 85.60)) # CR80 standard dimensions
    pdf.set_auto_page_break(False)
    
    # CR80 Dimensions
    # Width: 2.125 inches (~53.98mm)
    # Height: 3.375 inches (~85.60mm)
    # The FPDF format argument takes (width, height). 
    # If orientation is 'L', FPDF swaps them automatically.
    
    # We want the image to fill the page
    # If orientation is 'P', page is 53.98 x 85.60
    # If orientation is 'L', page is 85.60 x 53.98
    
    # Since we are setting the page size TO the card size, x and y are always 0
    x = 0
    y = 0
    
    # Dimensions for the image placement should match the page dimensions
    # FPDF handles orientation by swapping width/height of the format.
    # We just need to know what those swapped values are for the .image() call.
    
    if orientation == 'P':
        page_w = 53.98
        page_h = 85.60
    else:
        page_w = 85.60
        page_h = 53.98

    for front_src, back_src in card_images:
        # --- Front Page ---
        pdf.add_page()
        
        # Determine if we need to stream it
        if isinstance(front_src, Image.Image):
            pdf.image(front_src, x, y, page_w, page_h)
        else:
             pdf.image(front_src, x, y, page_w, page_h)
        
        # --- Back Page ---
        pdf.add_page()
        
        if isinstance(back_src, Image.Image):
            pdf.image(back_src, x, y, page_w, page_h)
        else:
            pdf.image(back_src, x, y, page_w, page_h)
        
    pdf.output(output_path)
    return output_path
