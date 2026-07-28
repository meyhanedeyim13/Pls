import {
  Client,
  GatewayIntentBits,
  Partials,
  ActivityType,
} from "discord.js";
import { registerGuildBanAdd } from "./handlers/guildBanAdd.js";
import { registerGuildMemberRemove } from "./handlers/guildMemberRemove.js";
import { registerChannelDelete } from "./handlers/channelDelete.js";
import { registerChannelCreate } from "./handlers/channelCreate.js";
import { registerRoleUpdate } from "./handlers/roleUpdate.js";
import { registerServerEvents } from "./handlers/serverEvents.js";
import { registerMessageDelete } from "./handlers/messageDelete.js";
import { registerSlashCommands } from "./handlers/slashCommands.js";
import { scheduleNightlyBackup } from "./handlers/backup.js";
import { registerLinkGuard } from "./handlers/linkGuard.js";
import { registerMessageLog } from "./handlers/messageLog.js";
import { registerAuditLog } from "./handlers/auditLog.js";
import { registerMuteHandler } from "./handlers/muteHandler.js";
import { registerProfanityFilter } from "./handlers/profanityFilter.js";
import { registerAiChat } from "./handlers/aiChat.js";
import { ensureSettingsTable } from "./utils/db.js";

export function startBot(): void {
  const token = process.env["DISCORD_TOKEN"];
  if (!token) {
    console.error("DISCORD_TOKEN bulunamadı, bot başlatılmıyor.");
    return;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [
      Partials.Message,
      Partials.Channel,
      Partials.GuildMember,
    ],
  });

  // DB tablolarını başlat
  ensureSettingsTable().catch((err) => {
    console.error("guild_settings tablosu oluşturulamadı:", err);
  });

  registerGuildBanAdd(client);
  registerGuildMemberRemove(client);
  registerChannelDelete(client);
  registerChannelCreate(client);
  registerRoleUpdate(client);
  registerServerEvents(client);
  registerMessageDelete(client);
  registerLinkGuard(client);
  registerMessageLog(client);
  registerAuditLog(client);
  registerMuteHandler(client);
  registerProfanityFilter(client);
  registerAiChat(client);
  registerSlashCommands(client);
  scheduleNightlyBackup(client);

  client.once("clientReady", (readyClient) => {
    console.log(`✅ Bot hazır: ${readyClient.user.tag}`);
    readyClient.user.setActivity("Kahvehaneyi Kolluyor", {
      type: ActivityType.Watching,
    });
  });

  client.on("error", (err) => {
    console.error("Discord client error:", err);
  });

  client.login(token);
}
