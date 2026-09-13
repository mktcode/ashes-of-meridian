const { test } = require('node:test');
const { checkBuilding } = require('../helpers/building-contract.cjs');

test('faction 2 refinery: bounded detailing, unique silhouette features and preserved building contracts', () => {
  checkBuilding({
    "faction": 2,
    "type": "refinery",
    "mesh": "faction2RefineryHull",
    "height": 5.5,
    "min": [
      -1.85,
      0.08,
      -1.68
    ],
    "max": [
      1.85,
      6.07,
      1.68
    ],
    "minTriangles": 1400,
    "maxTriangles": 1650,
    "features": [
      {
        "name": "stepped collector collars",
        "min": [
          -1.68,
          1.1,
          -1.68
        ],
        "max": [
          1.68,
          1.6,
          1.68
        ],
        "vertices": 140
      }
    ]
  });
});
