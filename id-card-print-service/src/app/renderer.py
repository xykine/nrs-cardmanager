from PIL import Image, ImageDraw, ImageFont, ImageOps
from pathlib import Path
import io
import os
import httpx
import qrcode
import hashlib
import base64
from typing import Optional, Union
from datetime import date
from cryptography.fernet import Fernet

# CR80 (2.125" x 3.375") @ 300dpi, portrait
DPI = 300

def _inch_to_px(inches: float) -> int:
    return int((inches * DPI) + 0.5)

CARD_W, CARD_H = _inch_to_px(2.125), _inch_to_px(3.375)

BG_COLOR = "#FFFFFF"
RED = "#C62828"
DARK_GRAY = "#4A4A4A"
LIGHT_GRAY = "#6A6A6A"


BASE_DIR = Path(__file__).resolve().parent            # .../src/app
PROJECT_ROOT = BASE_DIR.parents[1]                    # .../id-card-print-service
ASSETS_DIR = PROJECT_ROOT / "assets"

MONTSERRAT_BOLD = ASSETS_DIR / "Montserrat-Bold.ttf"
MONTSERRAT_REG  = ASSETS_DIR / "Montserrat-Regular.ttf"
DEJAVU_BOLD     = ASSETS_DIR / "DejaVuSans-Bold.ttf"
DEJAVU_REG      = ASSETS_DIR / "DejaVuSans.ttf"


import functools

@functools.lru_cache(maxsize=32)
def _load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        MONTSERRAT_BOLD if bold else MONTSERRAT_REG,
        DEJAVU_BOLD if bold else DEJAVU_REG,
    ]

    for font_path in candidates:
        if font_path.exists():
            return ImageFont.truetype(str(font_path), size)

    raise FileNotFoundError(
        "No usable TTF font found.\n"
        f"Checked: {[str(p) for p in candidates]}"
    )

def _draw_multiline_center_text(
    draw: ImageDraw.ImageDraw, 
    text: str, 
    y: int, 
    font: ImageFont.FreeTypeFont, 
    color: str,
    max_width: int,
    line_spacing_ratio: float = 1.2
) -> int:
    """
    Draws text centered horizontally. Wraps to new line if wider than max_width.
    Returns the total vertical height consumed.
    """
    text = (text or "").strip()
    if not text:
        return 0

    lines = []
    words = text.split()
    current_line = []
    
    # Simple word wrapping
    for word in words:
        test_line = " ".join(current_line + [word])
        w = draw.textlength(test_line, font=font)
        if w <= max_width:
            current_line.append(word)
        else:
            if current_line:
                lines.append(" ".join(current_line))
                current_line = [word]
            else:
                lines.append(word)
                current_line = []
    
    if current_line:
        lines.append(" ".join(current_line))
        
    # Draw lines
    current_y = y
    line_height = font.size * line_spacing_ratio
    
    for line in lines:
        w = draw.textlength(line, font=font)
        x = (CARD_W - w) // 2
        draw.text((x, current_y), line, font=font, fill=color)
        current_y += line_height
        
    return int(len(lines) * line_height)

def _draw_center_text(draw: ImageDraw.ImageDraw, text: str, y: int, font, color: str):
    text = (text or "").strip()
    tw = draw.textlength(text, font=font)
    x = (CARD_W - tw) // 2
    draw.text((x, y), text, font=font, fill=color)

def _rounded_image(
    img: Image.Image,
    size: tuple[int, int],
    radius: int,
    centering: tuple[float, float] = (0.5, 0.4),
) -> Image.Image:
    img = ImageOps.exif_transpose(img)
    img = ImageOps.fit(img.convert("RGB"), size, method=Image.LANCZOS, centering=centering)
    mask = Image.new("L", size, 0)
    m = ImageDraw.Draw(mask)
    m.rounded_rectangle((0, 0, size[0], size[1]), radius=radius, fill=255)

    out = Image.new("RGBA", size)
    out.paste(img, (0, 0), mask)
    return out

def _load_card_template(
    template: Union[Path, Image.Image],
    width: int,
    height: int,
) -> Image.Image:
    """Load a card background and normalize to card pixel dimensions."""
    if isinstance(template, Image.Image):
        return template.convert("RGB").resize((width, height), Image.LANCZOS)
    if not template.exists():
        return Image.new("RGB", (width, height), BG_COLOR)
    img = Image.open(template).convert("RGB")
    return img.resize((width, height), Image.LANCZOS)


def _load_rgba_asset(asset: Union[Path, Image.Image]) -> Image.Image:
    if isinstance(asset, Image.Image):
        return asset.convert("RGBA")
    return Image.open(asset).convert("RGBA")


