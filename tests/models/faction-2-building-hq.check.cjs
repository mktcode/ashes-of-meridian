const { test } = require('node:test');
const { checkBuilding } = require('../helpers/building-contract.cjs');

test('faction 2 hq: bounded detailing, unique silhouette features and preserved building contracts', () => {
  checkBuilding({
    "faction": 2,
    "type": "hq",
    "mesh": "faction2HqHull",
    "height": 7.8,
    "min": [
      -3.53,
      0.1,
      -3.1
    ],
    "max": [
      3.53,
      8.6,
      3.1
    ],
    "minTriangles": 1050,
    "maxTriangles": 1250,
    "features": [
      {
        "name": "four-pronged crown",
        "min": [
          -1.3,
          7.4,
          -1.3
        ],
        "max": [
          1.3,
          8.4,
          1.3
        ],
        "vertices": 10
      }
    ]
  });
});
