import json

def extract_moves(input_file, output_file):
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    moves_dict = {}

    for monster in data:
        for move in monster.get("moves", []):
            move_id = move.get("id")
            move_name = move.get("name")

            if move_name not in moves_dict:
                moves_dict[move_name] = {
                    "id": move_id,
                    "name": move_name,
                    "info": None,
                    "modifiers": [None],
                    "TM": None,
                    "Vendor": None,
                    "Price": {
                        "yen": None,
                        "bp": None,
                        "hs": None
                    }
                }

    # Sort by id
    sorted_moves = dict(
        sorted(moves_dict.items(), key=lambda item: item[1]["id"])
    )

    # Write sorted dictionary directly
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(sorted_moves, f, indent=4)


# Usage
extract_moves("monsters.json", "moves_extracted.json")