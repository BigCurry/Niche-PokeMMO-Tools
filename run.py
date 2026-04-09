import json

# Input and output file paths
INPUT_FILE = "monsters.json"
OUTPUT_FILE = "dex_compatibility.json"

def transform_data(data):
    result = []

    for entry in data:
        new_entry = {
            "id": entry["id"],
            "name": entry["name"],
            "PokeAPI_id": entry["id"],
            "PokeAPI_name": entry["name"],
            "Pokemondb_name": entry["name"],
            "frontend_name": entry["name"],
        }
        result.append(new_entry)

    return result

def main():
    # Load original JSON
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Transform data
    new_data = transform_data(data)

    # Save new JSON
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(new_data, f, indent=2)

    print(f"Saved transformed data to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()