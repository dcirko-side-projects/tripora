const fs = require("node:fs");
const path = require("node:path");
const { transpileModule, ModuleKind, JsxEmit } = require("typescript");
function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const code = transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX },
    }).outputText;
    new Function("require", "module", "exports", code)(
      (name) => {
        if (mocks[name]) return mocks[name];
        if (!name.startsWith(".")) return require(name);
        const target = path.resolve(path.dirname(file), name);
        if (target.includes(path.join("src", "core"))) {
          const compiled =
            target.replace(
              path.join("src", "core"),
              path.join(".test-build", "core"),
            ) + ".js";
          if (fs.existsSync(compiled)) return require(compiled);
        }
        for (const extension of [".tsx", ".ts"])
          if (fs.existsSync(target + extension))
            return load(target + extension);
        return require(target);
      },
      module,
      module.exports,
    );
    return module.exports;
  }
  return load;
}
module.exports = { loader };
