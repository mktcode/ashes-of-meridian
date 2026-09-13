const { test } = require('node:test');
const { checkBuilding } = require('../helpers/building-contract.cjs');

test('faction 0 hq: bounded detailing, unique silhouette features and preserved building contracts', () => {
  checkBuilding({
    "faction": 0,
    "type": "hq",
    "mesh": "faction0HqFittings",
    "min": [
      -0.67,
      3.53,
      -1.3
    ],
    "max": [
      0.67,
      3.76,
      0.2
    ],
    "minTriangles": 250,
    "maxTriangles": 350,
    "maxInstances": 54,
    "totalTriangles": 3200,
    "features": [
      {
        "name": "raised central service grille",
        "min": [
          -0.4,
          3.72,
          -1.1
        ],
        "max": [
          0.4,
          3.76,
          0
        ],
        "vertices": 40
      }
    ]
  });
});
