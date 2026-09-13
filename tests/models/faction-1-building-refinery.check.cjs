const { test } = require('node:test');
const { checkBuilding } = require('../helpers/building-contract.cjs');

test('faction 1 refinery: bounded detailing, unique silhouette features and preserved building contracts', () => {
  checkBuilding({
    "faction": 1,
    "type": "refinery",
    "mesh": "faction1RefineryHull",
    "height": 3.8,
    "min": [
      -2.15,
      -0.5,
      -2.15
    ],
    "max": [
      2.15,
      3.85,
      2.15
    ],
    "minTriangles": 1350,
    "maxTriangles": 1600,
    "features": [
      {
        "name": "upper filter-organ collars",
        "min": [
          -2,
          3.25,
          -2
        ],
        "max": [
          2,
          3.4,
          2
        ],
        "vertices": 50
      }
    ],
    "extraMeshes": [
      {
        "mesh": "faction1RefineryOrgan",
        "min": [
          -0.74,
          -1.5,
          -0.74
        ],
        "max": [
          0.74,
          1.5,
          0.74
        ],
        "minTriangles": 100,
        "maxTriangles": 150
      }
    ]
  });
});
