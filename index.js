const express = require("express");
const fs = require("fs/promises");
const path = require("path");

const app = express();

const port = 8080;

const FILE_DIR = "/Users/sunnymonster/Downloads";

app.get("/", async (_, res) => {
  const entries = await fs.readdir(FILE_DIR, { withFileTypes: true });

  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const fullPath = path.join(FILE_DIR, entry.name);
        const stat = await fs.stat(fullPath);
        return {
          name: entry.name,
          mtime: stat.mtimeMs,
        };
      }),
  );

  const allowedFiles = files
    .sort((a, b) => a.mtime - b.mtime) // oldest first
    .slice(2); // skip two oldest

  res.send(`
    <h1>World Downloads</h1>
    <ul>
      ${allowedFiles
        .map(
          (file) =>
            `<li><a href="/download/${encodeURIComponent(file.name)}">${file.name}</a></li>`,
        )
        .join("")}
    </ul>
  `);
});

app.get("/download/:name", async (req, res) => {
  const filePath = path.join(FILE_DIR, req.params.name);

  // check the file is still allowed before sending it
  const entries = await fs.readdir(FILE_DIR, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((e) => e.isFile())
      .map(async (e) => {
        const stat = await fs.stat(path.join(FILE_DIR, e.name));
        return { name: e.name, mtime: stat.mtimeMs };
      }),
  );

  const allowedNames = files
    .sort((a, b) => a.mtime - b.mtime)
    .slice(2)
    .map((f) => f.name);

  if (!allowedNames.includes(req.params.name)) {
    return res.status(403).send("This file is not available for download.");
  }

  res.download(filePath);
});

app.listen(port, () => {
  console.log(`Server downloader listening on port ${port}`);
});
