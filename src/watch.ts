import { BuildTool, BuildToolTest } from "./BuildTool";
import { watch } from "chokidar";
import { throttle } from "lodash-es";
import { build, buildTest } from "./build";

export function watchForBuild(
  buildTool: BuildTool,
  buildFn: typeof build | typeof buildTest,
  srcPath: string
) {
  // const srcPath = join
  const watcher = watch(srcPath);
  watcher.on("change", (updatedPath) => {
    buildTool.log(`${updatedPath} has been updated, we rebuild ..`);
    buildTool.start = process.hrtime();
    throttle(buildFn, 250)(buildTool);
  });
}
