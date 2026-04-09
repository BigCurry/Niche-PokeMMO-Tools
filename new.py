import json

INPUT_FILE = "synergymmodata.json"
OUTPUT_FILE = "processed_pokemon.json"


def extract_pokemon_data(pokemon):
    """Extract only the desired attributes from a Pokémon entry."""

    return {
        "id": pokemon.get("id"),
        "name": pokemon.get("name"),
        "base_happiness": pokemon.get("base_happiness"),
        "capture_rate": pokemon.get("capture_rate"),
    
        "evolution_chain": pokemon.get("evolution_chain"),
        "evolves_from_species": pokemon.get("evolves_from_species"),

        "growth_rate": pokemon.get("growth_rate"),

        "is_baby": pokemon.get("is_baby"),
        "is_legendary": pokemon.get("is_legendary"),
        "is_mythical": pokemon.get("is_mythical"),

        "alpha": pokemon.get("alpha"),

        "shiny_tier": pokemon.get("shiny_tier"),
        "shiny_points": pokemon.get("shiny_points"),

        "held_items": pokemon.get("held_items"),
        "is_default": pokemon.get("is_default"),

        "pvp": pokemon.get("pvp"),
    }


def main():
    # Load JSON
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    processed = {}

    # Iterate over all Pokémon
    for name, pokemon in data.items():
        processed[name] = extract_pokemon_data(pokemon)

    # Save output
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(processed, f, indent=4, ensure_ascii=False)

    print(f"Processed {len(processed)} Pokémon.")
    print(f"Saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()