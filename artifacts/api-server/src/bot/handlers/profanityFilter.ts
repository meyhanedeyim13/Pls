import { type Client, Events, Colors } from "discord.js";
import { CONFIG } from "../config.js";
import { buildEmbed, sendLog } from "../utils/logger.js";
import { E } from "../utils/emojis.js";

// Türkçe küfür kelimesi listesi — substring olarak kontrol edilir
const PROFANITY_LIST = [
  "orospu",
  "orospuçocuğu",
  "orospu çocuğu",
  "sik",
  "sikerim",
  "sikeyim",
  "sikilmiş",
  "sikiş",
  "sikişmek",
  "sikilmek",
  "sikik",
  "bok",
  "boktan",
  "boklu",
  "piç",
  "piçlik",
  "piçin",
  "yarrak",
  "yarrağı",
  "göt",
  "götten",
  "götlek",
  "amk",
  "amına",
  "amını",
  "amcık",
  "oç",
  "oçmad",
  "haysiyetsiz",
  "ibne",
  "ibnelik",
  "kahpe",
  "kahpeler",
  "kahpelik",
  "şerefsiz",
  "şerefsizlik",
  "orosbu",
  "orosbu çocuğu",
  "pezevenk",
  "pezevengi",
  "pezevenklik",
  "götveren",
  "dingil",
  "hassikter",
  "hassiktir",
  "hssikter",
  "siktir",
  "siktirlan",
  "siktir git",
  "amına koyayım",
  "amınakoyim",
  "amk",
  "mükafatçı",
  "göbeğine",
  "döl",
  "dölü",
  "dölüm",
  "s1k",
  "s1kerim",
  "5ik",
  "5ikerim",
  "b0k",
  "piç kurusu",
  "piç kurt",
  "mal",
  "malın",
  "gerizekalı",
  "geri zekalı",
  "aptal",
  "aptalın",
  "salak",
  "salağın",
  "pislik",
  "pisliğin",
  "köpek",
  "köpeğin",
  "eşek",
  "eşeğin",
  "it",
  "itoğlu",
  "it oğlu",
  "kürt",
  "ermeni",
  "yunan",
  "gavur",
  "haysiz",
  "nankör",
  "alçak",
  "alçaklar",
  "zalim",
  "katil",
];

// Türkçe karakterleri normalize et (küçük harfe çevir, benzer harfleri birleştir)
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/İ/g, "i")
    .replace(/I/g, "ı")
    .replace(/Ğ/g, "ğ")
    .replace(/Ü/g, "ü")
    .replace(/Ş/g, "ş")
    .replace(/Ö/g, "ö")
    .replace(/Ç/g, "ç")
    // bypass girişimlerine karşı: harf aralarındaki nokta/tire/boşluk/@ kaldır
    .replace(/[.\-_*@!1\s]+/g, "")
    // yaygın harf değiştirmeleri
    .replace(/0/g, "o")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/\$/g, "s")
    .replace(/@/g, "a")
    .replace(/!/g, "i");
}

function containsProfanity(text: string): string | null {
  const normalizedText = normalize(text);
  for (const word of PROFANITY_LIST) {
    const normalizedWord = normalize(word);
    if (normalizedText.includes(normalizedWord)) {
      return word;
    }
  }
  return null;
}

export function registerProfanityFilter(client: Client): void {
  client.on(Events.MessageCreate, async (message) => {
    if (!message.guild) return;
    if (message.author.bot) return;

    // 3 muaf kişi: ALLOWED_USER_IDS
    if ((CONFIG.ALLOWED_USER_IDS as readonly string[]).includes(message.author.id)) return;

    const matchedWord = containsProfanity(message.content);
    if (!matchedWord) return;

    // Mesajı sil
    try {
      await message.delete();
    } catch {
      return; // Mesaj silinemiyorsa dur
    }

    // Kullanıcıya DM uyarısı
    try {
      await message.author.send(
        `${E.warning} **${message.guild.name}** sunucusunda uygunsuz ifade kullandın. Mesajın silindi.\n> Tekrar eden ihlallerde daha ağır yaptırım uygulanabilir.`,
      );
    } catch { /* DM kapalı */ }

    // Log kanalına bildir
    const embed = buildEmbed({
      title: `${E.broom} Küfür Filtresi — Mesaj Silindi`,
      description: `<@${message.author.id}> uygunsuz içerik içeren bir mesaj gönderdi.`,
      color: Colors.Orange,
      fields: [
        { name: "Kullanıcı", value: `<@${message.author.id}> (${message.author.tag})`, inline: true },
        { name: "Kanal", value: `<#${message.channelId}>`, inline: true },
        { name: "Tespit Edilen", value: `||${matchedWord}||`, inline: true },
        {
          name: "Mesaj İçeriği",
          value: `||${message.content.slice(0, 900)}||`,
          inline: false,
        },
      ],
    });

    await sendLog(message.guild, embed).catch(() => {});
  });
}
