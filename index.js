"use strict";

const http = require("http");
const url = require("url");

// Importing these to contain this proxy system only for local usage
const isLocalHost = require("is-localhost");
const getClientIp = require("./libs/get-client-ip");

async function runServer({
  proxies = [],
  config = { proxyPort: 3456, retryDelay: 1000, maxRetries: 3 }
}) {
  const { proxyPort, retryDelay, maxRetries } = config;

  /**
   * @return {object}
   */
  const rotateProxyAddress = () => {
    const proxyAddress = proxies.shift();
    if (proxyAddress) {
      proxies.push(proxyAddress);
    }
    return proxyAddress;
  };

  /**
   * @param {ClientRequest} request
   * @param {object} proxy
   * @param {boolean} [ssl]
   */
  const getOptions = (request, { port, host, auth }, ssl) => {
    const options = {
      port,
      hostname: host,
      method: request.method,
      path: request.url,
      headers: request.headers || {}
    };
    if (auth) {
      options.headers["Proxy-Authorization"] = `Basic ${new Buffer(
        auth
      ).toString("base64")}`;
    }

    if (ssl !== undefined) {
      const ph = url.parse(`http://${request.url}`);
      options.method = "CONNECT";
      options.path = `${ph.hostname}:${ph.port || 80}`;
    }

    return options;
  };

  /**
   * Handles HTTP requests
   * @param request
   * @param response
   * @param retries
   */

  async function requestHandler(request, response, retries = 0) {
    console.log("requestHandler Request %s %s", request.method, request.url);
    const options = getOptions(request, rotateProxyAddress());
    const proxy = http.request(options);

    proxy
      .on("error", err => {
        if (++retries < maxRetries) {
          setTimeout(() => {
            requestHandler(request, response, retries);
          }, retryDelay);
        } else {
          console.log(`[error] ${err}`);
          response.end();
        }
      })
      .on("response", proxyResponse => {
        console.log("Response received");
        if (proxyResponse.statusCode === 407) {
          console.log("[error] AUTH REQUIRED");
          response.end();
        }
        proxyResponse
          .on("data", chunk => {
            response.write(chunk, "binary");
          })
          .on("error", function(e) {
            console.log(e);
            response.end();
          })
          .on("timeout", function() {
            console.log("Request Timeout");
            response.end();
          })
          .on("end", () => {
            console.log("Request Ends");
            response.end();
          });
        response.writeHead(proxyResponse.statusCode, proxyResponse.headers);
      });

    proxy.end();

    request
      .on("data", chunk => {
        proxy.write(chunk, "binary");
      })
      .on("end", () => {
        proxy.end();
      });

    return;
  }

  /**
   * Handles HTTPS requests
   * @param request
   * @param response
   * @param retries
   */
  async function socketHandler(request, socketRequest, retries = 0) {
    console.log("socketHandler Request %s %s", request.method, request.url);
    const options = getOptions(request, rotateProxyAddress(), true);

    const proxy = http.request(options);
    proxy
      .on("error", err => {
        console.log(`[error] ${err}`);
        if (++retries < maxRetries) {
          setTimeout(() => {
            socketHandler(request, socketRequest, retries);
          }, retryDelay);
        } else {
          socketRequest.end();
        }
      })
      .on("connect", (res, socket) => {
        socketRequest.write(
          `HTTP/${request.httpVersion} 200 Connection established\r\n\r\n`
        );

        // tunneling to host
        socket
          .on("data", chunk => {
            socketRequest.write(chunk, "binary");
          })
          .on("end", () => {
            socketRequest.end();
          })
          .on("error", () => {
            // notify client about an error
            socketRequest.write(
              `HTTP/${request.httpVersion} 500 Connection error\r\n\r\n`
            );
            socketRequest.end();
          });

        // tunneling to client
        socketRequest
          .on("data", chunk => {
            socket.write(chunk, "binary");
          })
          .on("end", () => {
            socket.end();
          })
          .on("error", () => {
            socket.end();
          });
      })
      .end();
    return;
  }

  /**
   * Master handler so we can do some checks before processing the real request
   * @param {string} method
   * @param {object} args
   */
  async function masterHandler(method, args) {
    const [request, response] = args;
  
    // Block outsiders
    const IP = getClientIp(request);
    const localUser = isLocalHost(IP);

    if (!localUser) {
      response.write("Access Denied");
      return response.end();
    }

    // Continue normally
    switch (method) {
      case "request":
        requestHandler(...args);
        break;
      case "connect":
        socketHandler(...args);
        break;
      default:
    }
  }

  if (!proxies.length) throw Error("No proxies provided");

  // create server
  const server = http.createServer();

  // handle requests
  server.on("request", (...args) => masterHandler("request", args));
  server.on("connect", (...args) => masterHandler("connect", args));

  console.log("Start proxy server on port %s", proxyPort);
  
  // Promisify server.listen
  // See: https://github.com/nodejs/node/issues/21482#issue-335076411
  return new Promise((res, rej) => server.listen(proxyPort, err => err ? rej(err) : res()));
}

module.exports = runServer;
