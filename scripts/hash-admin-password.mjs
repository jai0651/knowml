#!/usr/bin/env node
/* Turn a password into the scrypt digest that ADMIN_PASSWORD_HASH expects.
 *
 * Run this on your own machine. The password is read with echo off, is never
 * written to disk, never printed, and never reaches the deployed environment —
 * only the digest does, and a digest cannot be replayed anywhere else.
 *
 *     node scripts/hash-admin-password.mjs
 */
import crypto from "node:crypto";
import { hashPassword } from "../api/_admin.js";

function askHidden(prompt) {
  return new Promise((resolve, reject) => {
    process.stdout.write(prompt);
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      reject(new Error("needs an interactive terminal — run it directly, not through a pipe"));
      return;
    }
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let buf = "";
    const onData = (ch) => {
      const code = ch.charCodeAt(0);
      if (code === 13 || code === 10) {            // Enter
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(buf);
      } else if (code === 3) {                     // Ctrl-C
        stdin.setRawMode(false);
        process.stdout.write("\n");
        process.exit(130);
      } else if (code === 127 || code === 8) {     // Backspace
        buf = buf.slice(0, -1);
      } else if (code >= 32) {
        buf += ch;
      }
    };
    stdin.on("data", onData);
  });
}

const pw = await askHidden("New admin password: ");
if (pw.length < 12) {
  console.error("\nRefusing: use at least 12 characters. This is the only credential on the dashboard.");
  process.exit(1);
}
const again = await askHidden("Repeat it: ");
if (pw !== again) {
  console.error("\nThey do not match.");
  process.exit(1);
}

console.log("\nSet these three on Vercel — Settings > Environment Variables, or `vercel env add`:\n");
console.log("  ADMIN_USER            <whatever username you want>");
console.log("  ADMIN_PASSWORD_HASH   " + hashPassword(pw));
console.log("  ADMIN_SECRET          " + crypto.randomBytes(32).toString("base64url"));
console.log("\nADMIN_SECRET signs the session cookie and salts the daily visitor hash.");
console.log("Changing it logs you out and resets today's unique count. That is all it does.\n");
