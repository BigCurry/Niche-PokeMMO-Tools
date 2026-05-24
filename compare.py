import json
import os

def load_json_file(filename):
    """Safely loads a JSON file."""
    if not os.path.exists(filename):
        print(f"Error: {filename} not found.")
        return None
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON from {filename}: {e}")
        return None

def find_missing_locations():
    # Load data files
    monsters_data = load_json_file('monsters.json')
    locations_data = load_json_file('locations.json')
    
    if monsters_data is None or locations_data is None:
        return

    # Group locations from locations.json by region for quick lookup
    locations_by_region = {}
    for loc_entry in locations_data:
        region = loc_entry.get('region')
        name = loc_entry.get('name')
        
        if region and name:
            if region not in locations_by_region:
                locations_by_region[region] = []
            locations_by_region[region].append(name)

    # Use a set to store missing locations to automatically handle duplicate entries
    # Stores tuples of (region_name, location)
    missing_entries = set()

    # Iterate through every monster entry to check its locations
    for pokemon in monsters_data:
        poke_locations = pokemon.get('locations', [])
        
        for p_loc in poke_locations:
            m_region = p_loc.get('region_name')
            m_location = p_loc.get('location')
            
            if not m_region or not m_location:
                continue
            
            # Case 1: If the region doesn't exist at all in locations.json, it's missing
            if m_region not in locations_by_region:
                missing_entries.add((m_region, m_location))
                continue
                
            # Case 2: The region matches, check if any 'name' is contained within 'location'
            match_found = False
            for l_name in locations_by_region[m_region]:
                if l_name.lower() in m_location.lower():
                    match_found = True
                    break # A match was found, no need to check further names
            
            # If the loop finished and no map name was contained in this location, track it
            if not match_found:
                missing_entries.add((m_region, m_location))

    # Convert the set to a sorted list
    # Python sorts tuples element by element: first by region, then by location name
    sorted_missing = sorted(list(missing_entries), key=lambda x: (x[0].lower(), x[1].lower()))

    # Write the output to a plain text file
    output_filename = 'missing_locations.txt'
    try:
        with open(output_filename, 'w', encoding='utf-8') as f:
            for region, location in sorted_missing:
                f.write(f"{region}, {location}\n")
        print(f"Success! {len(sorted_missing)} uncontained locations saved to '{output_filename}'.")
    except IOError as e:
        print(f"Error writing to file {output_filename}: {e}")

if __name__ == "__main__":
    find_missing_locations()