import fs from "fs/promises";

export default async function requireWhitelist(req, res, next) {
  const uuid = req.session.user?.uuid;

  if (!uuid) {
    return res.redirect("/login");
  }

  const allowed = await isWhitelisted(uuid);

  if (!allowed) {
    return res
      .status(403)
      .render("error", {
        message: "You are not whitelisted!",
        title: "Whitelist Error",
      });
  }

  next();
}

async function isWhitelisted(uuid) {
  const data = await fs.readFile(process.env.WHITELIST_PATH, "utf8");
  const whitelist = JSON.parse(data);

  return whitelist.some(
    (p) => p.uuid.replace(/-/g, "") === uuid.replace(/-/g, ""),
  );
}
