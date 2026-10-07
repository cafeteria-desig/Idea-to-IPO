import path from "path";
import qrcode from "qrcode";
import { startTunnel } from "untun";

async function main() {
  const port = parseInt(process.env.PORT || "3000", 10);

  console.log("\n============================================================");
  console.log("       🌐 IDEA TO IPO — WORLDWIDE PUBLIC SERVER ACCESS       ");
  console.log("============================================================\n");
  console.log(`🚀 Connecting your laptop to Cloudflare Global Edge Network...`);

  try {
    const tunnel = await startTunnel({ port });
    if (!tunnel) {
      console.error("Could not create tunnel.");
      return;
    }
    const publicUrl = await tunnel.getURL();

    console.log(`\n🎉 YOUR LAPTOP IS NOW A PUBLIC LIVE SERVER!`);
    console.log(`🔗 Public HTTPS URL: \x1b[32m\x1b[1m${publicUrl}\x1b[0m`);
    console.log(`⚡ Anyone on 4G / 5G / Wi-Fi anywhere in the world can open this link!\n`);

    // Save QR code image for display/projector
    const qrPath = path.join(process.cwd(), "public", "public-server-qr.png");
    await qrcode.toFile(qrPath, publicUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });
    console.log(`🖼️  QR Code saved to: public/public-server-qr.png\n`);

    console.log("📲 Scan this QR Code on any mobile phone (4G/5G/Wi-Fi):\n");
    const qrTerminal = await qrcode.toString(publicUrl, {
      type: "terminal",
      small: true,
    });
    console.log(qrTerminal);

    console.log("\n💡 Keep this process running to keep the public server alive.");
    console.log("============================================================\n");
  } catch (err) {
    console.error("Failed to establish public tunnel:", err);
  }
}

main();
