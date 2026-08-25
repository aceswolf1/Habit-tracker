import { d as defineEventHandler, p as proxyRequest } from '../../../nitro/nitro.mjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:url';

const ____path_ = defineEventHandler((event) => {
  const backendUrl = process.env.BACKEND_URL || "http://localhost:4000";
  return proxyRequest(event, `${backendUrl}${event.path}`);
});

export { ____path_ as default };
//# sourceMappingURL=_...path_.mjs.map
