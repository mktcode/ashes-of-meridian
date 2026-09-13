const { test } = require('node:test');
const { checkBuilding } = require('../helpers/building-contract.cjs');

test('faction 2 depot: bounded detailing, unique silhouette features and preserved building contracts', () => {
  checkBuilding({
    "faction": 2,
    "type": "depot",
    "mesh": "faction2DepotHull",
    "height": 3.3,
    "min": [
      -1.85,
      0.04,
      -1.68
    ],
    "max": [
      1.85,
      3.65,
      1.68
    ],
    "minTriangles": 1300,
    "maxTriangles": 1500,
    "features": [
      {
        "name": "sealed low reliquaries",
        "min": [
          -0.5,
          0.4,
          1.3
        ],
        "max": [
          0.5,
          1.4,
          1.68
        ],
        "vertices": 40
      }
    ]
  });
});
