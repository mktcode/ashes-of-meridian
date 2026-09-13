const { test } = require('node:test');
const { checkBuilding } = require('../helpers/building-contract.cjs');

test('faction 0 depot: bounded detailing, unique silhouette features and preserved building contracts', () => {
  checkBuilding({
    "faction": 0,
    "type": "depot",
    "mesh": "faction0DepotHull",
    "min": [
      -2.04,
      0.1,
      -1.73
    ],
    "max": [
      2.04,
      2.14,
      1.73
    ],
    "minTriangles": 2200,
    "maxTriangles": 2600,
    "features": [
      {
        "name": "paired chamfered cargo roofs",
        "min": [
          -2.04,
          2.02,
          -1.7
        ],
        "max": [
          2.04,
          2.14,
          1.7
        ],
        "vertices": 100
      },
      {
        "name": "front locking bars and corner castings",
        "min": [
          -2,
          0.2,
          1.68
        ],
        "max": [
          2,
          1.8,
          1.73
        ],
        "vertices": 120
      }
    ]
  });
});
