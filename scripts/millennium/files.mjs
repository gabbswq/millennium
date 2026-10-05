import fs from 'node:fs';

// Parent directories must remain private/trusted; no-follow applies to the leaf.
export function readRegularFile(file, { encoding = 'utf8', missingOk = false } = {}) {
  let fd;
  try {
    fd = fs.openSync(file, fs.constants.O_RDONLY |
      (fs.constants.O_NOFOLLOW ?? 0) | (fs.constants.O_NONBLOCK ?? 0));
    const opened = fs.fstatSync(fd, { bigint: true });
    const entry = fs.lstatSync(file, { bigint: true });
    if (!opened.isFile() || !entry.isFile() || opened.dev !== entry.dev || opened.ino !== entry.ino) {
      throw new Error('Registro de arquivo inseguro. Preserve os registros.');
    }
    return fs.readFileSync(fd, encoding);
  } catch (error) {
    if (missingOk && error.code === 'ENOENT') {
      if (fs.lstatSync(file, { throwIfNoEntry: false })) {
        throw new Error('Registro de arquivo inseguro. Preserve os registros.');
      }
      return null;
    }
    if (error.code === 'ELOOP') throw new Error('Registro de arquivo inseguro. Preserve os registros.');
    throw error;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}
