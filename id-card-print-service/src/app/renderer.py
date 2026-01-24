from PIL import Image, ImageDraw, ImageFont, ImageOps
from pathlib import Path
import io
import httpx

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
    bottom_icon_path: Path,
) -> Image.Image:
    card = Image.new("RGB", (CARD_W, CARD_H), BG_COLOR)
    draw = ImageDraw.Draw(card)

    name_font = _load_font(int(CARD_W * 0.07), bold=True)
    id_font = _load_font(int(CARD_W * 0.052), bold=True)

    # Logo (top centered)
    logo = Image.open(logo_path).convert("RGBA")
    logo_w = int(CARD_W * 0.7)
    logo_h = int(logo.height * (logo_w / logo.width))
    logo = logo.resize((logo_w, logo_h), Image.LANCZOS)
    logo_x = (CARD_W - logo_w) // 2
    logo_y = int(CARD_H * 0.01)
    card.paste(logo, (logo_x, logo_y), logo)

    # Photo with red rounded border
    pw = int(CARD_W * 0.6)
    ph = pw
    px = (CARD_W - pw) // 2
    py = int(CARD_H * 0.30)
    border = max(12, int(pw * 0.04))
    inner_radius = int(pw * 0.03)
    outer_radius = inner_radius + border

    draw.rounded_rectangle(
        (px - border, py - border, px + pw + border, py + ph + border),
        radius=outer_radius,
        fill=RED,
    )

    photo = _load_image_from_url_or_path(photo_url)
    photo = _rounded_image(photo, (pw, ph), radius=inner_radius)
    card.paste(photo, (px, py), photo)

    # Name + ID
    name_y = py + ph + int(CARD_H * 0.07)
    id_y = name_y + int(CARD_H * 0.09)
    _draw_center_text(draw, (full_name or "").upper(), name_y, name_font, DARK_GRAY)
    _draw_center_text(draw, (employee_id or "").strip(), id_y, id_font, DARK_GRAY)

    # Bottom icon (centered)
    icon = Image.open(bottom_icon_path).convert("RGBA")
    icon_w = int(CARD_W * 0.72)
    icon_h = int(icon.height * (icon_w / icon.width))
    icon = icon.resize((icon_w, icon_h), Image.LANCZOS)
    icon_x = (CARD_W - icon_w) // 2
    icon_y = int(CARD_H * 0.90)
    card.paste(icon, (icon_x, icon_y), icon)

    return card


def render_back(
    logo_path: Path,
    department_line1: str = "HCM Group",
    department_line2: str = "NRS Headquarters",
    phone_left: str = "0907 211 1111",
    phone_right: str = "0907 444 4441",
    email: str = "lostcard@nrs.gov.ng",
) -> Image.Image:
    card = Image.new("RGB", (CARD_W, CARD_H), BG_COLOR)
    draw = ImageDraw.Draw(card)

    # Fonts (tuned to your sample)
    logo_scale = 0.62
    title_font   = _load_font(int(CARD_W * 0.040), bold=True)   # Nigeria Revenue Service
    body_font    = _load_font(int(CARD_W * 0.040), bold=True)  # helper text
    contact_font = _load_font(int(CARD_W * 0.040), bold=True)   # phone/email
    band_font    = _load_font(int(CARD_W * 0.045), bold=True)   # band text

    # --- Logo (top centered) ---
    logo = Image.open(logo_path).convert("RGBA")
    logo_w = int(CARD_W * logo_scale)
    logo_h = int(logo.height * (logo_w / logo.width))
    logo = logo.resize((logo_w, logo_h), Image.LANCZOS)
    logo_x = (CARD_W - logo_w) // 2
    logo_y = int(CARD_H * 0.07)
    card.paste(logo, (logo_x, logo_y), logo)

    # --- Text block (centered) ---
    y = int(CARD_H * 0.38)
    _draw_center_text(draw, "This is a property of", y, body_font, DARK_GRAY)
    y += int(CARD_H * 0.050)
    _draw_center_text(draw, "Nigeria Revenue Service", y, title_font, DARK_GRAY)

    y += int(CARD_H * 0.090)
    _draw_center_text(draw, "If found, please return to any", y, body_font, LIGHT_GRAY)
    y += int(CARD_H * 0.040)
    _draw_center_text(draw, "NRS office or contact below:", y, body_font, LIGHT_GRAY)

    # --- Contacts (icon + text) ---
    y += int(CARD_H * 0.095)

    icon_r = int(CARD_W * 0.020)
    icon_x = int(CARD_W * 0.20)
    text_center_x = int(CARD_W * 0.58)

    def red_circle(cx: int, cy: int):
        draw.ellipse((cx - icon_r, cy - icon_r, cx + icon_r, cy + icon_r), fill=RED)

    # phone line
    phone_y = y
    red_circle(icon_x, phone_y)
    phones = f"{phone_left}; {phone_right}"
    draw.text((text_center_x, phone_y), phones, font=contact_font, fill=DARK_GRAY, anchor="mm")

    # email line
    email_y = y + int(CARD_H * 0.070)
    red_circle(icon_x, email_y)
    draw.text((text_center_x - int(CARD_W * 0.08), email_y), email, font=contact_font, fill=DARK_GRAY, anchor="mm")

    # --- Bottom red band ---
    band_h = int(CARD_H * 0.16)
    band_y0 = int(CARD_H * 0.78)
    band_y1 = band_y0 + band_h
    draw.rectangle((0, band_y0, CARD_W, band_y1), fill=RED)

    # band text (centered)
    band_text_y1 = band_y0 + int(band_h * 0.28)
    band_text_y2 = band_y0 + int(band_h * 0.62)
    _draw_center_text(draw, department_line1, band_text_y1, band_font, "white")
    _draw_center_text(draw, department_line2, band_text_y2, band_font, "white")

    return card
