import { copyFile, mkdir } from "node:fs/promises";
import { constants } from "node:fs";

const root = new URL("../", import.meta.url);
await mkdir(new URL("context/", root), { recursive: true });
for (const name of ["product-passport.md", "decision-log.md"]) {
  try {
    await copyFile(new URL(`templates/context/${name}`, root), new URL(`context/${name}`, root), constants.COPYFILE_EXCL);
    console.log(`Created private context/${name}`);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    console.log(`Preserved existing context/${name}`);
  }
}