def _load_image_from_url_or_path(photo_url: str) -> Image.Image:
    if photo_url.startswith("data:"):
        # Handle Base64 Data URI
        try:
             header, encoded = photo_url.split(",", 1)
             data = base64.b64decode(encoded)
             return Image.open(io.BytesIO(data))
        except Exception as e:
             raise ValueError("Invalid data URI") from e
    elif photo_url.startswith("http://") or photo_url.startswith("https://"):
        with httpx.Client(timeout=20) as client:
            r = client.get(photo_url)
            r.raise_for_status()
            return Image.open(io.BytesIO(r.content))
    else:
        p = Path(photo_url)
        return Image.open(p)

def render_front(
    full_name: str,
    employee_id: str,
    photo_url: str,
    logo_path: Union[Path, Image.Image],
    bottom_accent_path: Union[Path, Image.Image],
    photo_x: int = 0,
    photo_y: int = 0,
    photo_scale: float = 1.0,
) -> Image.Image:
    card = Image.new("RGB", (CARD_W, CARD_H), BG_COLOR)
    draw = ImageDraw.Draw(card)

    name_font = _load_font(int(CARD_W * 0.06), bold=True)
    id_font = _load_font(int(CARD_W * 0.052), bold=True)

    # Logo (top centered)
    logo = _load_rgba_asset(logo_path)
    logo_w = int(CARD_W * 0.6)
    logo_h = int(logo.height * (logo_w / logo.width))
    logo = logo.resize((logo_w, logo_h), Image.LANCZOS)
    logo_x = (CARD_W - logo_w) // 2
    logo_y = int(CARD_H * 0.01)
    card.paste(logo, (logo_x, logo_y), logo)

    # Photo container dimensions - 8:10 aspect ratio
    # Front-end: w-48 (192px), h-60 (240px)
    pw = int(CARD_W * 0.45) # approx 1.15" -> 345px at 300dpi
    ph = int(pw * 1.15)    # 8:10 ratio (pw/ph = 0.8 => ph = pw/0.8)
    px = (CARD_W - pw) // 2
    py = int(CARD_H * 0.30)
    border = max(4, int(pw * 0.04)) 
    inner_radius = int(pw * 0.03)
    outer_radius = inner_radius + border

    # Draw border
    draw.rounded_rectangle(
        (px - border, py - border, px + pw + border, py + ph + border),
        radius=outer_radius,
        fill=RED,
    )

    # Load and process photo
    photo = _load_image_from_url_or_path(photo_url).convert("RGB")
    photo = ImageOps.exif_transpose(photo)

    # Base scale to cover the frame (object-fit: cover equivalent)
    # Target frame is (pw, ph)
    w, h = photo.size
    aspect_photo = w / h
    aspect_frame = pw / ph

    if aspect_photo > aspect_frame:
        # Photo is wider than frame, scale by height
        base_scale = ph / h
    else:
        # Photo is taller than frame, scale by width
        base_scale = pw / w

    current_scale = base_scale * photo_scale
    new_w = int(w * current_scale)
    new_h = int(h * current_scale)
    photo = photo.resize((new_w, new_h), Image.LANCZOS)

    # Calculate center position + offsets
    # photo_x and photo_y are assumed to be in "frontend pixels" (192 container now)
    # We should scale them to the backend resolution.
    # Frontend container width is 192px. Backend container width is pw.
    scale_to_dpi = pw / 192.0
    
    offset_x = int(photo_x * scale_to_dpi)
    offset_y = int(photo_y * scale_to_dpi)

    # Paste position (relative to card)
    # Center of photo in center of container:
    paste_x = px + (pw - new_w) // 2 + offset_x
    paste_y = py + (ph - new_h) // 2 + offset_y

    # Create a mask for the rounded photo container
    mask = Image.new("L", (CARD_W, CARD_H), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle(
        (px, py, px + pw, py + ph),
        radius=inner_radius,
        fill=255
    )

    # Fill container area with white first (base background for photo)
    draw.rounded_rectangle(
        (px, py, px + pw, py + ph),
        radius=inner_radius,
        fill="white"
    )

    # 1. Create a transparent layer for the photo (matches card size)
    photo_layer = Image.new("RGBA", (CARD_W, CARD_H), (0, 0, 0, 0))
    # 2. Paste the photo onto it at its designated position
    photo_rgba = photo.convert("RGBA")
    photo_layer.paste(photo_rgba, (paste_x, paste_y))
    
    # 3. Create the container clipping mask
    container_mask = Image.new("L", (CARD_W, CARD_H), 0)
    container_mask_draw = ImageDraw.Draw(container_mask)
    container_mask_draw.rounded_rectangle(
        (px, py, px + pw, py + ph),
        radius=inner_radius,
        fill=255
    )
    
    # 4. Create the final mask by intersecting photo's alpha with container's mask
    # This prevents black borders where the photo has transparency or doesn't reach the edge
    photo_alpha = photo_layer.split()[3]
    final_mask = Image.new("L", (CARD_W, CARD_H), 0)
    final_mask.paste(photo_alpha, (0, 0), container_mask)
    
    # 5. Paste the photo layer onto the card using the intersected mask
    card.paste(photo_layer, (0, 0), final_mask)

    # Name + ID
    name_y = py + ph + int(CARD_H * 0.05)
    
    # Use multi-line drawing for name
    # Allow roughly 90% of card width for the name
    max_name_width = int(CARD_W * 0.9)
    name_height_consumed = _draw_multiline_center_text(
        draw, 
        (full_name or "").upper(), 
        name_y, 
        name_font, 
        "#000000",
        max_width=max_name_width
    )
    
    # Adjust ID position based on name height
    # Give it some padding after the last line of the name
    id_padding = int(CARD_H * 0.02)
    id_y = name_y + name_height_consumed + id_padding
    
    _draw_center_text(draw, f"IR {(employee_id or '').strip()}", id_y, id_font, DARK_GRAY)

    # Bottom icon (centered)
    icon = _load_rgba_asset(bottom_accent_path)
    icon_w = int(CARD_W * 0.52)
    icon_h = int(icon.height * (icon_w / icon.width))
    icon = icon.resize((icon_w, icon_h), Image.LANCZOS)
    icon_x = (CARD_W - icon_w) // 2
    icon_y = int(CARD_H * 0.87)
    card.paste(icon, (icon_x, icon_y), icon)

    return card

def render_back(
    employee_id: str,
    back_template_path: Union[Path, Image.Image],
) -> Image.Image:
    if isinstance(back_template_path, Path) and not back_template_path.exists():
        return Image.new("RGB", (CARD_W, CARD_H), BG_COLOR)

    card = _load_card_template(back_template_path, CARD_W, CARD_H)
    draw = ImageDraw.Draw(card)

    # Secret key for QR code
    secret_key = os.getenv("QR_SECRET_KEY", "default-secret-key-for-qr")
    key = hashlib.sha256(secret_key.encode()).digest()
    fernet_key = base64.urlsafe_b64encode(key)
    f = Fernet(fernet_key)
    token = f.encrypt(employee_id.encode()).decode()

    # Generate QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=0,
    )
    qr.add_data(token)
    qr.make(fit=True)

    qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGBA")
    
    # Frontend: top-[23.5%], size 120px in a ~384px wide container
    # Ratio: 120 / 384 = 0.3125
    qw = int(CARD_W * 0.275)
    qh = qw
    qr_img = qr_img.resize((qw, qh), Image.LANCZOS)
    
    qx = (CARD_W - qw) // 2
    qy = int(CARD_H * 0.24)
    
    card.paste(qr_img, (qx, qy), qr_img)

    return card

