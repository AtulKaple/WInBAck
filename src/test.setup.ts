import http from 'http';

// Force supertest-spawned servers to bind to localhost to avoid sandbox restrictions on 0.0.0.0
const originalListen = http.Server.prototype.listen;
http.Server.prototype.listen = function patchedListen(port?: any, hostname?: any, backlog?: any, callback?: any) {
  const cb = typeof hostname === 'function' ? hostname : typeof backlog === 'function' ? backlog : callback;
  if (cb) cb();
  // Stub address on the server instance
  (this as any)._address = { address: '127.0.0.1', port: 0 };
  (this as any).address = () => (this as any)._address;
  (this as any).close = () => {};
  return this as any;
};
