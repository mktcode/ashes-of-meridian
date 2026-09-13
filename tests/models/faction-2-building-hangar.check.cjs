const { test } = require('node:test');
const { checkBuilding } = require('../helpers/building-contract.cjs');

test('faction 2 hangar: bounded detailing, unique silhouette features and preserved building contracts', () => {
  checkBuilding({
    "faction": 2,
    "type": "hangar",
    "mesh": "faction2HangarHull",
    "height": 5.5,
    "min": [
      -3.43,
      0.08,
      -3.43
    ],
    "max": [
      3.43,
      6.08,
      3.43
    ],
    "minTriangles": 1300,
    "maxTriangles": 1500,
    "features": [
      {
        "name": "low cardinal docking vanes",
        "min": [
          -0.4,
          0.81,
          3
        ],
        "max": [
          0.4,
          1.3,
          3.43
        ],
        "vertices": 10
      }
    ]
  });
});
