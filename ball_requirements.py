import json
from collections import defaultdict, deque
from pathlib import Path


ROOT = Path(__file__).resolve().parent
DEX_FILE = ROOT / "dex_compatibility.json"
MONSTERS_FILE = ROOT / "monsters.json"

ALWAYS_TRUE_BALLS = {
    "pok\u00e9",
    "heal",
    "premier",
    "great",
    "nest",
    "timer",
    "quick",
    "dream",
    "ultra",
    "repeat",
    "dusk",
    "level",
    "heavy",
    "master",
    "cherish",
    "love",
}

HAPPINESS_EVOLUTION_TYPES = {
    "HAPPINESS",
    "HAPPINESS_DAY",
    "HAPPINESS_NIGHT",
}

LURE_TYPES = {
    "fishing",
    "good rod",
    "old rod",
    "super rod",
}

DIVE_TYPES = LURE_TYPES | {"water"}


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def save_json(path: Path, payload):
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)


def normalize_name(name):
    return str(name).strip().lower()


def build_monster_lookups(monsters):
    by_id = {}
    by_name = {}

    for monster in monsters:
        monster_id = monster.get("id")
        monster_name = normalize_name(monster.get("name", ""))
        if monster_id is not None:
            by_id[int(monster_id)] = monster
        if monster_name:
            by_name[monster_name] = monster

    return by_id, by_name


def resolve_monster(entry, by_id, by_name):
    entry_id = entry.get("id")
    try:
        if entry_id is not None:
            entry_id = int(entry_id)
    except (TypeError, ValueError):
        entry_id = None
    if entry_id in by_id:
        return by_id[entry_id]

    entry_id = entry.get("PokeAPI_id")
    try:
        if entry_id is not None:
            entry_id = int(entry_id)
    except (TypeError, ValueError):
        entry_id = None
    if entry_id in by_id:
        return by_id[entry_id]

    entry_name = normalize_name(entry.get("name", ""))
    if entry_name in by_name:
        return by_name[entry_name]

    entry_name = normalize_name(entry.get("frontend_name", ""))
    if entry_name in by_name:
        return by_name[entry_name]

    return None


def build_evolution_graph(monsters):
    graph = defaultdict(set)

    for monster in monsters:
        monster_id = monster.get("id")
        if monster_id is None:
            continue
        monster_id = int(monster_id)

        graph[monster_id]
        for evo in monster.get("evolutions", []):
            evo_id = evo.get("id")
            if evo_id is None:
                continue
            evo_id = int(evo_id)
            graph[monster_id].add(evo_id)
            graph[evo_id].add(monster_id)

    return graph


def build_happiness_families(monsters):
    graph = build_evolution_graph(monsters)
    by_id = {int(monster["id"]): monster for monster in monsters if monster.get("id") is not None}
    happiness_family_ids = set()
    visited = set()

    for start_id in graph:
        if start_id in visited:
            continue

        component = set()
        queue = deque([start_id])
        visited.add(start_id)

        while queue:
            current = queue.popleft()
            component.add(current)
            for neighbor in graph[current]:
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)

        has_happiness_evo = False
        for monster_id in component:
            monster = by_id.get(monster_id)
            if not monster:
                continue
            for evo in monster.get("evolutions", []):
                if str(evo.get("type", "")).upper() in HAPPINESS_EVOLUTION_TYPES:
                    has_happiness_evo = True
                    break
            if has_happiness_evo:
                break

        if has_happiness_evo:
            happiness_family_ids.update(component)

    return happiness_family_ids


def has_type(monster, wanted_types):
    monster_types = {str(t).upper() for t in monster.get("types", [])}
    return bool(monster_types & {t.upper() for t in wanted_types})


def has_lure_access(monster):
    for location in monster.get("locations", []):
        encounter_type = str(location.get("type", "")).strip().lower()
        if encounter_type in LURE_TYPES:
            return True
    return False


def has_dive_access(monster):
    for location in monster.get("locations", []):
        encounter_type = str(location.get("type", "")).strip().lower()
        location_name = str(location.get("location", "")).strip().lower()
        if encounter_type in DIVE_TYPES or "underwater" in location_name:
            return True
    return False


def compute_balls(entry, monster, happiness_family_ids):
    monster_id = int(monster.get("id"))

    balls = {key: False for key in entry.get("balls", {})}

    for key in ALWAYS_TRUE_BALLS:
        if key in balls:
            balls[key] = True

    if "luxury" in balls:
        balls["luxury"] = monster_id in happiness_family_ids
    if "friend" in balls:
        balls["friend"] = monster_id in happiness_family_ids

    if "net" in balls:
        balls["net"] = has_type(monster, {"WATER", "BUG"})
    if "lure" in balls:
        balls["lure"] = has_lure_access(monster)
    if "fast" in balls:
        balls["fast"] = int(monster.get("stats", {}).get("speed", 0)) >= 100
    if "dive" in balls:
        balls["dive"] = has_dive_access(monster)

    return balls


def update_dex_compatibility():
    monsters = load_json(MONSTERS_FILE)
    dex_entries = load_json(DEX_FILE)

    by_id, by_name = build_monster_lookups(monsters)
    happiness_family_ids = build_happiness_families(monsters)

    updated = 0
    missing = []

    for entry in dex_entries:
        monster = resolve_monster(entry, by_id, by_name)
        if monster is None:
            missing.append(entry.get("name") or entry.get("frontend_name") or entry.get("id"))
            continue

        entry["balls"] = compute_balls(entry, monster, happiness_family_ids)
        updated += 1

    save_json(DEX_FILE, dex_entries)

    print(f"Updated balls for {updated} dex entries.")
    if missing:
        print(f"Skipped {len(missing)} entries with no monster match: {', '.join(map(str, missing[:20]))}")


if __name__ == "__main__":
    update_dex_compatibility()
