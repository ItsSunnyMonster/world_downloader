import express from "express";
import requireLogin from "../middleware/requireLogin.js";
import requireWhitelist from "../middleware/requireWhitelist.js";

const router = express.Router();

router.get("/nav", requireLogin, requireWhitelist, (req, res) => {
  res.render("nav", { title: "Navigation", username: req.session.user.name });
});

export default router;
