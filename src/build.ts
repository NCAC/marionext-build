import { BuildTool, BuildToolTest } from "./BuildTool";
import { prettyDtsFile, prettyOutJsFile } from "./prettyFiles";
import { relative } from "path";
import { bundle } from "./bundle";

export async function build(buildTool: BuildTool) {
  try {
    await bundle(buildTool, buildTool.distPath, buildTool.rollupOptions);
    buildTool.log(
      `The file ${relative(
        buildTool.rootPath,
        buildTool.outJsFile
      )} has been succesfully bundled.`,
      buildTool.duration(buildTool.start)
    );
    await prettyOutJsFile(buildTool.outJsFile, buildTool.distPath);
    return await prettyDtsFile(buildTool.outDtsFile, buildTool.distPath);
  } catch (err) {
    buildTool.logError(err);
  }
}

export async function buildTest(buildTool: BuildToolTest) {
  try {
    await bundle(buildTool, buildTool.test.path, buildTool.rollupOptions);
    buildTool.log(
      `The file ${relative(
        buildTool.test.path,
        buildTool.test.out
      )} has been succesfully bundled.`,
      buildTool.duration(buildTool.start)
    );
    return await prettyOutJsFile(buildTool.test.out, buildTool.test.path);
  } catch (err) {
    buildTool.logError(err);
  }
}
