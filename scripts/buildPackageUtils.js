const { build } = require("esbuild");
const { sassPlugin } = require("esbuild-sass-plugin");

const path = require("path");
const fs = require("fs");

const browserConfig = {
  entryPoints: ["index.ts"],
  bundle: true,
  format: "esm",
  plugins: [sassPlugin()],
  loader: {
    ".woff2": "copy",
    ".ttf": "copy",
  },
};

function getFiles(dir, files = []) {
  const fileList = fs.readdirSync(dir);
  for (const file of fileList) {
    const name = `${dir}/${file}`;
    if (
      name.includes("node_modules") ||
      name.includes("config") ||
      name.includes("package.json") ||
      name.includes("main.js") ||
      name.includes("index-node.ts") ||
      name.endsWith(".d.ts") ||
      name.endsWith(".md")
    ) {
      continue;
    }

    if (fs.statSync(name).isDirectory()) {
      getFiles(name, files);
    } else if (
      name.match(/\.(sa|sc|c)ss$/) ||
      name.match(/\.(woff|woff2|eot|ttf|otf)$/) ||
      name.match(/locales\/[^/]+\.json$/)
    ) {
      continue;
    } else {
      files.push(name);
    }
  }
  return files;
}
const createESMBrowserBuild = async () => {
  // Development unminified build with source maps
  const result = await build({
    ...browserConfig,
    outdir: "dist/browser/dev",
    sourcemap: true,
    metafile: true,
  });
  fs.writeFileSync("meta.json", JSON.stringify(result.metafile));

  // production minified build without sourcemaps
  await build({
    ...browserConfig,
    outdir: "dist/browser/prod",
    minify: true,
  });
};

const rawConfig = {
  bundle: true,
  format: "esm",
  packages: "external",
};

const BASE_PATH = `${path.resolve(`${__dirname}/..`)}`;
const filesinExcalidrawPackage = getFiles(`${BASE_PATH}/packages/utils`);

const filesToTransform = filesinExcalidrawPackage.filter((file) => {
  return !(
    file.includes("/__tests__/") ||
    file.includes(".test.") ||
    file.includes("/tests/") ||
    file.includes("example")
  );
});
const createESMRawBuild = async () => {
  // Development unminified build with source maps
  await build({
    ...rawConfig,
    entryPoints: filesToTransform,
    outdir: "dist",
    bundle: false,
  });
};

//createESMRawBuild();
createESMBrowserBuild();
