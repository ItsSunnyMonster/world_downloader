import jwt from "jsonwebtoken";

export function createDownloadToken(filename, directory, username, userId) {
  return jwt.sign(
    { filename, directory, username, userId },
    process.env.DOWNLOAD_SECRET,
    {
      expiresIn: "30m",
    },
  );
}

export function verifyDownloadToken(token) {
  return jwt.verify(token, process.env.DOWNLOAD_SECRET); // throws if invalid/expired
}
