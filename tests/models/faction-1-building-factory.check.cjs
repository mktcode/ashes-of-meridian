const { test } = require('node:test');
const { checkBuilding } = require('../helpers/building-contract.cjs');

test('faction 1 factory: bounded detailing, unique silhouette features and preserved building contracts', () => {
  checkBuilding({
    "faction": 1,
    "type": "factory",
    "mesh": "faction1FactoryHull",
    "height": 3.8,
    "min": [
      -3.5,
      -0.5,
      -3.35
    ],
    "max": [
      3.5,
      3.85,
      3.35
    ],
    "minTriangles": 1950,
    "maxTriangles": 2200,
    "features": [
      {
        "name": "paired segmented carapace shields",
        "min": [
          3,
          1.5,
          -2
        ],
        "max": [
          3.5,
          2.8,
          2
        ],
        "vertices": 10
      }
    ]
  });
});
