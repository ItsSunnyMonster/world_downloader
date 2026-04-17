import express from "express";
import session from "express-session";
import dotenv from "dotenv";

import downloadRoutes from "./routes/downloads.js";
import authRoutes from "./routes/auth.js";
import requireLogin from "./middleware/requireLogin.js";
import requireWhitelist from "./middleware/requireWhitelist.js";

dotenv.config();

const app = express();

app.set("trust proxy", 1);

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

app.get("/", requireLogin, requireWhitelist, (_, res) =>
  res.redirect("/downloads"),
);

app.listen(process.env.PORT, () => {
  console.log(`Server downloader listening on port ${process.env.PORT}`);
});
