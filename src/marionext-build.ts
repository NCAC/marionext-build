import { BuildTool } from "./BuildTool";
import fileSystem from "fs-extra";
import { throttle } from "lodash-es";
import { join, relative } from "path";
import { watch } from "chokidar";
import { rollup, InputOptions, OutputOptions, RollupBuild } from "rollup";
import rollupTypescript from "rollup-plugin-ts";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import vinylFileSystem from "vinyl-fs";
import prettier from "gulp-prettier";

async function bundlePackage(buildTool: BuildTool): Promise<void> {
  let bundle;
  try {
    await fileSystem.ensureDir(buildTool.distPath);
    bundle = await rollup(buildTool.rollupOptions.input);
    await bundle.write(buildTool.rollupOptions.output);
  } catch (error) {
    let errorMessage = "\n";
    Object.entries(error).forEach(([k, v]) => {
      if (typeof v !== "string") {
        v = JSON.stringify(v);
      }
      errorMessage += `
          * ${k}: ${v}
        `;
    });
  }
  if (bundle) {
    await bundle.close();
  }
  // return new Promise((resolve, reject) => {
  //   ensureDir(buildTool.distPath)
  //     .then(() => {
  //       return rollup(buildTool.rollupOptions.input);
  //     })
  //     .catch((err) => {
  //       let errorMessage = "\n";
  //       Object.entries(err).forEach(([k, v]) => {
  //         if (typeof v !== "string") {
  //           v = JSON.stringify(v);
  //         }
  //         errorMessage += `
  //         * ${k}: ${v}
  //       `;
  //       });
  //       buildTool.logError(errorMessage);
  //       reject(err);
  //     })
  //     .then((bundle: RollupBuild) => {
  //       return bundle.write(buildTool.rollupOptions.output);
  //     })
  //     .catch((err) => {
  //       let errorMessage = "\n";
  //       Object.entries(err).forEach(([k, v]) => {
  //         if (typeof v !== "string") {
  //           v = JSON.stringify(v);
  //         }
  //         errorMessage += `
  //         * ${k}: ${v}
  //       `;
  //       });
  //       buildTool.logError(errorMessage);
  //       reject(err);
  //     })
  //     .then(resolve);
  // });
}

function prettyDtsFile(buildTool: BuildTool): Promise<void> {
  return new Promise((resolve, reject) => {
    vinylFileSystem
      .src(buildTool.outDtsFile)
      .pipe(prettier())
      .pipe(vinylFileSystem.dest(buildTool.distPath))
      .on("error", reject)
      .on("end", resolve);
  });
}

function prettyOutJsFile(buildTool: BuildTool): Promise<void> {
  return new Promise((resolve, reject) => {
    vinylFileSystem
      .src(buildTool.outJsFile)
      .pipe(prettier())
      .pipe(vinylFileSystem.dest(buildTool.distPath))
      .on("error", reject)
      .on("end", resolve);
  });
}

async function build(buildTool: BuildTool) {
  try {
    await bundlePackage(buildTool);
    buildTool.log(
      `The file ${relative(
        buildTool.rootPath,
        buildTool.outJsFile
      )} has been succesfully bundled.`,
      buildTool.duration(buildTool.start)
    );
    await prettyOutJsFile(buildTool);
    return await prettyDtsFile(buildTool);
  } catch (err) {
    buildTool.logError(err);
  }
}

function watchForBuild(buildTool: BuildTool) {
  const watcher = watch(join(buildTool.rootPath, "src", "**", "*.ts"));
  watcher.on("change", (updatedPath) => {
    buildTool.log(`${updatedPath} has been updated, we rebuild ..`);
    buildTool.start = process.hrtime();
    throttle(build, 250)();
  });
}

export interface IBuildMarionextOptions {
  includeExternal?: boolean;
}

export function buildMarionextPackage(opts: IBuildMarionextOptions) {
  let buildTool: BuildTool;
  BuildTool.init(process.cwd())
    .then((buildToolInstance) => {
      buildTool = buildToolInstance;
      buildTool.start = process.hrtime();

      const inputOptions: InputOptions = {
        input: buildTool.srcFile,
        onwarn({ loc, frame, message }) {
          if (loc) {
            console.warn(`${loc.file} (${loc.line}:${loc.column}) ${message}`);
            if (frame) console.warn(frame);
          } else {
            console.warn(message);
          }
        },
        plugins: [
          nodeResolve(),
          rollupTypescript({
            tsconfig: join(buildTool.rootPath, "tsconfig.json")
          })
        ]
      };

      if (!opts.includeExternal) {
        inputOptions.external = Object.keys(buildTool.pkg.dependencies);
      }

      buildTool.rollupOptions = {
        input: inputOptions,
        output: {
          file: buildTool.outJsFile,
          format: "esm"
        }
      };

      return build(buildTool);
    })
    .finally(() => {
      watchForBuild(buildTool);
    });
}
