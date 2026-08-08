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

const WORD_CHARS = "a-zığüşöçA-ZİĞÜŞÖÇ";
const WORD_SPLIT_RE = new RegExp(`[^${WORD_CHARS}]+`);

/** Türkçe küçük harf + leet-speak dönüşümü, boşlukları KORUR */
function normalizeTr(text: string): string {
  return text
    .toLowerCase()
    .replace(/İ/g, "i").replace(/I/g, "ı")
    .replace(/Ğ/g, "ğ").replace(/Ü/g, "ü")
    .replace(/Ş/g, "ş").replace(/Ö/g, "ö").replace(/Ç/g, "ç")
    .replace(/0/g, "o").replace(/3/g, "e")
    .replace(/4/g, "a").replace(/5/g, "s")
    .replace(/\$/g, "s").replace(/@/g, "a");
}

/** Agresif: tüm harf-dışı karakterleri sil (bypass tespiti için) */
function normalizeAggressive(text: string): string {
  return normalizeTr(text).replace(/[^a-zığüşöç]/g, "");
}

function containsProfanity(text: string): string | null {
  const normalized = normalizeTr(text);
  // Metni kelimelere böl (noktalama/boşluk sınırlarında)
  const words = normalized.split(WORD_SPLIT_RE).filter(Boolean);

  for (const profanity of PROFANITY_LIST) {
    const normP = normalizeTr(profanity);
    const profWords = normP.split(WORD_SPLIT_RE).filter(Boolean);

    if (profWords.length === 1) {
      // Tek kelime: sadece tam eşleşme (substring DEĞİL — "Quit" içindeki "it" tutulmaz)
      if (words.some((w) => w === normP)) return profanity;
    } else {
      // Çoklu kelime ifadesi: sıralı tam eşleşme
      outer: for (let i = 0; i <= words.length - profWords.length; i++) {
        for (let j = 0; j < profWords.length; j++) {
          if (words[i + j] !== profWords[j]) continue outer;
        }
        return profanity;
      }
    }
  }

  // Bypass tespiti: nokta/tire/@ ile gizlenmiş 4+ harfli kelimeler (ör: "s.i.k.i.ş")
  const aggressive = normalizeAggressive(text);
  for (const profanity of PROFANITY_LIST) {
    const normP = normalizeAggressive(profanity);
    if (normP.length >= 4 && aggressive.includes(normP)) return profanity;
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
