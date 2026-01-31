from PIL import Image, ImageDraw, ImageFont, ImageOps
from pathlib import Path
import io
import os
import httpx
import qrcode
import hashlib
import base64
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

def _load_image_from_url_or_path(photo_url: str) -> Image.Image:
    if photo_url.startswith("http://") or photo_url.startswith("https://"):
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
    logo_path: Path,
    bottom_accent_path: Path,
    photo_x: int = 0,
    photo_y: int = 0,
    photo_scale: float = 1.0,
) -> Image.Image:
    card = Image.new("RGB", (CARD_W, CARD_H), BG_COLOR)
    draw = ImageDraw.Draw(card)

    name_font = _load_font(int(CARD_W * 0.07), bold=True)
    id_font = _load_font(int(CARD_W * 0.052), bold=True)

    # Logo (top centered)
    logo = Image.open(logo_path).convert("RGBA")
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
    id_y = name_y + int(CARD_H * 0.15)
    _draw_center_text(draw, (full_name or "").upper(), name_y, name_font, "#000000")
    _draw_center_text(draw, f"IR {(employee_id or '').strip()}", id_y, id_font, DARK_GRAY)

       # Bottom icon (centered)
    icon = Image.open(bottom_accent_path).convert("RGBA")
    icon_w = int(CARD_W * 0.52)
    icon_h = int(icon.height * (icon_w / icon.width))
    icon = icon.resize((icon_w, icon_h), Image.LANCZOS)
    icon_x = (CARD_W - icon_w) // 2
    icon_y = int(CARD_H * 0.87)
    card.paste(icon, (icon_x, icon_y), icon)

    return card

def render_back(
    employee_id: str,
    back_template_path: Path,
) -> Image.Image:
    if not back_template_path.exists():
        # Fallback to empty white card if template missing
        return Image.new("RGB", (CARD_W, CARD_H), BG_COLOR)

    card = Image.open(back_template_path).convert("RGB")
    card = card.resize((CARD_W, CARD_H), Image.LANCZOS)
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
