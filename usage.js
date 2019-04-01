const proxy = require("./index");

// Showcases a simple connection
proxy({ proxies: [{ host: "0.0.0.0", port: 8001 }] }).then(() =>
  console.log("Proxy running")
);
