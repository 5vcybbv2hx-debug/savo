import {
  dist_exports,
  init_dist
} from "./chunk-P3F6VUR2.js";
import {
  __commonJS,
  __toCommonJS
} from "./chunk-OL46QLBJ.js";

// node_modules/@base44/vite-plugin/compat/base44Client.cjs
var require_base44Client = __commonJS({
  "node_modules/@base44/vite-plugin/compat/base44Client.cjs"(exports, module) {
    var { createClient } = (init_dist(), __toCommonJS(dist_exports));
    module.exports.base44 = createClient({
      appId: process.env.VITE_BASE44_APP_ID,
      serverUrl: process.env.VITE_BASE44_BACKEND_URL
    });
  }
});

// node_modules/@base44/vite-plugin/compat/entities.cjs
var require_entities = __commonJS({
  "node_modules/@base44/vite-plugin/compat/entities.cjs"(exports, module) {
    var { base44 } = require_base44Client();
    module.exports = new Proxy({}, {
      get: (_, entityName) => {
        return new Proxy({}, {
          get: (_2, prop) => {
            if (entityName === "User") {
              if (prop === "me") {
                return base44.auth.me;
              }
              if (prop === "loginWithRedirect" || prop === "login") {
                return base44.auth.loginWithRedirect;
              }
              if (prop === "logout") {
                return base44.auth.logout;
              }
              if (prop === "updateMyUserData") {
                return base44.auth.updateMe;
              }
            }
            return base44.entities[entityName][prop];
          }
        });
      }
    });
  }
});
export default require_entities();
//# sourceMappingURL=@_api_entities.js.map
