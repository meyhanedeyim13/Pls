import {
  type Client,
  Events,
  AuditLogEvent,
  Colors,
} from "discord.js";
import { buildEmbed, sendLog } from "../utils/logger.js";
import { E } from "../utils/emojis.js";

const SKIP_EVENTS = new Set<AuditLogEvent>([
  AuditLogEvent.MemberBanAdd,
  AuditLogEvent.MemberKick,
  AuditLogEvent.MessageDelete,
  AuditLogEvent.MessageBulkDelete,
  AuditLogEvent.ChannelCreate,
  AuditLogEvent.ChannelDelete,
  AuditLogEvent.ChannelUpdate,
  AuditLogEvent.ChannelOverwriteCreate,
  AuditLogEvent.ChannelOverwriteUpdate,
  AuditLogEvent.ChannelOverwriteDelete,
  AuditLogEvent.RoleCreate,
  AuditLogEvent.RoleDelete,
  AuditLogEvent.RoleUpdate,
  AuditLogEvent.GuildUpdate,
  AuditLogEvent.MemberUpdate,
  AuditLogEvent.MemberRoleUpdate,
  AuditLogEvent.MemberMove,
]);

function fmt(id: string | null | undefined, type: "user" | "role" | "channel" = "user"): string {
  if (!id) return "Bilinmiyor";
  if (type === "role") return `<@&${id}>`;
  if (type === "channel") return `<#${id}>`;
  return `<@${id}>`;
}