CARD_L_W, CARD_L_H = CARD_H, CARD_W

def render_front_landscape(
    full_name: str,
    employee_id: str,
    role: str,
    photo_url: str,
    front_template_path: Union[Path, Image.Image],
    id_prefix: Optional[str] = None,
    consultant_prefix: Optional[str] = None,
    photo_x: int = 0,
    photo_y: int = 0,
    photo_scale: float = 1.0,
) -> Image.Image:
    card = _load_card_template(front_template_path, CARD_L_W, CARD_L_H)
    draw = ImageDraw.Draw(card)

    name_font = _load_font(int(CARD_L_H * 0.07), bold=True)
    id_font = _load_font(int(CARD_L_H * 0.06), bold=False)
    role_font = _load_font(int(CARD_L_H * 0.05), bold=False)

    # Photo container (matching UI 170x170 in 560px container)
    pw = int(CARD_L_W * (170.0 / 560.0)) 
    ph = pw  # Square container
    px = int(CARD_L_W * 0.09) # from left
    py = int(CARD_L_H * 0.25)
    
    # Border similar to UI: border-[8px]
    border = int(CARD_L_W * (8.0 / 560.0))
    radius = int(pw * 0.035)  # approximate rounded-md
    
    # Draw red border background block like render_front does
    draw.rounded_rectangle(
        (px - border, py - border, px + pw + border, py + ph + border),
        radius=radius + border,
        fill=RED
    )
    
    # Fill inner container with white
    draw.rounded_rectangle(
        (px, py, px + pw, py + ph),
        radius=radius,
        fill="white"
    )
    
    photo = _load_image_from_url_or_path(photo_url).convert("RGB")
    photo = ImageOps.exif_transpose(photo)

    w, h = photo.size
    aspect_photo = w / h
    aspect_frame = pw / ph

    if aspect_photo > aspect_frame:
        base_scale = ph / h
    else:
        base_scale = pw / w

    current_scale = base_scale * photo_scale
    new_w = int(w * current_scale)
    new_h = int(h * current_scale)
    photo = photo.resize((new_w, new_h), Image.LANCZOS)
    
    # Calculate scale to DPI (container width in UI is 170px)
    scale_to_dpi = pw / 170.0
    offset_x = int(photo_x * scale_to_dpi)
    offset_y = int(photo_y * scale_to_dpi)

    paste_x = px + (pw - new_w) // 2 + offset_x
    paste_y = py + (ph - new_h) // 2 + offset_y

    photo_layer = Image.new("RGBA", (CARD_L_W, CARD_L_H), (0, 0, 0, 0))
    photo_rgba = photo.convert("RGBA")
    photo_layer.paste(photo_rgba, (paste_x, paste_y))

    container_mask = Image.new("L", (CARD_L_W, CARD_L_H), 0)
    container_mask_draw = ImageDraw.Draw(container_mask)
    container_mask_draw.rounded_rectangle(
        (px, py, px + pw, py + ph),
        radius=radius,
        fill=255
    )

    photo_alpha = photo_layer.split()[3]
    final_mask = Image.new("L", (CARD_L_W, CARD_L_H), 0)
    final_mask.paste(photo_alpha, (0, 0), container_mask)
    card.paste(photo_layer, (0, 0), final_mask)
    
    # Name + ID + Role
    text_x = int(CARD_L_W * 0.42)
    text_y = int(CARD_L_H * 0.37)
    max_text_w = CARD_L_W - text_x - int(CARD_L_W * 0.03)  # right margin

    # Word-wrap the name so long names spill onto a second line
    name_upper = (full_name or "").upper()
    name_words = name_upper.split()
    name_lines = []
    current_line: list[str] = []
    for word in name_words:
        test = " ".join(current_line + [word])
        if draw.textlength(test, font=name_font) <= max_text_w:
            current_line.append(word)
        else:
            if current_line:
                name_lines.append(" ".join(current_line))
            current_line = [word]
    if current_line:
        name_lines.append(" ".join(current_line))

    line_h = int(name_font.size * 1.15)
    for i, line in enumerate(name_lines):
        draw.text((text_x, text_y + i * line_h), line, font=name_font, fill="#000000")

    name_block_h = len(name_lines) * line_h
    id_y = text_y + name_block_h + int(CARD_L_H * 0.03)
    e_id = (employee_id or '').strip()
    prefix_text = (id_prefix or "IR").strip() or "IR"
    final_role = (role or "").upper()
    id_text = f"{prefix_text} {e_id}"

    draw.text((text_x, id_y), id_text.upper(), font=id_font, fill="#000000")

    if final_role == "CONSULTANT" or final_role == "TRANSPORT ASSISTANT":
        role_y = id_y + id_font.size + int(CARD_L_H * 0.02)
        if final_role == "CONSULTANT" and consultant_prefix:
            display_role = f"{consultant_prefix} {final_role}"
        else:
            display_role = final_role
        draw.text((text_x, role_y), display_role.upper(), font=role_font, fill="#000000")

    return card

