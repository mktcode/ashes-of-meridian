const { test } = require('node:test');
const { checkBuilding } = require('../helpers/building-contract.cjs');

test('faction 2 turret: bounded detailing, unique silhouette features and preserved building contracts', () => {
  checkBuilding({
    "faction": 2,
    "type": "turret",
    "mesh": "faction2TurretHull",
    "height": 6.5,
    "min": [
      -1.37,
      0.09,
      -1.37
    ],
    "max": [
      1.37,
      7.17,
      1.37
    ],
    "minTriangles": 1100,
    "maxTriangles": 1350,
    "features": [
      {
        "name": "finned lens crown",
        "min": [
          -0.7,
          4.1,
          -0.7
        ],
        "max": [
          0.7,
          5.93,
          0.7
        ],
        "vertices": 100
      }
    ]
  });
});
