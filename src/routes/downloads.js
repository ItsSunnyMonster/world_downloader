import express from "express";
import fs from "fs/promises";
import path from "path";
import requireLogin from "../middleware/requireLogin.js";
import requireWhitelist from "../middleware/requireWhitelist.js";
import { createDownloadToken, verifyDownloadToken } from "../utils/jwt.js";
import { createReadStream } from "fs";

const router = express.Router();

router.get("/downloads", requireLogin, requireWhitelist, async (req, res) => {
  const entries = await fs.readdir(process.env.DOWNLOAD_DIR, {
    withFileTypes: true,
  });

  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const fullPath = path.join(process.env.DOWNLOAD_DIR, entry.name);
        const stat = await fs.stat(fullPath);
        return {
          name: entry.name,
          mtime: stat.mtimeMs,
          size:
            stat.size >= 1_000_000_000
              ? `${Math.round((stat.size / 1_000_000_000) * 100) / 100}GB`
              : stat.size >= 1_000_000
                ? `${Math.round((stat.size / 1_000_000) * 100) / 100}MB`
                : `${Math.round((stat.size / 1000) * 100) / 100}KB`,
        };
      }),
  );

  const allowedFiles = files
    .sort((a, b) => b.mtime - a.mtime) // newest first
    .slice(0, -2); // skip two oldest

  res.render("downloads", {
    title: "Downloads",
    username: req.session.user.name,
    allowedFiles,
  });
});

router.get(
  "/api/download",
  requireLogin,
  requireWhitelist,
  async (req, res) => {
    const filename = path.basename(req.query.file);

    // check the file is still allowed before sending it
    const entries = await fs.readdir(process.env.DOWNLOAD_DIR, {
      withFileTypes: true,
    });
    const files = await Promise.all(
      entries
        .filter((e) => e.isFile())
        .map(async (e) => {
          const stat = await fs.stat(
            path.join(process.env.DOWNLOAD_DIR, e.name),
          );
          return { name: e.name, mtime: stat.mtimeMs };
        }),
    );

    const allowedNames = files
      .sort((a, b) => a.mtime - b.mtime)
      .slice(2)
      .map((f) => f.name);

    if (!allowedNames.includes(req.query.file)) {
      return res.status(404).render("error", {
        title: "404 Not Found",
        message: `${req.query.file} is not available for download.`,
        action: "home",
      });
    }

    const token = createDownloadToken(filename, req.session.user.uuid);
    res.json({ url: `/download/${token}/${encodeURIComponent(filename)}` });
  },
);

router.get("/download/:token/:filename", async (req, res) => {
  let payload;
  try {
    payload = verifyDownloadToken(req.params.token);
  } catch (err) {
    return res.status(401).render("error", {
      title: "401 Unauthorized",
      message: "Download link is invalid or has expired.",
      action: "home",
    });
  }

  if (payload.filename != req.params.filename) {
    return res.status(400).render("error", {
      title: "400 Bad Request",
      message: "File name does not match the download token.",
      action: "home",
    });
  }

  const filepath = path.join(process.env.DOWNLOAD_DIR, payload.filename);
  const stat = await fs.stat(filepath);
  const fileSize = stat.size;
  const range = req.headers.range;

  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${payload.filename}"`,
  );

  if (range) {
    const [start, end] = range
      .replace(/bytes=/, "")
      .split("-")
      .map(Number);
    const chunkEnd = end || fileSize - 1;
    const chunkSize = chunkEnd - start + 1;

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${chunkEnd}/${fileSize}`,
      "Content-Length": chunkSize,
      "Content-Type": "application/zip",
    });

    fs.createReadStream(filepath, { start, end: chunkEnd }).pipe(res);
  } else {
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": "application/zip",
    });

    createReadStream(filepath).pipe(res);
  }
});

export default router;
