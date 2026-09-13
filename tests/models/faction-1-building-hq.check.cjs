const { test } = require('node:test');
const { checkBuilding } = require('../helpers/building-contract.cjs');

test('faction 1 hq: bounded detailing, unique silhouette features and preserved building contracts', () => {
  checkBuilding({
    "faction": 1,
    "type": "hq",
    "mesh": "faction1HqHull",
    "height": 5,
    "min": [
      -3.82,
      -0.66,
      -3.82
    ],
    "max": [
      3.82,
      5.7,
      3.82
    ],
    "minTriangles": 1250,
    "maxTriangles": 1500,
    "features": [
      {
        "name": "six high folded bracts",
        "min": [
          -2,
          5.1,
          -2
        ],
        "max": [
          2,
          5.7,
          2
        ],
        "vertices": 10
      }
    ]
  });
});
