const { test } = require('node:test');
const { checkBuilding } = require('../helpers/building-contract.cjs');

test('faction 2 barracks: bounded detailing, unique silhouette features and preserved building contracts', () => {
  checkBuilding({
    "faction": 2,
    "type": "barracks",
    "mesh": "faction2BarracksHull",
    "height": 5.5,
    "min": [
      -2.41,
      0.08,
      -2.09
    ],
    "max": [
      2.41,
      6.07,
      2.52
    ],
    "minTriangles": 1400,
    "maxTriangles": 1600,
    "features": [
      {
        "name": "forward processional threshold and portal",
        "min": [
          -1,
          0.17,
          2.1
        ],
        "max": [
          1,
          1.8,
          2.52
        ],
        "vertices": 40
      }
    ]
  });
});
