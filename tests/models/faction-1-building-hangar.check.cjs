const { test } = require('node:test');
const { checkBuilding } = require('../helpers/building-contract.cjs');

test('faction 1 hangar: bounded detailing, unique silhouette features and preserved building contracts', () => {
  checkBuilding({
    "faction": 1,
    "type": "hangar",
    "mesh": "faction1HangarHull",
    "height": 3.8,
    "min": [
      -3.45,
      -0.5,
      -3.45
    ],
    "max": [
      3.45,
      3.85,
      3.45
    ],
    "minTriangles": 1800,
    "maxTriangles": 2050,
    "features": [
      {
        "name": "six shallow flight petals",
        "min": [
          -1,
          1.6,
          3.1
        ],
        "max": [
          1,
          2.6,
          3.45
        ],
        "vertices": 10
      }
    ]
  });
});
