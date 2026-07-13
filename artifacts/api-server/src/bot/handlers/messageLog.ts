import { type Client, Events, Colors } from "discord.js";
import { CONFIG } from "../config.js";
import { buildEmbed, sendLog } from "../utils/logger.js";
import { E } from "../utils/emojis.js";

const EXEMPT_ROLE_ID = "1515760496425308300";

function isExempt(message: {
  member?: { roles: { cache: Map<string, unknown> } } | null;
  author?: { bot?: boolean };
}): boolean {
  if (message.author?.bot) return true;
  return message.member?.roles.cache.has(EXEMPT_ROLE_ID) ?? false;
}

export function registerMessageLog(client: Client): void {
  client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    if (!newMessage.guild) return;
    if (newMessage.author?.bot) return;

    const member = newMessage.member
      ?? await newMessage.guild.members.fetch(newMessage.author!.id).catch(() => null);
    if (member?.roles.cache.has(EXEMPT_ROLE_ID)) return;

    const before = oldMessage.content ?? "(önbellek yok)";
    const after = newMessage.content ?? "(boş)";

    if (before === after) return;

    await sendLog(
      newMessage.guild,
      buildEmbed({
        title: `${E.edit} Mesaj Düzenlendi`,
        description: `<@${newMessage.author!.id}> mesajını düzenledi.`,
        color: Colors.Yellow,
        fields: [
          { name: "Kanal", value: `<#${newMessage.channelId}>`, inline: true },
          { name: "Kullanıcı", value: `${newMessage.author!.tag} (<@${newMessage.author!.id}>)`, inline: true },
          { name: "Önceki İçerik", value: before.slice(0, 1000) || "(boş)", inline: false },
          { name: "Yeni İçerik", value: after.slice(0, 1000) || "(boş)", inline: false },
        ],
      }),
    ).catch(() => {});
  });

  client.on(Events.MessageDelete, async (message) => {
    if (!message.guild) return;
    if (message.author?.bot) return;

    if (CONFIG.PROTECTED_CHANNEL_IDS.includes(message.channelId)) return;

    const member = message.member
      ?? await message.guild.members.fetch(message.author!.id).catch(() => null);
    if (member?.roles.cache.has(EXEMPT_ROLE_ID)) return;

    const content = message.content || null;
    const attachments = message.attachments.map((a) => a.url);

    const fields: { name: string; value: string; inline: boolean }[] = [
      { name: "Kanal", value: `<#${message.channelId}>`, inline: true },
      { name: "Kullanıcı", value: message.author
        ? `${message.author.tag} (<@${message.author.id}>)`
        : "Bilinmiyor (önbellek yok)", inline: true },
    ];

    if (content) {
      fields.push({ name: "Mesaj İçeriği", value: content.slice(0, 1000), inline: false });
    }
    if (attachments.length > 0) {
      fields.push({ name: "Ekler", value: attachments.join("\n").slice(0, 1000), inline: false });
    }

    await sendLog(
      message.guild,
      buildEmbed({
        title: `${E.trash} Mesaj Silindi`,
        description: content
          ? `<@${message.author?.id ?? "bilinmiyor"}> kullanıcısının mesajı silindi.`
          : "Önbelleğe alınmamış bir mesaj silindi.",
        color: Colors.Orange,
        fields,
      }),
    ).catch(() => {});
  });
}
