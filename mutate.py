import json

# Define the file path
file_path = "dex_compatibility.json"
added_field = "hidden_ability"
field_value = "false"

try:
    # 1. Load the existing JSON data
    with open(file_path, "r", encoding="utf-8") as file:
        items = json.load(file)

    # 2. Iterate through the list and add the base_price field
    for item in items:
        # Using setdefault ensures we don't overwrite it if it already exists
        item.setdefault(added_field, field_value)

    # 3. Write the updated data back to the file
    with open(file_path, "w", encoding="utf-8") as file:
        # indent=4 keeps the nice, readable formatting
        json.dump(items, file, indent=2, ensure_ascii=False)

    print(f"Successfully added {added_field} to all items in {file_path}!")

except FileNotFoundError:
    print(f"Error: The file {file_path} was not found.")
except json.JSONDecodeError:
    print("Error: Failed to decode JSON. Make sure the file is valid JSON.")