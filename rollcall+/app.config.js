const appJson = require("./app.json");

const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  appJson.expo.extra?.apiBaseUrl ||
  "https://rollcallplus-api.rollcallplus.workers.dev";

module.exports = {
  ...appJson.expo,
  extra: {
    ...appJson.expo.extra,
    apiBaseUrl,
  },
};
