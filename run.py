import json
import os

def merge_pokemon_data():
    source_file = 'synergymmodata.json'
    target_file = 'dex_compatibility.json'
    
    # 1. Safety check to ensure files exist
    if not os.path.exists(source_file) or not os.path.exists(target_file):
        print(f"Error: Make sure both '{source_file}' and '{target_file}' are in this directory.")
        return

    # 2. Load data from files
    print("Loading datasets...")
    with open(source_file, 'r', encoding='utf-8') as f:
        mmo_data = json.load(f)
        
    with open(target_file, 'r', encoding='utf-8') as f:
        dex_compatibility = json.load(f)

    # 3. Create lookup tables for both names and IDs
    mmo_name_lookup = {}
    mmo_id_lookup = {}
    
    for key, value in mmo_data.items():
        # Map by lowercase name key
        mmo_name_lookup[key.lower()] = value
        
        # Map by numerical ID if it exists in the source object
        if isinstance(value, dict) and "id" in value:
            mmo_id_lookup[int(value["id"])] = value

    updated_by_name = 0
    updated_by_id = 0
    missing_matches = []

    # 4. Iterate over target items and inject the new keys
    print("Processing updates...")
    for pokemon in dex_compatibility:
        pkmn_name = pokemon.get("name", "").lower()
        pkmn_id = pokemon.get("id") or pokemon.get("PokeAPI_id")
        
        source_obj = None
        matched_via = None
        
        # Strategy A: Attempt Name Matching
        if pkmn_name in mmo_name_lookup:
            source_obj = mmo_name_lookup[pkmn_name]
            matched_via = "name"
        
        # Strategy B: Fallback to ID Matching if name match failed
        elif pkmn_id is not None:
            try:
                target_id_int = int(pkmn_id)
                if target_id_int in mmo_id_lookup:
                    source_obj = mmo_id_lookup[target_id_int]
                    matched_via = "id"
            except (ValueError, TypeError):
                pass # Handle cases where id might not be a valid integer conversion

        # Apply updates if a match was found by either method
        if source_obj:
            pokemon["capture_rate"] = source_obj.get("capture_rate", None)
            pokemon["alpha"] = source_obj.get("alpha", "no")
            pokemon["obtainable"] = source_obj.get("obtainable", False)
            
            if matched_via == "name":
                updated_by_name += 1
            elif matched_via == "id":
                updated_by_id += 1
        else:
            missing_matches.append(pokemon.get("name") or f"ID {pkmn_id}")

    # 5. Save the modified destination structure back to the file
    with open(target_file, 'w', encoding='utf-8') as f:
        json.dump(dex_compatibility, f, indent=2, ensure_ascii=False)

    # 6. Detailed Summary Report
    print("\n--- Summary ---")
    print(f"Successfully updated {updated_by_name + updated_by_id} Pokémon entries.")
    print(f"  - Matched by Name: {updated_by_name}")
    print(f"  - Matched by ID Fallback: {updated_by_id}")
    
    if missing_matches:
        print(f"\nWarning: Could not match {len(missing_matches)} entries by name or ID.")
        print(f"Skipped: {', '.join(str(item) for item in missing_matches[:15])}...")
    else:
        print("Perfect fit! All entries matched perfectly.")

if __name__ == "__main__":
    merge_pokemon_data()