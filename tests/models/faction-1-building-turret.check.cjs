const { test } = require('node:test');
const { checkBuilding } = require('../helpers/building-contract.cjs');

test('faction 1 turret: bounded detailing, unique silhouette features and preserved building contracts', () => {
  checkBuilding({
    "faction": 1,
    "type": "turret",
    "mesh": "faction1TurretHull",
    "height": 5.8,
    "min": [
      -1.7,
      -0.76,
      -1.7
    ],
    "max": [
      1.7,
      6.13,
      1.7
    ],
    "minTriangles": 1300,
    "maxTriangles": 1500,
    "features": [
      {
        "name": "nested thorn-growth collars",
        "min": [
          -0.7,
          5.4,
          -0.7
        ],
        "max": [
          0.7,
          6.13,
          0.7
        ],
        "vertices": 80
      }
    ]
  });
});
