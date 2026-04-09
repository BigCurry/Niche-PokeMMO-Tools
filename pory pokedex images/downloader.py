import os
import urllib.request

BASE_URL = "https://team-porygon-pokemmo.pages.dev/images/pokedex/Pokedex_{id}.png"
SAVE_DIR = "pokedex_images"

os.makedirs(SAVE_DIR, exist_ok=True)

headers = {
    "User-Agent": "Mozilla/5.0"
}

for i in range(50, 661):
    poke_id = f"{i:03d}"
    url = BASE_URL.format(id=poke_id)
    filepath = os.path.join(SAVE_DIR, f"Pokedex_{poke_id}.png")

    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response, open(filepath, "wb") as f:
            f.write(response.read())

        print(f"Downloaded {poke_id}")

    except Exception as e:
        print(f"Error at {poke_id}: {e}")
        raise  # stop immediately