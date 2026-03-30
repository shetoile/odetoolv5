from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
ICON_SOURCE = ROOT / "src-tauri" / "icons" / "icon.png"
ICON_DIR = ROOT / "src-tauri" / "icons"


def hex_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def build_vertical_gradient(size: tuple[int, int], top: str, bottom: str) -> Image.Image:
    width, height = size
    top_rgb = hex_rgb(top)
    bottom_rgb = hex_rgb(bottom)
    image = Image.new("RGBA", size)
    pixels = image.load()
    for y in range(height):
        ratio = y / max(1, height - 1)
        color = tuple(round(top_rgb[i] * (1 - ratio) + bottom_rgb[i] * ratio) for i in range(3))
        for x in range(width):
            pixels[x, y] = (*color, 255)
    return image


def add_radial_glow(
    background: Image.Image,
    bbox: tuple[int, int, int, int],
    color: str,
    blur_radius: int,
    alpha: int,
) -> None:
    overlay = Image.new("RGBA", background.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.ellipse(bbox, fill=(*hex_rgb(color), alpha))
    overlay = overlay.filter(ImageFilter.GaussianBlur(blur_radius))
    background.alpha_composite(overlay)


def paste_icon(
    background: Image.Image,
    size: int,
    offset: tuple[int, int],
    *,
    glow_color: str = "#4ad7ff",
    glow_alpha: int = 130,
) -> None:
    icon = Image.open(ICON_SOURCE).convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)
    alpha_mask = icon.getchannel("A")
    glow = Image.new("RGBA", icon.size, (*hex_rgb(glow_color), 0))
    glow.putalpha(alpha_mask)
    for blur_radius, alpha_scale in ((22, 1.0), (12, 0.65), (5, 0.45)):
        blurred = glow.copy()
        blurred.putalpha(alpha_mask.point(lambda px: int(px * glow_alpha / 255 * alpha_scale)))
        blurred = blurred.filter(ImageFilter.GaussianBlur(blur_radius))
        background.alpha_composite(blurred, dest=offset)
    background.paste(icon, offset, icon)


def save_bmp(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(path, format="BMP")


def add_frame(
    background: Image.Image,
    outer: tuple[int, int, int, int],
    inner: tuple[int, int, int, int],
    *,
    radius_outer: int,
    radius_inner: int,
) -> None:
    glow = Image.new("RGBA", background.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.rounded_rectangle(outer, radius=radius_outer, outline=(*hex_rgb("#2fd4ff"), 255), width=2)
    glow = glow.filter(ImageFilter.GaussianBlur(8))
    background.alpha_composite(glow)

    draw = ImageDraw.Draw(background)
    draw.rounded_rectangle(outer, radius=radius_outer, outline=hex_rgb("#62e7ff"), width=2)
    draw.rounded_rectangle(inner, radius=radius_inner, outline=hex_rgb("#0f4268"), width=1)


def add_scan_lines(background: Image.Image, top: int, bottom: int, spacing: int, color: str, alpha: int) -> None:
    overlay = Image.new("RGBA", background.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for y in range(top, bottom, spacing):
        draw.line((14, y, background.size[0] - 14, y), fill=(*hex_rgb(color), alpha), width=1)
    background.alpha_composite(overlay)


def main() -> None:
    nsis_header = build_vertical_gradient((150, 57), "#071f33", "#03131f")
    add_radial_glow(nsis_header, (56, -8, 156, 72), "#18bfff", 22, 95)
    add_scan_lines(nsis_header, 8, 54, 6, "#0d3550", 40)
    paste_icon(nsis_header, 40, (10, 8), glow_alpha=120)
    header_draw = ImageDraw.Draw(nsis_header)
    header_draw.line((0, 55, 150, 55), fill=hex_rgb("#144565"), width=1)
    header_draw.line((0, 56, 150, 56), fill=hex_rgb("#3bcfff"), width=1)
    save_bmp(nsis_header, ICON_DIR / "nsis-header.bmp")

    nsis_sidebar = build_vertical_gradient((164, 314), "#061f34", "#021019")
    add_radial_glow(nsis_sidebar, (-6, 18, 170, 182), "#1bc6ff", 28, 115)
    add_radial_glow(nsis_sidebar, (24, 196, 152, 288), "#0c5d8b", 32, 80)
    add_scan_lines(nsis_sidebar, 34, 300, 10, "#0d2d47", 34)
    add_frame(
        nsis_sidebar,
        (17, 21, 147, 151),
        (27, 31, 137, 141),
        radius_outer=26,
        radius_inner=22,
    )
    paste_icon(nsis_sidebar, 114, (25, 29), glow_alpha=150)
    sidebar_draw = ImageDraw.Draw(nsis_sidebar)
    sidebar_draw.line((22, 182, 142, 182), fill=hex_rgb("#16415d"), width=1)
    sidebar_draw.line((30, 250, 134, 250), fill=hex_rgb("#0f3855"), width=1)
    save_bmp(nsis_sidebar, ICON_DIR / "nsis-sidebar.bmp")

    wix_banner = build_vertical_gradient((493, 58), "#071f33", "#03131f")
    add_radial_glow(wix_banner, (290, -60, 520, 120), "#20c8ff", 30, 105)
    add_scan_lines(wix_banner, 8, 54, 7, "#0d3550", 34)
    paste_icon(wix_banner, 42, (18, 8), glow_alpha=120)
    wix_banner_draw = ImageDraw.Draw(wix_banner)
    wix_banner_draw.line((0, 56, 493, 56), fill=hex_rgb("#3bcfff"), width=1)
    save_bmp(wix_banner, ICON_DIR / "wix-banner.bmp")

    wix_dialog = build_vertical_gradient((493, 312), "#061f34", "#021019")
    add_radial_glow(wix_dialog, (70, 16, 430, 290), "#19c8ff", 42, 110)
    add_scan_lines(wix_dialog, 42, 286, 12, "#0c2b43", 26)
    add_frame(
        wix_dialog,
        (142, 44, 350, 252),
        (156, 58, 336, 238),
        radius_outer=36,
        radius_inner=28,
    )
    paste_icon(wix_dialog, 176, (158, 60), glow_alpha=150)
    save_bmp(wix_dialog, ICON_DIR / "wix-dialog.bmp")

    print("Wrote installer branding assets")


if __name__ == "__main__":
    main()
