import {
  Client,
  TextChannel,
  EmbedBuilder,
  type Guild,
} from "discord.js";
import { CONFIG } from "../config.js";

export type ProtectionTone = "info" | "success" | "warning" | "critical" | "muted";

const TONE_LABELS: Record<ProtectionTone, string> = {
  info: "BİLGİ",
  success: "BAŞARILI",
  warning: "UYARI",
  critical: "KRİTİK",
  muted: "MUAF",
};

const TONE_COLORS: Record<ProtectionTone, number> = {
  info: 0x3b82f6,
  success: 0x22c55e,
  warning: 0xf59e0b,
  critical: 0xef4444,
  muted: 0x64748b,
};

function inferCategory(title: string): string {
  const normalized = title.toLocaleLowerCase("tr-TR");
  if (normalized.includes("ban")) return "Ban Koruması";
  if (normalized.includes("kick")) return "Kick Koruması";
  if (normalized.includes("kanal")) return "Kanal Koruması";
  if (normalized.includes("mute") || normalized.includes("sustur")) return "Mute Koruması";
  if (normalized.includes("rol")) return "Rol Koruması";
  if (normalized.includes("link")) return "Link Filtresi";
  if (normalized.includes("küfür") || normalized.includes("uygunsuz")) return "İçerik Filtresi";
  if (normalized.includes("karantina")) return "Karantina Sistemi";
  if (normalized.includes("yedek") || normalized.includes("restore") || normalized.includes("geri yük")) {
    return "Yedekleme Sistemi";
  }
  if (normalized.includes("mesaj")) return "Mesaj Koruması";
  return "Güvenlik Kaydı";
}

function inferTone(title: string): ProtectionTone {
  const normalized = title.toLocaleLowerCase("tr-TR");
  if (
    normalized.includes("yetki alındı") ||
    normalized.includes("saldırı") ||
    normalized.includes("limit aşıldı") ||
    normalized.includes("kritik")
  ) {
    return "critical";
  }
  if (
    normalized.includes("uyarı") ||
    normalized.includes("engellendi") ||
    normalized.includes("koruma")
  ) {
    return "warning";
  }
  if (
    normalized.includes("geri yüklendi") ||
    normalized.includes("başarılı") ||
    normalized.includes("eklendi")
  ) {
    return "success";
  }
  if (normalized.includes("muaf")) return "muted";
  return "info";
}

export async function getLogChannel(
  guild: Guild,
): Promise<TextChannel | null> {
  try {
    const channel = await guild.channels.fetch(CONFIG.LOG_CHANNEL_ID);
    if (channel && channel.isTextBased() && channel instanceof TextChannel) {
      return channel;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function sendLog(
  guild: Guild,
  embed: EmbedBuilder,
): Promise<void> {
  const channel = await getLogChannel(guild);
  if (!channel) return;
  await channel.send({ embeds: [embed] });
}

export async function getPublicLogChannel(
  guild: Guild,
): Promise<TextChannel | null> {
  try {
    const channel = await guild.channels.fetch(CONFIG.PUBLIC_LOG_CHANNEL_ID);
    if (channel && channel.isTextBased() && channel instanceof TextChannel) {
      return channel;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function sendPublicLog(
  guild: Guild,
  embed: EmbedBuilder,
): Promise<void> {
  const channel = await getPublicLogChannel(guild);
  if (!channel) return;
  await channel.send({ embeds: [embed] });
}

export function buildEmbed(options: {
  title: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  category?: string;
  tone?: ProtectionTone;
  status?: string;
}): EmbedBuilder {
  const tone = options.tone ?? inferTone(options.title);
  const category = options.category ?? inferCategory(options.title);
  const embed = new EmbedBuilder()
    .setAuthor({ name: "KAHVEHANE GÜVENLİK SİSTEMİ" })
    .setTitle(options.title)
    .setColor(options.color ?? TONE_COLORS[tone])
    .setTimestamp();

  const descriptionParts = [
    `**${TONE_LABELS[tone]} · ${category}**`,
    options.status ? `> **Durum:** ${options.status}` : null,
    options.description ?? null,
  ].filter((part): part is string => Boolean(part));

  if (descriptionParts.length > 0) {
    embed.setDescription(descriptionParts.join("\n"));
  }

  const fields = [
    ...(options.status
      ? [{ name: "Sonuç", value: options.status, inline: true }]
      : []),
    ...(options.fields ?? []),
  ];

  if (fields.length > 0) {
    embed.addFields(fields);
  }

  embed.setFooter({
    text: `Kahvehane Güvenlik Sistemi • ${TONE_LABELS[tone]}`,
  });

  return embed;
}
