import {
  type Client,
  Events,
  AuditLogEvent,
  Colors,
  GuildMember,
  PermissionFlagsBits,
} from "discord.js";
import {
  isExemptExecutor,
  isExemptRoleOnly,
  recordAction,
  claimAuditEntry,
} from "../utils/actionTracker.js";
import { buildEmbed, sendLog } from "../utils/logger.js";
import { E } from "../utils/emojis.js";
import { CONFIG } from "../config.js";

export function registerChannelCreate(client: Client): void {
  client.on(Events.ChannelCreate, async (channel) => {
    if (!("guild" in channel) || !channel.guild) return;
    const guild = channel.guild;

    await new Promise((r) => setTimeout(r, 1000));

    try {
      const auditLogs = await guild.fetchAuditLogs({
        type: AuditLogEvent.ChannelCreate,
        limit: 5,
      });

      const entry = auditLogs.entries.find(
        (candidate) =>
          candidate.target?.id === channel.id &&
          Date.now() - candidate.createdTimestamp < 5000,
      );
      if (!entry || !entry.executor) return;

      if (!claimAuditEntry(entry.id)) return;

      const executor = entry.executor;
      if (executor.id === client.user?.id) return;

      let member: GuildMember | null = null;
      try {
        member = await guild.members.fetch(executor.id);
      } catch {
        return;
      }

      const exempt = isExemptExecutor(executor.id, member.roles.cache.map((r) => r.id));
      const channelName = "name" in channel ? channel.name : "Bilinmeyen";

      if (exempt) {
        await sendLog(
          guild,
          buildEmbed({
            title: `${E.plus} Kanal Oluşturuldu`,
            description: `**#${channelName}** kanalı oluşturuldu.`,
            color: Colors.Blue,
            fields: [
              { name: "Yürüten", value: `<@${executor.id}>`, inline: true },
              { name: "Kanal", value: `<#${channel.id}>`, inline: true },
              { name: "Durum", value: "Muaf — yaptırım uygulanmadı", inline: false },
            ],
          }),
        );
        if (isExemptRoleOnly(executor.id, member.roles.cache.map((r) => r.id))) {
          try {
            await member.send(
              `${E.clipboard} **Bilgi:** **#${channelName}** kanalını oluşturdun. Bu işlem kayıt altına alındı. Muaf olduğun için herhangi bir yaptırım uygulanmadı.`,
            );
          } catch { /* DM kapalı */ }
        }
        return;
      }

      const { exceeded, warning, count } = recordAction(
        executor.id,
        "channelCreate",
        channel.id,
      );

      await sendLog(
        guild,
        buildEmbed({
          title: `${E.plus} Kanal Oluşturuldu`,
          description: `**#${channelName}** kanalı oluşturuldu.`,
          color: Colors.Blue,
          fields: [
            { name: "Yürüten", value: `<@${executor.id}>`, inline: true },
            { name: "İşlem Sayısı", value: `${count}/${CONFIG.ACTION_LIMIT}`, inline: true },
            { name: "Kanal", value: `<#${channel.id}>`, inline: true },
          ],
        }),
      );

      if (warning) {
        await sendLog(
          guild,
          buildEmbed({
            title: `${E.warning} UYARI — Son Hak`,
            description: `<@${executor.id}> **2. kanal oluşturma** işlemini yaptı. Bir tane daha oluşturursa yetkileri alınacak!`,
            color: Colors.Yellow,
            fields: [{ name: "Uyarı", value: "Tek hakkın var!" }],
          }),
        );
        try { await member.send(`${E.warning} **Uyarı:** 2. kanalı oluşturdun. Bir tane daha oluşturursan yönetici yetkilerin alınacak!`); } catch { /* ignore */ }
      }

      if (exceeded) {
        const adminRoles = member.roles.cache.filter((r) =>
          r.permissions.has(PermissionFlagsBits.Administrator) ||
          r.permissions.has(PermissionFlagsBits.ManageChannels) ||
          r.permissions.has(PermissionFlagsBits.BanMembers) ||
          r.permissions.has(PermissionFlagsBits.KickMembers) ||
          r.permissions.has(PermissionFlagsBits.ModerateMembers),
        );

        for (const [, role] of adminRoles) {
          try {
            await member.roles.remove(role, "Güvenlik: Kanal oluşturma limiti aşıldı");
          } catch { /* ignore */ }
        }

        await sendLog(
          guild,
          buildEmbed({
            title: `${E.security} YETKİ ALINDI — Kanal Oluşturma Limiti Aşıldı`,
            description: `<@${member.id}> 3. kanalı oluşturdu. Yönetici rolleri alındı.`,
            color: Colors.DarkRed,
            fields: [
              {
                name: "Alınan Roller",
                value: adminRoles.size > 0 ? adminRoles.map((r) => r.name).join(", ") : "Yok",
              },
            ],
          }),
        );

        try { await member.send(`${E.security} **Yetkilerin alındı!** Kanal oluşturma limitini aştığın için yönetici rollerin kaldırıldı.`); } catch { /* ignore */ }
      }
    } catch (err) {
      console.error("channelCreate handler error:", err);
    }
  });
}
