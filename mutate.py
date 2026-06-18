import json

# Define the file path
file_path = "dex_compatibility.json"

# Define the new object field and its dictionary value
added_field = "balls"
field_value = {
    "cherish": "true",
    "dive": "false",
    "dream": "false",
    "dusk": "true",
    "fast": "false",
    "friend": "false",
    "great": "true",
    "heal": "true",
    "heavy": "false",
    "level": "true",
    "love": "true",
    "lure": "false",
    "luxury": "true",
    "master": "true",
    "moon": "false",
    "nest": "false",
    "net": "false",
    "poke": "true",
    "premier": "true",
    "quick": "true",
    "repeat": "true",
    "safari": "false",
    "timer": "true",
    "ultra": "true"
}

try:
    # 1. Load the existing JSON data
    with open(file_path, "r", encoding="utf-8") as file:
        items = json.load(file)

    # 2. Iterate through the data structure and replace the field value
    # Handled both JSON formats (List of objects OR Dictionary of objects)
    if isinstance(items, list):
        for item in items:
            if isinstance(item, dict):
                # Direct assignment forces a replacement if the key already exists
                item[added_field] = field_value
    elif isinstance(items, dict):
        for key, item in items.items():
            if isinstance(item, dict):
                # Direct assignment forces a replacement if the key already exists
                item[added_field] = field_value

    # 3. Write the updated data back to the file
    with open(file_path, "w", encoding="utf-8") as file:
        json.dump(items, file, indent=2, ensure_ascii=False)

    print(f"Successfully updated '{added_field}' object across all items in {file_path}!")

except FileNotFoundError:
    print(f"Error: The file {file_path} was not found.")
except json.JSONDecodeError:
    print("Error: Failed to decode JSON. Make sure the file is valid JSON.")