const proxy = require("./index");
proxy({ proxies: [{ host: "0.0.0.0", port: 8001 }] });
