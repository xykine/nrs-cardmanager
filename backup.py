from PIL import Image, ImageDraw, ImageFont, ImageOps
from pathlib import Path
import io
import httpx

# CR80 (2.125" x 3.375") @ 300dpi, portrait
DPI = 300

def _inch_to_px(inches: float) -> int:
    return int((inches * DPI) + 0.5)

CARD_W, CARD_H = _inch_to_px(2.125), _inch_to_px(3.375)

BG_COLOR = "#F2F2F2"
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

    name_font = _load_font(int(CARD_W * 0.05), bold=True)
    id_font = _load_font(int(CARD_W * 0.032), bold=False)

    # Logo (top centered)
    logo = Image.open(logo_path).convert("RGBA")
    logo_w = int(CARD_W * 0.7)
    logo_h = int(logo.height * (logo_w / logo.width))
    logo = logo.resize((logo_w, logo_h), Image.LANCZOS)
    logo_x = (CARD_W - logo_w) // 2
    logo_y = int(CARD_H * 0.02)
    card.paste(logo, (logo_x, logo_y), logo)

    # Photo with red rounded border
    pw = int(CARD_W * 0.6)
    ph = pw
    px = (CARD_W - pw) // 2
    py = int(CARD_H * 0.3)
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
    name_y = py + ph + int(CARD_H * 0.06)
    id_y = name_y + int(CARD_H * 0.04)
    _draw_center_text(draw, (full_name or "").upper(), name_y, name_font, DARK_GRAY)
    _draw_center_text(draw, (employee_id or "").strip(), id_y, id_font, DARK_GRAY)

    # Bottom icon (centered)
    icon = Image.open(bottom_icon_path).convert("RGBA")
    icon_w = int(CARD_W * 0.72)
    icon_h = int(icon.height * (icon_w / icon.width))
    icon = icon.resize((icon_w, icon_h), Image.LANCZOS)
    icon_x = (CARD_W - icon_w) // 2
    icon_y = int(CARD_H * 0.88)
    card.paste(icon, (icon_x, icon_y), icon)

    return card
