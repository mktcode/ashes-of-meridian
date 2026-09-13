const { test } = require('node:test');
const { checkBuilding } = require('../helpers/building-contract.cjs');

test('faction 2 factory: bounded detailing, unique silhouette features and preserved building contracts', () => {
  checkBuilding({
    "faction": 2,
    "type": "factory",
    "mesh": "faction2FactoryHull",
    "height": 5.5,
    "min": [
      -3.05,
      0.08,
      -2.65
    ],
    "max": [
      3.05,
      6.08,
      2.65
    ],
    "minTriangles": 1550,
    "maxTriangles": 1800,
    "features": [
      {
        "name": "paired capped assembly buttresses",
        "min": [
          2,
          2.77,
          -1
        ],
        "max": [
          2.7,
          2.96,
          1
        ],
        "vertices": 70
      }
    ]
  });
});
