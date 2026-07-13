import { type Client, Events, Colors } from "discord.js";
import { CONFIG } from "../config.js";
import { buildEmbed, sendLog } from "../utils/logger.js";
import { getLinkEngelAktif, setLinkEngelAktif } from "../utils/db.js";
import { E } from "../utils/emojis.js";

const LINK_REGEX = /https?:\/\/[^\s]+|discord\.gg\/[^\s]+|www\.[^\s]+/i;

export function registerLinkGuard(client: Client): void {
  client.on(Events.MessageCreate, async (message) => {
    if (!message.guild) return;
    if (message.author.bot) return;

    if ((CONFIG.ALLOWED_USER_IDS as readonly string[]).includes(message.author.id)) return;

    const aktif = await getLinkEngelAktif(message.guild.id);
    if (!aktif) return;

    if (!LINK_REGEX.test(message.content)) return;

    try {
      await message.delete();
    } catch { return; }

    try {
      await message.author.send(
        `${E.shield} **${message.guild.name}** sunucusunda link paylaşımı engellidir. Mesajın silindi.`,
      );
    } catch { /* DM kapalı */ }

    await sendLog(
      message.guild,
      buildEmbed({
        title: `${E.link} Link Engellendi`,
        description: `<@${message.author.id}> link içeren mesaj gönderdi, otomatik silindi.`,
        color: Colors.Orange,
        fields: [
          { name: "Kullanıcı", value: `${message.author.tag} (<@${message.author.id}>)`, inline: true },
          { name: "Kanal", value: `<#${message.channelId}>`, inline: true },
          {
            name: "İçerik",
            value: message.content.slice(0, 200) || "(boş)",
            inline: false,
          },
        ],
      }),
    );
  });
}

export async function toggleLinkEngel(
  guildId: string,
  aktif: boolean,
): Promise<void> {
  await setLinkEngelAktif(guildId, aktif);
}
