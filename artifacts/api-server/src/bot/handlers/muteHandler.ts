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
} from "../utils/actionTracker.js";
import { buildEmbed, sendLog } from "../utils/logger.js";
import { getYetkiliRolId } from "../utils/db.js";
import { E } from "../utils/emojis.js";
import { CONFIG } from "../config.js";

export function registerMuteHandler(client: Client): void {
  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    try {
      const guild = newMember.guild;

      // Sadece timeout uygulandığında (communicationDisabledUntil yeni değer aldıysa)
      const wasTimedOut =
        !oldMember.communicationDisabledUntilTimestamp ||
        oldMember.communicationDisabledUntilTimestamp <= Date.now();
      const isNowTimedOut =
        !!newMember.communicationDisabledUntilTimestamp &&
        newMember.communicationDisabledUntilTimestamp > Date.now();

      if (!isNowTimedOut || !wasTimedOut) return; // Mute uygulanmadıysa çık

      // 1 sn bekle — audit log gecikmesi
      await new Promise((r) => setTimeout(r, 1000));

      const auditLogs = await guild.fetchAuditLogs({
        type: AuditLogEvent.MemberUpdate,
        limit: 5,
      });

      const entry = auditLogs.entries.find(
        (e) =>
          e.target?.id === newMember.id &&
          Date.now() - e.createdTimestamp < 5000,
      );

      if (!entry?.executor) return;
      const executor = entry.executor;
      if (executor.bot) return;

      // Executor'ın guild üyesini al (rolleri için)
      let executorMember: GuildMember | null = null;
      try {
        executorMember = await guild.members.fetch(executor.id);
      } catch {
        executorMember = null;
      }

      const executorRoleIds = executorMember?.roles.cache.map((r) => r.id) ?? [];
      if (isExemptExecutor(executor.id, executorRoleIds)) return;

      const yetkiliRolId = await getYetkiliRolId(guild.id);

      // Yetkili-yetkili müdahalesini engelle
      if (
        yetkiliRolId &&
        executorRoleIds.includes(yetkiliRolId)
      ) {
        let targetMember: GuildMember | null = null;
        try {
          targetMember = await guild.members.fetch(newMember.id);
        } catch {
          targetMember = null;
        }
        const targetRoleIds = targetMember?.roles.cache.map((r) => r.id) ?? [];
        if (targetRoleIds.includes(yetkiliRolId)) {
          await sendLog(
            guild,
            buildEmbed({
              title: `${E.warning} Yetkili Üyeye Mute`,
              description: `<@${executor.id}> yetkili bir üyeyi susturmaya çalıştı.`,
              color: Colors.Orange,
              fields: [
                { name: "Uygulayan", value: `<@${executor.id}>`, inline: true },
                { name: "Hedef", value: `<@${newMember.id}>`, inline: true },
              ],
            }),
          );
          // Timeout'u kaldır
          try {
            await newMember.timeout(null, "Yetkili-yetkili mute engellendi");
          } catch { /* ignore */ }
          return;
        }
      }

      // Sayacı kaydet
      const { exceeded, warning, count } = recordAction(
        executor.id,
        "Mute",
        newMember.id,
      );

      const muteUntil = newMember.communicationDisabledUntilTimestamp
        ? new Date(newMember.communicationDisabledUntilTimestamp).toLocaleString("tr-TR")
        : "Bilinmiyor";

      // Log gönder
      await sendLog(
        guild,
        buildEmbed({
          title: `${E.warning} Mute Uygulandı`,
          description: `<@${executor.id}> → <@${newMember.id}>`,
          color: Colors.Orange,
          fields: [
            { name: "Uygulayan", value: `<@${executor.id}>`, inline: true },
            { name: "Hedef", value: `<@${newMember.id}>`, inline: true },
            { name: "Bitiş", value: muteUntil, inline: true },
            {
              name: "Sayaç",
              value: `${count}/${CONFIG.ACTION_LIMIT} — ${Math.max(0, CONFIG.ACTION_LIMIT - count)} hak kaldı`,
              inline: false,
            },
          ],
        }),
      );

      // Uyarı (son hak)
      if (warning) {
        await sendLog(
          guild,
          buildEmbed({
            title: `${E.security} Son Hak Kullanıldı`,
            description: `<@${executor.id}> son hakkını kullandı. Bir sonraki işlemde yetkileri alınacak.`,
            color: Colors.Yellow,
          }),
        );
        if (isExemptRoleOnly(executor.id, executorRoleIds)) {
          try {
            await executor.send(
              `${E.security} **Uyarı:** Sunucuda işlem limitine ulaştın. Bir sonraki yetkisiz işlemde yetkilerin alınacak.`,
            );
          } catch { /* DM kapalı */ }
        }
      }

      // Limit aşıldı → yetkileri al
      if (exceeded && executorMember) {
        const adminRoles = executorMember.roles.cache.filter((r) =>
          r.permissions.has(PermissionFlagsBits.Administrator) ||
          r.permissions.has(PermissionFlagsBits.BanMembers) ||
          r.permissions.has(PermissionFlagsBits.KickMembers) ||
          r.permissions.has(PermissionFlagsBits.ManageChannels),
        );

        const removedRoles: string[] = [];
        for (const [, role] of adminRoles) {
          try {
            await executorMember.roles.remove(role, "İşlem limiti aşıldı (mute)");
            removedRoles.push(role.name);
          } catch { /* ignore */ }
        }

        await sendLog(
          guild,
          buildEmbed({
            title: `${E.security} YETKİ ALINDI — Mute Limiti Aşıldı`,
            description: `<@${executor.id}> işlem limitini aştığı için yetkileri kaldırıldı.`,
            color: Colors.Red,
            fields: [
              {
                name: "Alınan Roller",
                value: removedRoles.length ? removedRoles.join(", ") : "Yok",
                inline: false,
              },
            ],
          }),
        );

        try {
          await executor.send(
            `${E.security} **Yetkilerini Kaybettin!** İşlem limitini aştığın için yönetici rollerin kaldırıldı.`,
          );
        } catch { /* ignore */ }
      }
    } catch (err) {
      console.error("muteHandler error:", err);
    }
  });
}
