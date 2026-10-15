'use strict';
// Shared unchanged body/traffic settings for both standalone demos.
const CrowdProfiles = Object.freeze({
  marine: Object.freeze({ radius: 0.4, maxSlope: 0.6, maxSpeed: 2, traffic: 'cooperative' }),
  tank: Object.freeze({ radius: 1.4, maxSlope: 0.6, maxSpeed: 2, traffic: 'independent-detour' }),
});