def render_back_landscape(
    employee_id: str,
    back_template_path: Union[Path, Image.Image],
    employment_start_date: Optional[date] = None,
    employment_end_date: Optional[date] = None,
) -> Image.Image:
    card = _load_card_template(back_template_path, CARD_L_W, CARD_L_H)

    secret_key = os.getenv("QR_SECRET_KEY", "default-secret-key-for-qr")
    key = hashlib.sha256(secret_key.encode()).digest()
    fernet_key = base64.urlsafe_b64encode(key)
    f = Fernet(fernet_key)
    token = f.encrypt(employee_id.encode()).decode()

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=0,
    )
    qr.add_data(token)
    qr.make(fit=True)

    qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGBA")
    
    qw = int(CARD_L_W * (85.5 / 560.0))
    qh = qw
    qr_img = qr_img.resize((qw, qh), Image.LANCZOS)
    
    qx_center = int(CARD_L_W * 0.155)
    qx = qx_center - (qw // 2)
    qy = int(CARD_L_H * 0.385)
    
    card.paste(qr_img, (qx, qy), qr_img)
    draw = ImageDraw.Draw(card)

    # Employment Dates
    if employment_start_date or employment_end_date:
        date_font = _load_font(int(CARD_L_H * 0.045), bold=False)
        date_x = int(CARD_L_W * 0.51)
        date_y_start = int(CARD_L_H * 0.59)
        
        if employment_start_date:
            start_str = employment_start_date.strftime("%d/%m/%Y")
            draw.text((date_x, date_y_start), start_str, font=date_font, fill="#1f2937")
        
        if employment_end_date:
            end_str = employment_end_date.strftime("%d/%m/%Y")
            # Draw below start date with small gap
            date_y_end = date_y_start + date_font.size + int(CARD_L_H * 0.01)
            draw.text((date_x, date_y_end), end_str, font=date_font, fill="#1f2937")

    return card
