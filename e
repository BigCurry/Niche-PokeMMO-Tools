A few changes:
- Animation loop:
    - both entities fall linearly towards the balance beam
    - impact causes the balance to tip towards heavier pokemon. 
        -If the weights are relatively comparable (when heavy:light is less than 1.5), then the balance tips a little left, a little right, then balances angling towards the heavier pokemon using the ratio of heavy to light.
        -if the weight is imbalanced (when heavy:light is greater than 1.5 and less than 3), the balance should tip directly towards the heavier pokemon . The speed of the tipping should be based on the ratio of heavy to light.
        - If the weight is highly imbalanced (when heavy:light is greater than 3), the balance should tip directly towards the heavier pokemon at max speed and the lighter pokemon is launched up and falls back down and shakes a little. The height the pokemon gets to should be based on the ration of heavy to light.