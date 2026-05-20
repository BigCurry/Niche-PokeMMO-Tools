"""
generate_breeding_chains.py

Generates a JSON file containing legal breeding chains for Pokémon egg moves
using data from monsters.json.

This version fixes a major legality issue:

Intermediary Pokémon in a breeding chain must be able to:
- legally RECEIVE the move as an egg move
- legally KNOW the move
- legally PASS the move onward

The script now builds move-specific breeding graphs instead of
generic egg-group traversal graphs.

Optimizations:
- Indexed egg-group lookups
- Move-specific graph pruning
- Shortest-path BFS
- Chain deduplication
- Visited-node pruning
- Smeargle Sketch support
- Legal intermediary validation

======================================================================
OUTPUT
======================================================================

Creates:
    breeding_chains.json

======================================================================
USAGE
======================================================================

Place this script in the same folder as:
    monsters.json

Run:
    python generate_breeding_chains.py
"""

import json
from collections import deque, defaultdict

MONSTERS_FILE = "monsters.json"
OUTPUT_FILE = "breeding_chains.json"

# ============================================================
# CONFIG
# ============================================================

MAX_CHAIN_LENGTH = 4
MAX_CHAINS_PER_MOVE = 100

# ============================================================
# LOAD DATA
# ============================================================

with open(MONSTERS_FILE, "r", encoding="utf-8") as f:
    monsters = json.load(f)

# ============================================================
# HELPERS
# ============================================================


def normalize_name(name):
    return name.lower().strip()


def is_genderless(mon):
    return mon.get("gender_ratio") == 255


def is_female_only(mon):
    return mon.get("gender_ratio") == 254


def can_donate(mon):
    return (
        not is_genderless(mon)
        and not is_female_only(mon)
        and mon.get("egg_groups")
    )


def can_receive(mon):
    return (
        not is_genderless(mon)
        and mon.get("egg_groups")
    )


def get_egg_moves(mon):
    return [
        m for m in mon.get("moves", [])
        if str(m.get("type", "")).upper() == "EGG"
    ]


def is_base_stage(mon):

    mon_id = mon["id"]

    for other in monsters:

        for evo in other.get("evolutions", []):

            if evo.get("id") == mon_id:
                return False

    return True


# ============================================================
# MOVE LEGALITY
# ============================================================


def can_know_move(mon, move_id):
    """
    Can legally possess the move.
    """

    for move in mon.get("moves", []):

        if move["id"] != move_id:
            continue

        move_type = str(move.get("type", "")).upper()

        if move_type in {"LEVEL", "EGG"}:
            return True

    return False


def can_receive_move(mon, move_id):
    """
    Can inherit the move through breeding.
    """

    for move in mon.get("moves", []):

        if move["id"] != move_id:
            continue

        move_type = str(move.get("type", "")).upper()

        if move_type == "EGG":
            return True

    return False


def get_donor_method(mon, move_id):

    for move in mon.get("moves", []):

        if move["id"] != move_id:
            continue

        move_type = str(move.get("type", "")).upper()

        if move_type == "LEVEL":

            return {
                "type": "level",
                "val": move.get("level", 1)
            }

        if move_type == "EGG":

            return {
                "type": "breed",
                "val": ""
            }

    return {
        "type": "unknown",
        "val": ""
    }


# ============================================================
# PRECOMPUTE EGG GROUP SETS
# ============================================================

for mon in monsters:
    mon["_egg_group_set"] = set(mon.get("egg_groups", []))

# ============================================================
# LOOKUPS
# ============================================================

mons_by_name = {
    normalize_name(mon["name"]): mon
    for mon in monsters
}

base_mons = [
    mon for mon in monsters
    if is_base_stage(mon)
]

# ============================================================
# EGG GROUP INDEX
# ============================================================

egg_group_index = defaultdict(list)

for mon in monsters:

    if not can_receive(mon):
        continue

    for group in mon.get("egg_groups", []):

        egg_group_index[group].append(mon)

# ============================================================
# MOVE CARRIERS
# ============================================================

move_legal_knowers = defaultdict(set)
move_receivers = defaultdict(set)
move_donors = defaultdict(list)

for mon in monsters:

    if not mon.get("egg_groups"):
        continue

    for move in mon.get("moves", []):

        move_id = move["id"]
        move_type = str(move.get("type", "")).upper()

        # ----------------------------------------------------
        # Can Know
        # ----------------------------------------------------

        if move_type in {"LEVEL", "EGG"}:

            move_legal_knowers[move_id].add(mon["id"])

        # ----------------------------------------------------
        # Can Receive
        # ----------------------------------------------------

        if move_type == "EGG":

            move_receivers[move_id].add(mon["id"])

        # ----------------------------------------------------
        # Natural Donors
        # ----------------------------------------------------

        if move_type == "LEVEL" and can_donate(mon):

            move_donors[move_id].append({
                "pokemon": mon,
                "method": {
                    "type": "level",
                    "val": move.get("level", 1)
                }
            })

