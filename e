Do the following changes for the pokedex modal's summary tab's catch chance summary-card.

- catch-summary-best should show the best available combo with the available images. So it should be `${ball image}${ball label} with ${individual status image(s)} at ${HP percentage} for ${Catch Chance percentage}.
- Make all user-controllable sliders and catch-summary-meta hidden behind a filters button in the summary-card.
- Allow users to search for specific balls with a search bar with a dropdown menu. Have the search bar and filter button on the same row and the filter button to only have the filter svg symbol used in pokedex grid.
- Allow users to disable/enable balls within the filters button, including balls that are set to false in the dex_compatibility.json file. If a user searches for a specific ball and its disabled, have the option to enable it next to the search bar.
- If `"obtainable": false` in dex_compatibility.json, then there should be an overlay on the tool that obscures it along with dialogue along the lines of that it is impossible to catch this pokemon and a button to disable the overlay and view the info anyways.
- If `"alpha": true` in dex_compatibility.json, have the option in the filters panel to disable/enable alpha catch rate which is always 10.
- Apply the following conditions:
  - For all balls with min catchrate values in const BALL_CATCHRATES, if their respective conditions are not met, default to the min value.
  - Dream Balls require the pokemon to be asleep, so can only have the sleep status effect.
  - Heavy ball has the following requirements
    - weight 3000, catchrate 4
    - weight 2000, catchrate 3
    - weight 1000, catchrate 2
    - weight <1000, catchrate 1
  - Nest ball requires the pokemon to be low-leveled with a max catchrate of 4 for pokemon leveled 16 or less and a min catchrate of 1 for pokemon leveled 31 or more. By default, set the target level slider to the minimum encounterable level within the locations object of monsters.json
  - Quick balls require use on the first turn of battle. The user cannot apply a status effect or damage within that time, so the only status effect that can be in place is sleep at 100% HP.
  - Quick balls and Timer balls work based on turns. By default, assume optimal turn count for both (turn 1 for quick, turn 10+ for timer) and only use the turn slider value if the user manipulates it. Have the slider's count display the symbol ∅ in the default state.

  Use http://127.0.0.1:5500 for testing changes at the end.