import json
import os

def update_hidden_abilities(synergy_path, compatibility_path):
    # 1. Load the data files securely
    if not os.path.exists(synergy_path) or not os.path.exists(compatibility_path):
        print("Error: One or both JSON files could not be found.")
        return

    with open(synergy_path, "r", encoding="utf-8") as f:
        synergy_data = json.load(f)

    with open(compatibility_path, "r", encoding="utf-8") as f:
        compatibility_data = json.load(f)

    # 2. Extract the set of Pokémon names that possess a hidden ability
    # Using a set for quick O(1) lookups later
    pokemon_with_ha = set()

    for pkmn_key, pkmn_details in synergy_data.items():
        # Safeguard against missing or malformed "abilities" arrays
        abilities = pkmn_details.get("abilities", [])
        
        # Check if any ability object has "is_hidden" set to True
        has_hidden = any(ability.get("is_hidden") is True for ability in abilities)
        
        if has_hidden:
            # Add the canonical name (or the key) in lowercase for standardized matching
            name_to_store = pkmn_details.get("name", pkmn_key).strip().lower()
            pokemon_with_ha.add(name_to_store)

    # 3. Update the matching items inside dex_compatibility.json
    modified_count = 0
    
    # dex_compatibility.json contains a list of objects
    for entry in compatibility_data:
        entry_name = entry.get("name")
        if entry_name and isinstance(entry_name, str):
            normalized_name = entry_name.strip().lower()
            
            # Check if this Pokémon was flagged as having a hidden ability
            if normalized_name in pokemon_with_ha:
                # Update the value to the string format "true" as specified in your sample
                if entry.get("hidden_ability") != "true":
                    entry["hidden_ability"] = "true"
                    modified_count += 1

    # 4. Save the updated layout clean and formatted back to the file
    with open(compatibility_path, "w", encoding="utf-8") as f:
        json.dump(compatibility_data, f, indent=2, ensure_ascii=False)

    print(f"Update complete! Modified {modified_count} records in '{compatibility_path}'.")

if __name__ == "__main__":
    # Update these paths if your files are stored in another folder directory
    SYNERGY_FILE = "unused/synergymmodata.json"
    COMPATIBILITY_FILE = "dex_compatibility.json"

    update_hidden_abilities(SYNERGY_FILE, COMPATIBILITY_FILE)
    print("done")