# ============================================================
# SMEARGLE SUPPORT
# ============================================================

smeargle = mons_by_name.get("smeargle")

if smeargle and can_donate(smeargle):

    all_moves = {}

    for mon in monsters:

        for move in mon.get("moves", []):

            all_moves[move["id"]] = move["name"]

    for move_id in all_moves.keys():

        move_legal_knowers[move_id].add(smeargle["id"])

        already_exists = any(
            d["pokemon"]["id"] == smeargle["id"]
            for d in move_donors[move_id]
        )

        if not already_exists:

            move_donors[move_id].append({
                "pokemon": smeargle,
                "method": {
                    "type": "sketch",
                    "val": ""
                }
            })

# ============================================================
# BUILD MOVE-SPECIFIC BREED GRAPH
# ============================================================


def build_move_graph(move_id):

    graph = defaultdict(list)

    valid_knowers = move_legal_knowers[move_id]
    valid_receivers = move_receivers[move_id]

    for mon in monsters:

        if mon["id"] not in valid_knowers:
            continue

        if not can_donate(mon):
            continue

        mon_name = normalize_name(mon["name"])

        neighbors = {}

        for group in mon.get("egg_groups", []):

            for other in egg_group_index[group]:

                if other["id"] == mon["id"]:
                    continue

                # Receiver must legally inherit move
                if other["id"] not in valid_receivers:
                    continue

                neighbors[other["id"]] = other

        graph[mon_name] = list(neighbors.values())

    return graph

# ============================================================
# CHAIN FORMATTER
# ============================================================


def build_chain(path, donor_method):

    chain = {}

    donor = path[0]

    chain["donor"] = {
        "id": donor["id"],
        "name": normalize_name(donor["name"]),
        "method": donor_method
    }

    for idx, mon in enumerate(path[1:-1], start=1):

        chain[f"receiver_{idx}"] = {
            "id": mon["id"],
            "name": normalize_name(mon["name"]),
            "method": {
                "type": "breed",
                "val": ""
            }
        }

    final_mon = path[-1]

    chain["receiver_final"] = {
        "id": final_mon["id"],
        "name": normalize_name(final_mon["name"]),
        "method": {
            "type": "breed",
            "val": ""
        }
    }

    return chain

# ============================================================
# EVOLUTION / SORT HELPERS
# ============================================================

evolution_parent = {}

for mon in monsters:

    for evo in mon.get("evolutions", []):

        evolution_parent[evo["id"]] = mon["id"]


def get_species_root(mon_id):
    """
    Returns the base/root species id for an evolution line.
    """

    current = mon_id

    while current in evolution_parent:
        current = evolution_parent[current]

    return current


def get_evolution_depth(mon_id):
    """
    Returns stage depth within its evolution line.

    Example:
        Bulbasaur -> 0
        Ivysaur   -> 1
        Venusaur  -> 2
    """

    depth = 0
    current = mon_id

    while current in evolution_parent:
        current = evolution_parent[current]
        depth += 1

    return depth


def extract_chain_path(chain):
    """
    Converts chain dict into ordered list of pokemon entries.

    donor -> receiver_# -> receiver_final
    """

    path = [chain["donor"]]

    intermediary_keys = sorted([
        k for k in chain.keys()
        if k.startswith("receiver_")
        and k != "receiver_final"
    ])

    for key in intermediary_keys:
        path.append(chain[key])

    path.append(chain["receiver_final"])

    return path


def chain_sort_key(chain):
    """
    Sorting priority:

    1. Smaller chain length first
    2. Species line precedence
    3. Evolution order within same species line
    4. Dex number ascending
    """

    path = extract_chain_path(chain)

    # ----------------------------------------
    # Chain length
    # ----------------------------------------

    chain_length = len(path)

    # ----------------------------------------
    # Species signature
    #
    # Same evolution families cluster together
    # before dex ordering.
    # ----------------------------------------

    species_signature = tuple(
        get_species_root(mon["id"])
        for mon in path
    )

    # ----------------------------------------
    # Evolution depth signature
    #
    # Ensures:
    # Bulbasaur < Ivysaur < Venusaur
    # within same family
    # ----------------------------------------

    evolution_signature = tuple(
        get_evolution_depth(mon["id"])
        for mon in path
    )

    # ----------------------------------------
    # Dex ordering fallback
    # ----------------------------------------

    dex_signature = tuple(
        mon["id"]
        for mon in path
    )

    return (
        chain_length,
        species_signature,
        evolution_signature,
        dex_signature
    )

