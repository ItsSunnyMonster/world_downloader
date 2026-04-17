import express from "express";
import crypto from "crypto";
import fetchJson from "../utils/fetchJson.js";

const router = express.Router();

router.get("/login", (req, res) => {
  if (req.session.user) {
    return res.redirect("/downloads");
  }

  res.send(`
    <h1>Minecraft SMP Backups</h1>
    <p>Log in to access world backups.</p>
    <a href="/auth/microsoft">Login with Microsoft</a>
  `);
});

router.get("/auth/microsoft", (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");
  const nonce = crypto.randomBytes(16).toString("hex");

  req.session.oauthState = state;
  req.session.oauthNonce = nonce;

  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID,
    response_type: "code",
    redirect_uri: `${process.env.BASE_URL}/auth/callback`,
    response_mode: "query",
    scope: "xboxlive.signin",
    state,
    nonce,
  });

  res.redirect(
    `https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?${params}`,
  );
});

router.get("/auth/callback", async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    console.error("OAuth error:", error, error_description);
    return res.status(400).send(`Login failed: ${error}\n${error_description}`);
  }

  if (!code) {
    return res.status(400).send("No authorization code returned");
  }

  if (state !== req.session.oauthState) {
    return res.status(400).send("State mismatch");
  }

  try {
    const tokenData = await fetchJson(
      "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: process.env.MICROSOFT_CLIENT_ID,
          client_secret: process.env.MICROSOFT_CLIENT_SECRET,
          code,
          grant_type: "authorization_code",
          // This redirect isn't called and is only used to check if it matches the authorization request.
          redirect_uri: `${process.env.BASE_URL}/auth/callback`,
        }),
      },
      "Microsoft token exchange",
    );

    const xboxData = await fetchJson(
      "https://user.auth.xboxlive.com/user/authenticate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Properties: {
            AuthMethod: "RPS",
            SiteName: "user.auth.xboxlive.com",
            RpsTicket: `d=${tokenData.access_token}`,
          },
          RelyingParty: "http://auth.xboxlive.com",
          TokenType: "JWT",
        }),
      },
      "Xbox authentication",
    );

    const xstsData = await fetchJson(
      "https://xsts.auth.xboxlive.com/xsts/authorize",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Properties: {
            SandboxId: "RETAIL",
            UserTokens: [xboxData.Token],
          },
          RelyingParty: "rp://api.minecraftservices.com/",
          TokenType: "JWT",
        }),
      },
      "XSTS authorization",
    );

    const mcData = await fetchJson(
      "https://api.minecraftservices.com/authentication/login_with_xbox",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identityToken: `XBL3.0 x=${xstsData.DisplayClaims.xui[0].uhs};${xstsData.Token}`,
        }),
      },
      "Minecraft authentication",
    );

    const mcOwnership = await fetchJson(
      `https://api.minecraftservices.com/entitlements/license?requestId=${crypto.randomUUID()}`,
      {
        headers: {
          Authorization: `Bearer ${mcData.access_token}`,
        },
      },
    );

    const ownsJava = mcOwnership?.items.some(
      (item) => item.name === "game_minecraft",
    );

    if (!ownsJava) {
      res
        .status(403)
        .send(
          '<p>This account does not own Java Edition! <a href="/logout">Click here</a> to log in with a different account.</p>',
        );
    }

    const profile = await fetchJson(
      "https://api.minecraftservices.com/minecraft/profile",
      {
        headers: {
          Authorization: `Bearer ${mcData.access_token}`,
        },
      },
      "Getting Minecraft profile",
    );

    const user = {
      uuid: profile.id,
      name: profile.name,
    };

    req.session.regenerate(() => {
      req.session.user = user;

      delete req.session.oauthState;
      delete req.session.oauthNonce;

      res.redirect("/downloads");
    });
  } catch (err) {
    console.error(err);
    res.status(500).send(`Authentication failed: ${err}`);
  }
});

router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

export default router;
