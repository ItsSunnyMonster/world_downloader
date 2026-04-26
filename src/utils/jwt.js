import jwt from "jsonwebtoken";

export function createDownloadToken(filename, userId) {
  return jwt.sign({ filename, userId }, process.env.DOWNLOAD_SECRET, {
    expiresIn: "30m",
  });
}

export function verifyDownloadToken(token) {
  return jwt.verify(token, process.env.DOWNLOAD_SECRET); // throws if invalid/expired
}
