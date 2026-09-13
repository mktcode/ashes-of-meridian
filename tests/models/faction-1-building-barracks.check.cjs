const { test } = require('node:test');
const { checkBuilding } = require('../helpers/building-contract.cjs');

test('faction 1 barracks: bounded detailing, unique silhouette features and preserved building contracts', () => {
  checkBuilding({
    "faction": 1,
    "type": "barracks",
    "mesh": "faction1BarracksHull",
    "height": 3.8,
    "min": [
      -2.71,
      -0.5,
      -2.71
    ],
    "max": [
      2.71,
      3.85,
      2.71
    ],
    "minTriangles": 1650,
    "maxTriangles": 1900,
    "features": [
      {
        "name": "ribbed lateral brood chambers",
        "min": [
          2.45,
          0.7,
          -1.4
        ],
        "max": [
          2.71,
          2.4,
          1.4
        ],
        "vertices": 20
      },
      {
        "name": "forward nursery mouth",
        "min": [
          -0.8,
          0.07,
          2.3
        ],
        "max": [
          0.8,
          1.84,
          2.5
        ],
        "vertices": 20
      }
    ]
  });
});
