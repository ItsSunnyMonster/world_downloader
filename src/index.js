import dotenv from "dotenv";

dotenv.config();

import express from "express";
import session from "express-session";
import expressLayouts from "express-ejs-layouts";

import downloadRoutes from "./routes/downloads.js";
import authRoutes from "./routes/auth.js";
import requireLogin from "./middleware/requireLogin.js";
import requireWhitelist from "./middleware/requireWhitelist.js";

const app = express();

app.set("trust proxy", 1);
app.use(expressLayouts);
app.set("layout", "./layouts/layout.ejs");
app.set("view engine", "ejs");
app.set("views", "src/views");

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: "auto",
      sameSite: "lax",
    },
  }),
);

app.use("/", downloadRoutes);
app.use("/", authRoutes);

app.use("/static", express.static("src/public"));

app.get("/", requireLogin, requireWhitelist, (_, res) =>
  res.redirect("/downloads"),
);

app.get("/{*splat}", (req, res) => {
  res.status(404).render("404", { title: "404 Not Found", route: req.url });
});

app.listen(process.env.PORT, () => {
  console.log(`Server downloader listening on port ${process.env.PORT}`);
});
