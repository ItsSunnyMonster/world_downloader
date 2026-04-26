import { Webhook } from "discord-webhook-node";

export function sendMessage(msg) {
  const hook = new Webhook(process.env.WEBHOOK);
  hook.send(msg);
}

export function sendError(msg) {
  const hook = new Webhook(process.env.WEBHOOK);
  hook.send(`<@${process.env.PING_ID}> ${msg}`);
}
