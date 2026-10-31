// On exFAT drives, fs.readlink on a regular file fails with EISDIR instead of EINVAL.
// Tools (webpack, Next.js, enhanced-resolve) treat EINVAL as "not a symlink" and crash on EISDIR.
// This preload rewrites EISDIR to EINVAL for readlink only. It is a no-op on NTFS/ext4/APFS.
const fs = require("node:fs");

function toEinval(err) {
  if (err && err.code === "EISDIR") {
    err.code = "EINVAL";
    err.errno = -22;
  }
  return err;
}

const readlink = fs.readlink;
fs.readlink = function patchedReadlink(path, options, callback) {
  const cb = typeof options === "function" ? options : callback;
  const opts = typeof options === "function" ? undefined : options;
  return readlink.call(fs, path, opts, (err, res) => cb(toEinval(err), res));
};

const readlinkSync = fs.readlinkSync;
fs.readlinkSync = function patchedReadlinkSync(path, options) {
  try {
    return readlinkSync.call(fs, path, options);
  } catch (err) {
    throw toEinval(err);
  }
};

const promisesReadlink = fs.promises.readlink;
fs.promises.readlink = async function patchedPromisesReadlink(path, options) {
  try {
    return await promisesReadlink.call(fs.promises, path, options);
  } catch (err) {
    throw toEinval(err);
  }
};