# ============================================================
# CHAIN SEARCH
# ============================================================


def find_breeding_chains(target_mon, move_id):

    results = []

    # Target must be able to inherit move
    if target_mon["id"] not in move_receivers[move_id]:
        return []

    breed_graph = build_move_graph(move_id)

    donors = move_donors.get(move_id, [])

    target_groups = target_mon["_egg_group_set"]

    for donor_info in donors:

        donor = donor_info["pokemon"]
        donor_method = donor_info["method"]

        donor_name = normalize_name(donor["name"])

        # Prevent self-loops
        if donor["id"] == target_mon["id"]:
            continue

        # ====================================================
        # SMEARGLE RESTRICTION
        # ====================================================

        if donor_name == "smeargle":

            if "field" not in target_groups:
                continue

        # ====================================================
        # DIRECT BREED
        # ====================================================

        if donor["_egg_group_set"] & target_groups:

            results.append(
                build_chain(
                    [donor, target_mon],
                    donor_method
                )
            )

            continue

        # ====================================================
        # BFS
        # ====================================================

        queue = deque([[donor]])

        shortest_found = None

        while queue and len(results) < MAX_CHAINS_PER_MOVE:

            path = queue.popleft()

            current = path[-1]

            current_name = normalize_name(current["name"])

            # ------------------------------------------------
            # Current depth
            # ------------------------------------------------

            current_depth = len(path)

            # ------------------------------------------------
            # Stop exploring deeper-than-shortest paths
            # ------------------------------------------------

            if shortest_found is not None:

                if current_depth > shortest_found:
                    continue

            # ------------------------------------------------
            # Max depth limit
            # ------------------------------------------------

            if current_depth > MAX_CHAIN_LENGTH:
                continue

            # ------------------------------------------------
            # Found shortest-valid endpoint
            # ------------------------------------------------

            if current["_egg_group_set"] & target_groups:

                if shortest_found is None:
                    shortest_found = current_depth

                full_path = path + [target_mon]

                results.append(
                    build_chain(
                        full_path,
                        donor_method
                    )
                )

                continue

            # ------------------------------------------------
            # Expand neighbors
            # ------------------------------------------------

            for neighbor in breed_graph[current_name]:

                # --------------------------------------------
                # PATH-LOCAL cycle prevention only
                # --------------------------------------------

                if any(
                    p["id"] == neighbor["id"]
                    for p in path
                ):
                    continue

                queue.append(path + [neighbor])

    # ========================================================
    # DEDUPLICATE
    # ========================================================

    unique = []
    seen = set()

    for chain in results:

        serialized = json.dumps(
            chain,
            sort_keys=True
        )

        if serialized in seen:
            continue

        seen.add(serialized)

        unique.append(chain)

    # ========================================================
    # SORT
    # ========================================================

    unique.sort(key=chain_sort_key)

    return unique[:MAX_CHAINS_PER_MOVE]

# ============================================================
# GENERATE OUTPUT
# ============================================================

output = {}

total_species = 0
total_moves = 0

for mon in base_mons:

    if not can_receive(mon):
        continue

    egg_moves = get_egg_moves(mon)

    if not egg_moves:
        continue

    mon_key = normalize_name(mon["name"])

    move_entries = []

    for egg_move in egg_moves:

        move_id = egg_move["id"]
        move_name = egg_move["name"]

        chains = find_breeding_chains(
            mon,
            move_id
        )

        formatted_chains = []

        for idx, chain in enumerate(chains, start=1):

            formatted_chains.append({
                str(idx): chain
            })

        move_entries.append({
            "move_id": move_id,
            "move_name": move_name,
            "chains": formatted_chains
        })

        total_moves += 1

    output[mon_key] = [{
        "egg_moves": move_entries
    }]

    total_species += 1

# ============================================================
# SAVE
# ============================================================

with open(OUTPUT_FILE, "w", encoding="utf-8") as f:

    json.dump(
        output,
        f,
        indent=4
    )

# ============================================================
# SUMMARY
# ============================================================

print()
print("========================================")
print("Breeding Chain Generation Complete")
print("========================================")
print(f"Species Processed: {total_species}")
print(f"Egg Moves Processed: {total_moves}")
print(f"Output File: {OUTPUT_FILE}")
print("========================================")