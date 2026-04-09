import os
from PIL import Image
from concurrent.futures import ThreadPoolExecutor, as_completed

INPUT_DIR = "pokedex_images"
OUTPUT_DIR = "pokedex_webp"
MAX_WORKERS = 10  # adjust based on CPU (8–16 is usually good)

os.makedirs(OUTPUT_DIR, exist_ok=True)

def convert(filename):
    if not filename.lower().endswith(".png"):
        return

    input_path = os.path.join(INPUT_DIR, filename)
    output_path = os.path.join(
        OUTPUT_DIR,
        os.path.splitext(filename)[0] + ".webp"
    )

    try:
        with Image.open(input_path) as img:
            img.save(
                output_path,
                "WEBP",
                quality=80,
                method=6
            )
        return f"Converted: {filename}"

    except Exception as e:
        raise RuntimeError(f"Error: {filename} -> {e}")


files = os.listdir(INPUT_DIR)

with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
    futures = [executor.submit(convert, f) for f in files]

    for future in as_completed(futures):
        result = future.result()  # will raise if any thread failed
        if result:
            print(result)