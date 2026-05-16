import express from "express";
import fs from "fs/promises";
import path from "path";
import requireLogin from "../middleware/requireLogin.js";
import requireWhitelist from "../middleware/requireWhitelist.js";
import { createDownloadToken, verifyDownloadToken } from "../utils/jwt.js";
import { createReadStream } from "fs";
import { sendMessage } from "../utils/webhook.js";

const router = express.Router();

async function downloadsRoute(req, res, directory, removeOldest) {
  const entries = await fs.readdir(directory, {
    withFileTypes: true,
  });

  const files = (
    await Promise.all(
      entries
        .filter((entry) => entry.isFile())
        .map(async (entry) => {
          const fullPath = path.join(directory, entry.name);
          const stat = await fs.stat(fullPath);

          if (stat.size === 0) return null;

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
    )
  ).filter(Boolean);

  const allowedFiles = removeOldest
    ? files
        .sort((a, b) => b.mtime - a.mtime) // newest first
        .slice(0, -2) // skip two oldest
    : files;

  res.render("downloads", {
    title: "Downloads",
    username: req.session.user.name,
    allowedFiles,
    old: directory === process.env.OLD_DOWNLOAD_DIR,
  });
}

async function downloadApiRoute(req, res, directory, removeOldest) {
  const filename = path.basename(req.query.file);

  // check the file is still allowed before sending it
  const entries = await fs.readdir(directory, {
    withFileTypes: true,
  });
  // Yes, it is still possible to download an empty archive but why would you do that
  const files = await Promise.all(
    entries
      .filter((e) => e.isFile())
      .map(async (e) => {
        const stat = await fs.stat(path.join(directory, e.name));
        return { name: e.name, mtime: stat.mtimeMs };
      }),
  );

  const allowedNames = removeOldest
    ? files
        .sort((a, b) => a.mtime - b.mtime)
        .slice(2)
        .map((f) => f.name)
    : files;

  if (!allowedNames.includes(req.query.file)) {
    return res.status(404).render("error", {
      title: "404 Not Found",
      message: `${req.query.file} is not available for download.`,
      action: "home",
    });
  }

  const token = createDownloadToken(
    filename,
    directory,
    req.session.user.name,
    req.session.user.uuid,
  );
  res.json({ url: `/download/${token}/${encodeURIComponent(filename)}` });
}

router.get("/downloads", requireLogin, requireWhitelist, async (req, res) => {
  sendMessage(
    `**${req.session.user.name}** (\`${req.session.user.uuid}\`) visited current download.`,
  );
  await downloadsRoute(req, res, process.env.DOWNLOAD_DIR, true);
});

router.get(
  "/old_downloads",
  requireLogin,
  requireWhitelist,
  async (req, res) => {
    sendMessage(
      `**${req.session.user.name}** (\`${req.session.user.uuid}\`) visited old download.`,
    );
    await downloadsRoute(req, res, process.env.OLD_DOWNLOAD_DIR, false);
  },
);

router.get(
  "/api/download",
  requireLogin,
  requireWhitelist,
  async (req, res) => {
    await downloadApiRoute(req, res, process.env.DOWNLOAD_DIR, true);
  },
);

router.get(
  "/api/old_download",
  requireLogin,
  requireWhitelist,
  async (req, res) => {
    await downloadApiRoute(req, res, process.env.OLD_DOWNLOAD_DIR, false);
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

  sendMessage(
    `**${payload.username}** (\`${payload.userId}\`) downloaded \`${payload.filename}\`.`,
  );

  const filepath = path.join(payload.directory, payload.filename);
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

    createReadStream(filepath, { start, end: chunkEnd }).pipe(res);
  } else {
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": "application/zip",
    });

    createReadStream(filepath).pipe(res);
  }
});

export default router;
