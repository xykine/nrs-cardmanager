import io
from fpdf import FPDF
from PIL import Image
from typing import List, Tuple, Union, Any

def create_id_card_pdf(
    card_images: List[Any], 
    output_path: str = None,
    orientation: str = "P"
) -> Union[str, bytes]:
    """
    Generates a PDF with Front and Back images for ID cards.
    Accepts file paths OR PIL Image objects.
    card_images can be List of Tuple(front, back) OR Tuple(front, back, orientation).
    If output_path is None, returns bytes.
    """
    pdf = FPDF(orientation=orientation, unit='mm', format=(53.98, 85.60)) # CR80 standard dimensions
    pdf.set_auto_page_break(False)
    
    x = 0
    y = 0
    
    for item in card_images:
        if len(item) == 3:
            front_src, back_src, row_ori = item
        else:
            front_src, back_src = item
            row_ori = orientation
            
        if row_ori == 'P':
            page_w = 53.98
            page_h = 85.60
        else:
            page_w = 85.60
            page_h = 53.98

        # --- Front Page ---
        pdf.add_page(orientation=row_ori)
        
        if isinstance(front_src, Image.Image):
            pdf.image(front_src, x, y, page_w, page_h)
        else:
             pdf.image(front_src, x, y, page_w, page_h)
        
        # --- Back Page ---
        pdf.add_page(orientation=row_ori)
        
        if isinstance(back_src, Image.Image):
            pdf.image(back_src, x, y, page_w, page_h)
        else:
            pdf.image(back_src, x, y, page_w, page_h)
        
    if output_path:
        pdf.output(output_path)
        return output_path
    else:
        # Return bytes
        return pdf.output()
