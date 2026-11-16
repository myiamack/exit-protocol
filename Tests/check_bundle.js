/* Standing check: rules/rules.bundle.js must match the ES modules in rules/.
   Run from the repo folder:  node Tests/check_bundle.js
   FAIL means someone changed a rule file and did not rebuild. Fix: npm run build
   Also checks that the bundle loads in a plain script scope and gives the same classes as the modules. */
const fs = require("fs");
const vm = require("vm");
const { buildBundle, modules, OUT } = require("../tools/build-rules.js");
const EP = require("../rules/index.js");

let pass = 0, fail = 0;
function ok(name, cond, info) {
  console.log((cond ? "PASS  " : "FAIL  ") + name + (info !== undefined ? "  -> " + info : ""));
  cond ? pass++ : fail++;
}

const onDisk = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8").replace(/\r\n/g, "\n") : "";
ok("rules/rules.bundle.js exists", onDisk.length > 0);
ok("bundle matches the modules (if not: npm run build)", onDisk === buildBundle());

/* Load the bundle the way a browser does: one plain script, global EP. */
const sandbox = {};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
let loaded = true;
try { vm.runInContext(onDisk, sandbox, { filename: "rules.bundle.js" }); } catch (e) { loaded = false; console.log(e.stack); }
ok("bundle loads as a plain script", loaded && !!sandbox.EP);

const names = modules().map(m => m.name);
const bundleNames = Object.keys(sandbox.EP || {});
ok("bundle sets the same names as rules/index.js", names.join() === bundleNames.join(), bundleNames.join(", "));
const moduleNames = Object.keys(EP).filter(k => k !== "default" && k !== "__esModule").sort();
ok("modules export the same names as rules/index.js", names.slice().sort().join() === moduleNames.join(), moduleNames.join(", "));

/* Same numbers in both: compare every static number, string and array on each class (recursively, one level). */
function statics(obj) {
  const out = {};
  for (const k of Object.getOwnPropertyNames(obj)) {
    const v = obj[k];
    if (["length", "name", "prototype", "caller", "arguments"].includes(k)) continue;
    if (typeof v === "function") out[k] = "fn:" + Object.getOwnPropertyNames(v.prototype || {}).sort().join("|");
    else out[k] = JSON.stringify(v);
  }
  return out;
}
for (const n of names) {
  const a = JSON.stringify(statics(EP[n])), b = sandbox.EP && sandbox.EP[n] ? JSON.stringify(statics(sandbox.EP[n])) : "";
  ok(n + ": same constants and methods in bundle and module", a === b);
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