export function registerAuditLog(client: Client): void {
  client.on(Events.GuildAuditLogEntryCreate, async (entry, guild) => {
    try {
      if (SKIP_EVENTS.has(entry.action)) return;
      if (entry.executor?.id === client.user?.id) return;

      const executor = entry.executor;
      const target = entry.target;
      const reason = entry.reason ?? "Sebep belirtilmemiş";
      const who = executor ? `${executor.tag} (${fmt(executor.id)})` : "Bilinmiyor";

      let title = "";
      let description = "";
      let color = Colors.Blurple;
      const fields: { name: string; value: string; inline: boolean }[] = [
        { name: "Yürüten", value: who, inline: true },
      ];

      switch (entry.action) {

        case AuditLogEvent.MemberBanRemove:
          title = `${E.shield} Ban Kaldırıldı`;
          description = `${fmt((target as { id?: string })?.id)} kullanıcısının banı kaldırıldı.`;
          color = Colors.Green;
          fields.push({ name: "Hedef", value: fmt((target as { id?: string })?.id), inline: true });
          fields.push({ name: "Sebep", value: reason, inline: false });
          break;

        case AuditLogEvent.MemberPrune:
          title = `${E.broom} Üye Temizleme`;
          description = `Belirli gün boyunca aktif olmayan üyeler sunucudan atıldı.`;
          color = Colors.Orange;
          fields.push({ name: "Silinen Gün", value: String((entry.extra as { deleteMemberDays?: number })?.deleteMemberDays ?? "?"), inline: true });
          fields.push({ name: "Etkilenen Üye", value: String((entry.extra as { removedMembersCount?: number })?.removedMembersCount ?? "?"), inline: true });
          break;

        case AuditLogEvent.MemberDisconnect:
          title = `${E.tool} Ses Kanalı Bağlantısı Kesildi`;
          description = `Bir veya daha fazla üyenin ses kanalı bağlantısı zorla kesildi.`;
          color = Colors.Yellow;
          fields.push({ name: "Etkilenen", value: String((entry.extra as { count?: number })?.count ?? "?"), inline: true });
          break;

        case AuditLogEvent.BotAdd:
          title = `${E.bot} Bot Eklendi`;
          description = `Sunucuya yeni bir bot eklendi.`;
          color = Colors.Blue;
          fields.push({ name: "Bot", value: fmt((target as { id?: string })?.id), inline: true });
          break;

        case AuditLogEvent.InviteCreate:
          title = `${E.mail} Davet Oluşturuldu`;
          description = `Yeni bir davet linki oluşturuldu.`;
          color = Colors.Blurple;
          fields.push({
            name: "Kanal",
            value: fmt((entry.extra as { channel?: { id?: string } })?.channel?.id, "channel"),
            inline: true,
          });
          fields.push({
            name: "Kullanım Limiti",
            value: String((entry.changes?.find((c) => c.key === "max_uses")?.new) ?? "Sınırsız"),
            inline: true,
          });
          break;

        case AuditLogEvent.InviteDelete:
          title = `${E.trash} Davet Silindi`;
          description = `Bir davet linki silindi.`;
          color = Colors.Orange;
          fields.push({
            name: "Kanal",
            value: fmt((entry.extra as { channel?: { id?: string } })?.channel?.id, "channel"),
            inline: true,
          });
          break;

        case AuditLogEvent.WebhookCreate:
          title = `${E.link} Webhook Oluşturuldu`;
          description = `Yeni bir webhook oluşturuldu.`;
          color = Colors.Blue;
          fields.push({ name: "Webhook Adı", value: String((entry.changes?.find((c) => c.key === "name")?.new) ?? "Bilinmiyor"), inline: true });
          break;

        case AuditLogEvent.WebhookUpdate:
          title = `${E.link} Webhook Güncellendi`;
          description = `Bir webhook güncellendi.`;
          color = Colors.Yellow;
          break;

        case AuditLogEvent.WebhookDelete:
          title = `${E.link} Webhook Silindi`;
          description = `Bir webhook silindi.`;
          color = Colors.Red;
          break;

        case AuditLogEvent.EmojiCreate:
          title = `${E.emoji} Emoji Eklendi`;
          description = `Sunucuya yeni emoji eklendi.`;
          color = Colors.Green;
          fields.push({ name: "Emoji Adı", value: String((entry.changes?.find((c) => c.key === "name")?.new) ?? "?"), inline: true });
          break;

        case AuditLogEvent.EmojiUpdate:
          title = `${E.emoji} Emoji Güncellendi`;
          description = `Bir emoji güncellendi.`;
          color = Colors.Yellow;
          fields.push({ name: "Yeni Ad", value: String((entry.changes?.find((c) => c.key === "name")?.new) ?? "?"), inline: true });
          break;

        case AuditLogEvent.EmojiDelete:
          title = `${E.emoji} Emoji Silindi`;
          description = `Bir emoji sunucudan silindi.`;
          color = Colors.Red;
          fields.push({ name: "Emoji Adı", value: String((entry.changes?.find((c) => c.key === "name")?.old) ?? "?"), inline: true });
          break;

        case AuditLogEvent.StickerCreate:
          title = `${E.emoji} Sticker Eklendi`;
          description = `Sunucuya yeni sticker eklendi.`;
          color = Colors.Green;
          fields.push({ name: "Sticker Adı", value: String((entry.changes?.find((c) => c.key === "name")?.new) ?? "?"), inline: true });
          break;

        case AuditLogEvent.StickerUpdate:
          title = `${E.emoji} Sticker Güncellendi`;
          description = `Bir sticker güncellendi.`;
          color = Colors.Yellow;
          break;

        case AuditLogEvent.StickerDelete:
          title = `${E.emoji} Sticker Silindi`;
          description = `Bir sticker sunucudan silindi.`;
          color = Colors.Red;
          fields.push({ name: "Sticker Adı", value: String((entry.changes?.find((c) => c.key === "name")?.old) ?? "?"), inline: true });
          break;

        case AuditLogEvent.ThreadCreate:
          title = `${E.emoji} Thread Oluşturuldu`;
          description = `Yeni bir thread açıldı.`;
          color = Colors.Blue;
          fields.push({ name: "Thread", value: fmt((target as { id?: string })?.id, "channel"), inline: true });
          break;

        case AuditLogEvent.ThreadDelete:
          title = `${E.emoji} Thread Silindi`;
          description = `Bir thread silindi.`;
          color = Colors.Red;
          fields.push({ name: "Thread Adı", value: String((entry.changes?.find((c) => c.key === "name")?.old) ?? "?"), inline: true });
          break;

        case AuditLogEvent.ThreadUpdate:
          title = `${E.emoji} Thread Güncellendi`;
          description = `Bir thread güncellendi.`;
          color = Colors.Yellow;
          fields.push({ name: "Thread", value: fmt((target as { id?: string })?.id, "channel"), inline: true });
          break;

        case AuditLogEvent.IntegrationCreate:
          title = `${E.tool} Entegrasyon Eklendi`;
          description = `Sunucuya yeni entegrasyon eklendi.`;
          color = Colors.Blue;
          break;

        case AuditLogEvent.IntegrationDelete:
          title = `${E.tool} Entegrasyon Silindi`;
          description = `Bir entegrasyon sunucudan kaldırıldı.`;
          color = Colors.Red;
          break;

        case AuditLogEvent.StageInstanceCreate:
          title = `${E.stage} Sahne Başlatıldı`;
          description = `Bir sahne etkinliği başlatıldı.`;
          color = Colors.Blue;
          break;

        case AuditLogEvent.StageInstanceDelete:
          title = `${E.stage} Sahne Sona Erdi`;
          description = `Bir sahne etkinliği sona erdi.`;
          color = Colors.Grey;
          break;

        case AuditLogEvent.MemberMove:
          title = `${E.speaker} Ses Kanalı Taşıma`;
          description = `Üyeler başka bir ses kanalına taşındı.`;
          color = Colors.Yellow;
          fields.push({ name: "Kanal", value: fmt((entry.extra as { channel?: { id?: string } })?.channel?.id, "channel"), inline: true });
          fields.push({ name: "Etkilenen", value: String((entry.extra as { count?: number })?.count ?? "?"), inline: true });
          break;

        default:
          title = `${E.clipboard} Denetim Kaydı`;
          description = `Yeni bir sunucu işlemi gerçekleşti. (Olay: \`${AuditLogEvent[entry.action] ?? entry.action}\`)`;
          color = Colors.Grey;
          break;
      }

      if (!title) return;

      fields.push({ name: "Sebep", value: reason, inline: false });

      await sendLog(guild, buildEmbed({ title, description, color, fields }));
    } catch (err) {
      console.error("auditLog handler error:", err);
    }
  });
}
