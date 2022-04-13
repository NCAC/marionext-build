import { BuildTool } from "./BuildTool";
import fileSystem from "fs-extra";
import { throttle } from "lodash-es";
import { join, relative } from "path";
import { watch } from "chokidar";
import {
  rollup,
  InputOptions,
  OutputOptions,
  RollupBuild,
  Plugin
} from "rollup";
import rollupTypescript from "rollup-plugin-ts";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import vinylFileSystem from "vinyl-fs";
import prettier from "gulp-prettier";

async function bundlePackage(buildTool: BuildTool): Promise<void> {
  let bundle: RollupBuild;
  try {
    await fileSystem.ensureDir(buildTool.distPath);
    bundle = await rollup(buildTool.rollupOptions.input);
    await (bundle as RollupBuild).write(buildTool.rollupOptions.output);
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
    buildTool.logError(errorMessage);
  }
  if (bundle) {
    await (bundle as RollupBuild).close();
  }
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
  watch?: boolean;
  plugins?: Plugin[];
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
        }
      };
      if (!opts?.plugins) {
        inputOptions.plugins = [
          nodeResolve(),
          rollupTypescript({
            tsconfig: join(buildTool.rootPath, "tsconfig.json")
          })
        ];
      } else {
        inputOptions.plugins = opts.plugins;
      }

      if (!opts?.includeExternal && buildTool.pkg.dependencies) {
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
      if (opts?.watch) {
        watchForBuild(buildTool);
      }
    });
}
