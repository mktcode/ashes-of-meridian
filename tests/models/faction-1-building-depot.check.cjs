const { test } = require('node:test');
const { checkBuilding } = require('../helpers/building-contract.cjs');

test('faction 1 depot: bounded detailing, unique silhouette features and preserved building contracts', () => {
  checkBuilding({
    "faction": 1,
    "type": "depot",
    "mesh": "faction1DepotHull",
    "height": 2.8,
    "min": [
      -2.2,
      -0.43,
      -2.2
    ],
    "max": [
      2.2,
      2.84,
      2.2
    ],
    "minTriangles": 1550,
    "maxTriangles": 1800,
    "features": [
      {
        "name": "low overhanging storage leaves",
        "min": [
          1.95,
          1,
          -1.2
        ],
        "max": [
          2.2,
          2.1,
          1.2
        ],
        "vertices": 20
      }
    ]
  });
});
