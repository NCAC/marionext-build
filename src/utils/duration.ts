import chalk from "chalk";
import prettyTime from "pretty-hrtime";

export function duration(start: [number, number]) {
  return chalk.magenta(prettyTime(process.hrtime(start)));
}
