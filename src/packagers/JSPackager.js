const {Readable} = require('stream');
const fs = require('fs');
const {basename} = require('path');

const prelude = fs.readFileSync(__dirname + '/prelude.js', 'utf8').trim();

class JSPackager extends Readable {
  constructor(options) {
    super();
    this.options = options;
    this.first = true;
    this.dedupe = new Map;
    this.bundle = null;
  }

  _read() {}

  generatePrelude(bundle) {
    this.bundle = bundle;
    this.push(prelude + '({');
  }

  addAsset(asset) {
    if (this.dedupe.has(asset.generated.js)) {
      return;
    }

    this.dedupe.set(asset.generated.js, asset.id);

    let wrapped = this.first ? '' : ',';
    wrapped += asset.id + ':[function(require,module,exports) {\n' + asset.generated.js + '\n},';

    let deps = {};
    for (let dep of asset.dependencies.values()) {
      let mod = asset.depAssets.get(dep.name);

      // For dynamic dependencies, list the child bundles to load along with the module id
      if (dep.dynamic && this.bundle.childBundles.has(mod.parentBundle)) {
        let bundles = [basename(mod.parentBundle.name)];
        for (let child of mod.parentBundle.typeBundleMap.values()) {
          if (!child.isEmpty) {
            bundles.push(basename(child.name));
          }
        }

        bundles.push(mod.id);
        deps[dep.name] = bundles;
      } else {
        deps[dep.name] = this.dedupe.get(mod.generated.js) || mod.id;
      }
    }

    wrapped += JSON.stringify(deps);
    wrapped += ']';

    this.first = false;
    this.push(wrapped);
  }

  end() {
    // Load the entry module if this is the root bundle
    let entry = [];
    if (this.bundle.entryAsset) {
      entry.push(this.bundle.entryAsset.id);
    }

    this.push('},{},' + JSON.stringify(entry) + ')');
    this.push(null);
  }
}

module.exports = JSPackager;