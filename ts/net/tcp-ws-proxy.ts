"use strict";

import makeChannel from 'culvert';
import wrapHandler from '../lib/wrap-handler';

export default function (proxyUrl) {
  if (proxyUrl[proxyUrl.length - 1] !== "/") proxyUrl += "/";

  return function connect(host, port, onError) {
    port = port|0;
    host = String(host);
    if (!port || !host) throw new TypeError("host and port are required");

    onData = wrapHandler(onData, onError);

    const serverChannel = makeChannel();
    const clientChannel = makeChannel();
    const socket = {
      put: serverChannel.put,
      drain: serverChannel.drain,
      take: clientChannel.take
    };

    let connected = false;
    const ws = new WebSocket(proxyUrl  + "tcp/" + host + "/" + port);
    ws.binaryType = "arraybuffer";

    ws.onopen = wrap(onOpen, onError);
    ws.onclose = wrap(onClose, onError);
    ws.onmessage = wrap(onMessage, onError);
    ws.onerror = wrap(onWsError, onError);

    return {
      put: clientChannel.put,
      drain: clientChannel.drain,
      take: serverChannel.take
    };

    function onOpen() {
      ws.send("connect");
    }

    function onClose() {
      socket.put();
    }

    function onMessage(evt) {
      if (!connected && evt.data === "connect") {
        connected = true;
        socket.take(onData);
        return;
      }

      socket.put(new Uint8Array(evt.data));
    }

    function onWsError() {
      console.error(arguments);
      throw new Error("Generic websocket error");
    }

    function onData(chunk) {
      ws.send(chunk.buffer);
      socket.take(onData);
    }

  };
};

function wrap(fn, onError) {
  return function () {
    try {
      return fn.apply(this, arguments);
    }
    catch (err) {
      onError(err);
    }
  };
}
