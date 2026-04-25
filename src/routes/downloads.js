import express from "express";
import fs from "fs/promises";
import path from "path";
import requireLogin from "../middleware/requireLogin.js";
import requireWhitelist from "../middleware/requireWhitelist.js";

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
            stat.size >= 1_073_741_824
              ? `${Math.round((stat.size / 1_073_741_824) * 100) / 100}GiB`
              : stat.size >= 1_048_576
                ? `${Math.round((stat.size / 1_048_576) * 100) / 100}MiB`
                : `${Math.round((stat.size / 1024) * 100) / 100}KiB`,
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
  "/downloads/:name",
  requireLogin,
  requireWhitelist,
  async (req, res) => {
    const filePath = path.join(process.env.DOWNLOAD_DIR, req.params.name);

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

    if (!allowedNames.includes(req.params.name)) {
      return res.status(403).send("This file is not available for download.");
    }

    res.download(filePath);
  },
);

export default router;
