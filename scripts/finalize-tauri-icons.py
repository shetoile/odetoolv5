from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src-tauri" / "icons" / "icon.png"
ICO_PATH = ROOT / "src-tauri" / "icons" / "icon.ico"


def main() -> None:
    image = Image.open(SOURCE).convert("RGBA")
    sizes = [
        (16, 16),
        (20, 20),
        (24, 24),
        (32, 32),
        (40, 40),
        (48, 48),
        (64, 64),
        (72, 72),
        (96, 96),
        (128, 128),
        (256, 256),
    ]
    image.save(ICO_PATH, format="ICO", sizes=sizes)
    print(f"Wrote {ICO_PATH} with sizes: {', '.join(f'{w}x{h}' for w, h in sizes)}")


if __name__ == "__main__":
    main()
