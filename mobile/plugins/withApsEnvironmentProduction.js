const { withEntitlementsPlist } = require('expo/config-plugins');

/**
 * Forces the iOS `aps-environment` entitlement to `production`.
 *
 * Expo prebuild emits `development` by default. App Store / TestFlight builds
 * must use `production` so the device registers a production APNs token — which
 * is what the Expo push service (and our backend's Expo push path) delivers to.
 *
 * This is applied via a config plugin (not a hand-edit of ios/) so it survives
 * `expo prebuild --clean` in the local-archive workflow.
 */
module.exports = function withApsEnvironmentProduction(config) {
  return withEntitlementsPlist(config, (cfg) => {
    cfg.modResults['aps-environment'] = 'production';
    return cfg;
  });
};
