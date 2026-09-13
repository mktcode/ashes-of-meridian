const { test } = require('node:test');
const { checkBuilding } = require('../helpers/building-contract.cjs');

test('faction 0 turret: bounded detailing, unique silhouette features and preserved building contracts', () => {
  checkBuilding({
    "faction": 0,
    "type": "turret",
    "mesh": "faction0TurretFittings",
    "min": [
      -0.7,
      1,
      -0.24
    ],
    "max": [
      0.7,
      1.49,
      0.14
    ],
    "minTriangles": 200,
    "maxTriangles": 280,
    "features": [
      {
        "name": "paired maintenance-panel fasteners",
        "min": [
          -0.7,
          1,
          -0.12
        ],
        "max": [
          0.7,
          1.49,
          0.02
        ],
        "vertices": 80
      }
    ]
  });
});
