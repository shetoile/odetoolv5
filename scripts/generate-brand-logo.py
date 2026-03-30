from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE_LOGO = ROOT / "public" / "ode-logo-base.png"
OUTPUT_GLOW_LOGO = ROOT / "public" / "ode-logo.png"
OUTPUT_UI_LOGO = ROOT / "public" / "ode-logo-ui.png"

CANVAS_SIZE = 460
LOGO_SCALE = 0.86
UI_CANVAS_SIZE = 240
UI_LOGO_SCALE = 0.94


def color_layer(alpha: Image.Image, rgb: tuple[int, int, int], opacity: int = 255) -> Image.Image:
    layer = Image.new("RGBA", alpha.size, (*rgb, opacity))
    layer.putalpha(ImageChops.multiply(alpha, Image.new("L", alpha.size, opacity)))
    return layer


def crop_to_visible(image: Image.Image, margin: int) -> Image.Image:
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        raise RuntimeError(f"No visible pixels found in {SOURCE_LOGO}")
    left = max(0, bbox[0] - margin)
    top = max(0, bbox[1] - margin)
    right = min(image.width, bbox[2] + margin)
    bottom = min(image.height, bbox[3] + margin)
    return image.crop((left, top, right, bottom))


def resize_logo(image: Image.Image, canvas_size: int, scale_ratio: float) -> Image.Image:
    target_width = int(canvas_size * scale_ratio)
    scale = target_width / image.width
    return image.resize(
        (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
        Image.Resampling.LANCZOS,
    )


def crop_canvas_to_visible(image: Image.Image, margin: int) -> Image.Image:
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        raise RuntimeError("Generated logo is empty")
    return image.crop(
        (
            max(0, bbox[0] - margin),
            max(0, bbox[1] - margin),
            min(image.width, bbox[2] + margin),
            min(image.height, bbox[3] + margin),
        )
    )


def build_glow_logo(source: Image.Image) -> Image.Image:
    cropped = crop_to_visible(source, margin=0)
    resized = resize_logo(cropped, CANVAS_SIZE, LOGO_SCALE)

    logo_alpha = resized.getchannel("A")
    thick_alpha = logo_alpha.filter(ImageFilter.MaxFilter(9))
    glow_far = color_layer(thick_alpha.filter(ImageFilter.GaussianBlur(42)), (72, 210, 255), 180)
    glow_mid = color_layer(thick_alpha.filter(ImageFilter.GaussianBlur(20)), (59, 197, 255), 216)
    glow_near = color_layer(thick_alpha.filter(ImageFilter.GaussianBlur(8)), (45, 188, 255), 236)
    edge = color_layer(thick_alpha, (26, 190, 255), 255)
    inner = color_layer(logo_alpha, (86, 216, 255), 228)

    canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    offset = ((CANVAS_SIZE - resized.width) // 2, (CANVAS_SIZE - resized.height) // 2)
    canvas.alpha_composite(glow_far, offset)
    canvas.alpha_composite(glow_mid, offset)
    canvas.alpha_composite(glow_near, offset)
    canvas.alpha_composite(edge, offset)
    canvas.alpha_composite(inner, offset)
    canvas.alpha_composite(resized.filter(ImageFilter.UnsharpMask(radius=1.2, percent=170, threshold=2)), offset)

    particles = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(particles)
    for x, y, size, alpha in [
        (58, 314, 14, 180),
        (92, 372, 24, 154),
        (136, 404, 18, 128),
        (370, 88, 26, 142),
        (398, 56, 20, 116),
    ]:
        draw.ellipse((x, y, x + size, y + size), fill=(63, 197, 255, alpha))
    particles = particles.filter(ImageFilter.GaussianBlur(1.2))
    canvas.alpha_composite(particles)

    return crop_canvas_to_visible(canvas, margin=12)


def build_ui_logo(source: Image.Image) -> Image.Image:
    cropped = crop_to_visible(source, margin=3)
    resized = resize_logo(cropped, UI_CANVAS_SIZE, UI_LOGO_SCALE)
    alpha = resized.getchannel("A")

    canvas = Image.new("RGBA", (UI_CANVAS_SIZE, UI_CANVAS_SIZE), (0, 0, 0, 0))
    offset = ((UI_CANVAS_SIZE - resized.width) // 2, (UI_CANVAS_SIZE - resized.height) // 2)

    halo_alpha = alpha.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(2.4))
    edge_alpha = alpha.filter(ImageFilter.MaxFilter(3))
    halo = color_layer(halo_alpha, (73, 204, 255), 108)
    edge = color_layer(edge_alpha, (55, 198, 255), 92)
    crisp = resized.filter(ImageFilter.UnsharpMask(radius=0.9, percent=180, threshold=2))

    canvas.alpha_composite(halo, offset)
    canvas.alpha_composite(edge, offset)
    canvas.alpha_composite(crisp, offset)
    return crop_canvas_to_visible(canvas, margin=4)


def main() -> None:
    source = Image.open(SOURCE_LOGO).convert("RGBA")
    glow_logo = build_glow_logo(source)
    ui_logo = build_ui_logo(source)

    OUTPUT_GLOW_LOGO.parent.mkdir(parents=True, exist_ok=True)
    glow_logo.save(OUTPUT_GLOW_LOGO)
    ui_logo.save(OUTPUT_UI_LOGO)
    print(f"Wrote {OUTPUT_GLOW_LOGO}")
    print(f"Wrote {OUTPUT_UI_LOGO}")


if __name__ == "__main__":
    main()
