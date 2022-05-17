import { BuildTool, BuildToolTest } from "./BuildTool";
import fileSystem from "fs-extra";
import { join, relative } from "path";
import { Plugin, InputOptions } from "rollup";
import rollupTypescript from "rollup-plugin-ts";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { watchForBuild } from "./watch";

import inquirer from "inquirer";

import { build, buildTest } from "./build";

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
        watchForBuild(
          buildTool,
          build,
          join(buildTool.rootPath, "src", "**", "*.ts")
        );
      }
    });
}

export function buildMarionextTest() {
  let buildTool: BuildToolTest;
  BuildTool.init(process.cwd())
    .then(async (buildToolInstance) => {
      try {
        buildTool = buildToolInstance as BuildToolTest;
        const availableTests = (await fileSystem.readJSON(
          join(buildToolInstance.rootPath, "tests", "tests.json")
        )) as string[];
        return availableTests;
      } catch (error) {
        throw error;
      }
    })
    .then(async (availableTests) => {
      try {
        const userRequest = await inquirer.prompt({
          type: "list",
          name: "test",
          message: "Sélectionnez le test à effectuer",
          validate: (answer) => {
            if (answer.length < 1) {
              return "Vous devez sélectionner un test";
            }
            return true;
          },
          choices: availableTests
        });
        return userRequest as { test: string };
      } catch (error) {
        throw error;
      }
    })
    .then(async (userRequest) => {
      try {
        const json = (await fileSystem.readJSON(
          join(buildTool.rootPath, "tests", userRequest.test, "build.json")
        )) as {
          path: string;
          src: string;
          out: string;
        };
        buildTool.set("test.name", json.path);
        const testPath = join(buildTool.rootPath, "tests", json.path);
        buildTool.set("test.path", testPath);
        buildTool.set("test.src", join(testPath, json.src));
        buildTool.set("test.out", join(testPath, json.out));
        buildTool.start = process.hrtime();
        const inputOptions: InputOptions = {
          input: buildTool.test.src,
          onwarn({ loc, frame, message }) {
            if (loc) {
              console.warn(
                `${loc.file} (${loc.line}:${loc.column}) ${message}`
              );
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
        buildTool.rollupOptions = {
          input: inputOptions,
          output: {
            file: buildTool.test.out,
            format: "esm"
          }
        };
        return buildTest(buildTool);
      } catch (error) {
        throw error;
      }
    })
    .finally(() => {
      watchForBuild(
        buildTool,
        buildTest,
        join(buildTool.test.path, "**", "*.ts")
      );
    });
}
