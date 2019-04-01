# glorious-proxy-rotator

Simple proxy rotator

The original code is from [redco/goose-proxy-rotator](https://github.com/redco/goose-proxy-rotator), modified on [entrptaher/groovy-proxy-rotator](https://github.com/entrptaher/groovy-proxy-rotator) and [entrptaher/groovy-proxy-rotator-old](https://github.com/entrptaher/groovy-proxy-rotator-old) for sake of dockerization and ease of use.

# Usage

```js
proxy({ proxies, config }).then(() => console.log("Proxy running"));
```

The proxies look like an array, and you must provide a list,

```json
[
  { "host": "0.0.0.0", "port": 8001 },
  { "host": "0.0.0.0", "port": 8002, "auth": "username:password" }
]
```

The config can determine port and retries on error, these are set by default.

```json
{ "proxyPort": 3456, "retryDelay": 1000, "maxRetries": 3 }
```

### Limitations

- Sometimes the long-lived `keep-alive` requests drops.
- the package is by default `http` and not `https`, your proxy can be `https` but it will be served using `http`. You can ssl by some other means like cloudflare etc.

### TODO
- Add glorious tests
- Add option for different format for proxies