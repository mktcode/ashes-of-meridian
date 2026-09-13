const { test } = require('node:test');
const { checkBuilding } = require('../helpers/building-contract.cjs');

test('faction 0 refinery: bounded detailing, unique silhouette features and preserved building contracts', () => {
  checkBuilding({
    "faction": 0,
    "type": "refinery",
    "mesh": "faction0RefineryHull",
    "min": [
      -2.15,
      0.1,
      -1.6
    ],
    "max": [
      2.15,
      5.8,
      1.97
    ],
    "minTriangles": 1600,
    "maxTriangles": 1900,
    "features": [
      {
        "name": "unequal pressure-column caps",
        "min": [
          -2.15,
          5,
          -1.2
        ],
        "max": [
          0,
          5.8,
          1
        ],
        "vertices": 50
      },
      {
        "name": "forward valves and core cradle",
        "min": [
          -2,
          0.8,
          1.5
        ],
        "max": [
          2,
          2,
          1.97
        ],
        "vertices": 80
      }
    ]
  });
});
