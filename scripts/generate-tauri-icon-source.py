from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE_LOGO = ROOT / "public" / "ode-logo-base.png"
OUTPUT_ICON = ROOT / "src-tauri" / "app-icon-source.png"

CANVAS_SIZE = 1024
BADGE_SIZE = 956
BADGE_RADIUS = 248
BADGE_INSET = (CANVAS_SIZE - BADGE_SIZE) // 2
LOGO_MAX_SIZE = (908, 700)
LOGO_ALPHA_THRESHOLD = 24
LOGO_UPSCALE_FACTOR = 10


def build_vertical_gradient(size: tuple[int, int], top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    width, height = size
    gradient = Image.new("RGBA", size, (0, 0, 0, 0))
    pixels = gradient.load()
    for y in range(height):
        ratio = y / max(1, height - 1)
        color = tuple(round(top[i] * (1 - ratio) + bottom[i] * ratio) for i in range(3))
        for x in range(width):
            pixels[x, y] = (*color, 255)
    return gradient


def make_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def crop_to_visible(image: Image.Image, margin: int = 0) -> Image.Image:
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        raise RuntimeError(f"No visible pixels found in {SOURCE_LOGO}")
    left = max(0, bbox[0] - margin)
    top = max(0, bbox[1] - margin)
    right = min(image.width, bbox[2] + margin)
    bottom = min(image.height, bbox[3] + margin)
    return image.crop((left, top, right, bottom))


def color_layer(alpha: Image.Image, rgb: tuple[int, int, int], opacity: int = 255) -> Image.Image:
    layer = Image.new("RGBA", alpha.size, (*rgb, opacity))
    layer.putalpha(ImageChops.multiply(alpha, Image.new("L", alpha.size, opacity)))
    return layer


def fit_within(image: Image.Image, max_size: tuple[int, int]) -> Image.Image:
    width, height = image.size
    max_width, max_height = max_size
    scale = min(max_width / width, max_height / height)
    return image.resize(
        (max(1, round(width * scale)), max(1, round(height * scale))),
        Image.Resampling.LANCZOS,
    )


def prepare_logo_source(image: Image.Image) -> Image.Image:
    cropped = crop_to_visible(image, margin=0)
    alpha = cropped.getchannel("A").point(lambda value: 255 if value >= LOGO_ALPHA_THRESHOLD else 0)
    upscaled_alpha = alpha.resize(
        (alpha.width * LOGO_UPSCALE_FACTOR, alpha.height * LOGO_UPSCALE_FACTOR),
        Image.Resampling.NEAREST,
    ).filter(ImageFilter.GaussianBlur(0.85))
    prepared = Image.new("RGBA", upscaled_alpha.size, (78, 220, 255, 0))
    prepared.putalpha(upscaled_alpha)
    return prepared


def main() -> None:
    image = Image.open(SOURCE_LOGO).convert("RGBA")
    canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    badge_gradient = build_vertical_gradient(
        (BADGE_SIZE, BADGE_SIZE),
        (10, 51, 83),
        (2, 18, 33),
    )
    badge_mask = make_mask((BADGE_SIZE, BADGE_SIZE), BADGE_RADIUS)
    badge_gradient.putalpha(ImageChops.multiply(badge_mask, Image.new("L", badge_mask.size, 248)))

    badge_shell = Image.new("RGBA", (BADGE_SIZE, BADGE_SIZE), (0, 0, 0, 0))
    badge_shell.alpha_composite(badge_gradient, (0, 0))

    border = Image.new("RGBA", (BADGE_SIZE, BADGE_SIZE), (0, 0, 0, 0))
    border_draw = ImageDraw.Draw(border)
    border_draw.rounded_rectangle(
        (6, 6, BADGE_SIZE - 7, BADGE_SIZE - 7),
        radius=BADGE_RADIUS,
        outline=(92, 224, 255, 246),
        width=10,
    )
    badge_shell.alpha_composite(border)

    inner_rim = Image.new("RGBA", (BADGE_SIZE, BADGE_SIZE), (0, 0, 0, 0))
    inner_rim_draw = ImageDraw.Draw(inner_rim)
    inner_rim_draw.rounded_rectangle(
        (20, 20, BADGE_SIZE - 21, BADGE_SIZE - 21),
        radius=BADGE_RADIUS - 16,
        outline=(10, 56, 92, 224),
        width=3,
    )
    badge_shell.alpha_composite(inner_rim)

    glow = Image.new("RGBA", (BADGE_SIZE + 48, BADGE_SIZE + 48), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.rounded_rectangle(
        (24, 24, BADGE_SIZE + 23, BADGE_SIZE + 23),
        radius=BADGE_RADIUS + 10,
        outline=(38, 175, 255, 72),
        width=8,
    )
    glow = glow.filter(ImageFilter.GaussianBlur(6))

    badge_offset = (BADGE_INSET, BADGE_INSET)
    glow_offset = ((CANVAS_SIZE - glow.width) // 2, (CANVAS_SIZE - glow.height) // 2)
    canvas.alpha_composite(glow, glow_offset)
    canvas.alpha_composite(badge_shell, badge_offset)

    highlight = Image.new("RGBA", (BADGE_SIZE, BADGE_SIZE), (0, 0, 0, 0))
    highlight_draw = ImageDraw.Draw(highlight)
    highlight_draw.ellipse(
        (BADGE_SIZE * 0.12, BADGE_SIZE * 0.1, BADGE_SIZE * 0.88, BADGE_SIZE * 0.44),
        fill=(97, 226, 255, 34),
    )
    highlight = highlight.filter(ImageFilter.GaussianBlur(18))
    canvas.alpha_composite(highlight, badge_offset)

    prepared_logo = prepare_logo_source(image)
    resized = fit_within(prepared_logo, LOGO_MAX_SIZE)

    logo_alpha = resized.getchannel("A")
    thick_alpha = logo_alpha.filter(ImageFilter.MaxFilter(5))
    logo_glow = color_layer(thick_alpha.filter(ImageFilter.GaussianBlur(3.2)), (54, 206, 255), 96)
    logo_shadow = color_layer(thick_alpha.filter(ImageFilter.GaussianBlur(2.2)), (0, 13, 25), 148)
    thick_fill = color_layer(thick_alpha, (34, 198, 255), 242)
    edge_fill = color_layer(logo_alpha, (171, 241, 255), 255)

    logo_shell = Image.new("RGBA", resized.size, (0, 0, 0, 0))
    logo_shell.alpha_composite(logo_shadow, (0, 4))
    logo_shell.alpha_composite(logo_glow, (0, 0))
    logo_shell.alpha_composite(thick_fill, (0, 0))
    logo_shell.alpha_composite(edge_fill, (0, 0))
    logo_shell.alpha_composite(resized.filter(ImageFilter.UnsharpMask(radius=0.8, percent=240, threshold=1)), (0, 0))

    logo_offset = (
        (CANVAS_SIZE - logo_shell.width) // 2,
        (CANVAS_SIZE - logo_shell.height) // 2 + 2,
    )
    canvas.alpha_composite(logo_shell, logo_offset)
    canvas.save(OUTPUT_ICON)

    print(f"Wrote {OUTPUT_ICON}")
    print(f"Visible size: {logo_shell.width}x{logo_shell.height} on {CANVAS_SIZE}x{CANVAS_SIZE}")


if __name__ == "__main__":
    main()
