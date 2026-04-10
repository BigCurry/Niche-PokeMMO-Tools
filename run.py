import json

# Input and output file paths
input_file = "abilities-data.json"
output_file = "filtered-abilities.json"

# Load original JSON
with open(input_file, "r", encoding="utf-8") as f:
    data = json.load(f)

# Process data
filtered_data = {}

for ability_key, ability in data.items():
    filtered_data[ability_key] = {
        "id": ability.get("id"),
        "name": ability.get("name"),
        "effect": {
            "battle": ability.get("effect"),
            "overworld": None
        },
        "pokemon_with_ability": ability.get("pokemon_with_ability", [])
    }

# Save new JSON
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(filtered_data, f, indent=4, ensure_ascii=False)

print(f"Filtered data saved to {output_file}")