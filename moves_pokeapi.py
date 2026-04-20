import urllib.request
import json
import time

BASE_URL = "https://pokeapi.co/api/v2/move?limit=559"


def fetch_json(url):
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0"
        }
    )

    with urllib.request.urlopen(req) as response:
        data = response.read().decode("utf-8")
        return json.loads(data)


def get_all_moves():
    data = fetch_json(BASE_URL)
    return data["results"]


def get_move_details(url):
    data = fetch_json(url)

    return {
        "id": data["id"],
        "name": data["name"],
        "info":{
            "type": data["type"]["name"] if data["type"] else None,
            "power": data["power"],
            "pp": data["pp"],
            "accuracy": data["accuracy"],
            "priority": data["priority"],
            "damage_class": data["damage_class"]["name"] if data["damage_class"] else None,
            "effect_chance": data["effect_chance"],
            "effect": (
                data["effect_entries"][1]["effect"]
                if data.get("effect_entries")
                else None
            ),
            "short_effect": (
                data["effect_entries"][1]["short_effect"]
                if data.get("effect_entries")
                else None
            )
        },
        "modifiers": [None],
        "TM": None,
        "Vendor": None,
        "Price": {
            "yen": None,
            "bp": None,
            "hs": None
        }
    }


def main():
    moves = get_all_moves()
    moves_dict = {}

    for i, move in enumerate(moves, 1):
        try:
            details = get_move_details(move["url"])
            moves_dict[details["name"]] = details

            print(f"[{i}/{len(moves)}] Fetched: {details['name']}")

            time.sleep(0.01)  # prevent rate limit
        except Exception as e:
            print(f"Failed: {move['name']} -> {e}")

    # sort by ID
    sorted_moves = dict(sorted(moves_dict.items(), key=lambda x: x[1]["id"]))

    with open("moves_extracted.json", "w", encoding="utf-8") as f:
        json.dump(sorted_moves, f, indent=4)


if __name__ == "__main__":
    main()