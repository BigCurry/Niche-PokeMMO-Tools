Do the following changes for the pokedex modal's summary tab's catch chance summary-card

- Make all user-controllable sliders and hidden behind a filters button in the summary-card

- Apply the following conditions:
  - For all balls with min catchrate values in const BALL_CATCHRATES, if their respective conditions are not met, default to the min value.
  - Dream Balls require the pokemon to be asleep, so can only have the sleep status effect
  - Heavy ball has the following requirements
    - weight 3000, catchrate 4
    - weight 2000, catchrate 3
    - weight 1000, catchrate 2
    - weight <1000, catchrate 1