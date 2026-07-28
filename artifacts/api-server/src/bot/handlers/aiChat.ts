import { type Client, Events, type Message } from "discord.js";
import { GoogleGenAI } from "@google/genai";
import { CONFIG } from "../config.js";

const ai = new GoogleGenAI({ apiKey: process.env["GEMINI_API_KEY"] ?? "" });

// Her kullanıcı için konuşma geçmişi (son 20 mesaj)
const userHistory = new Map<string, { role: "user" | "model"; parts: { text: string }[] }[]>();

const MAX_HISTORY = 20;
const TYPING_INTERVAL_MS = 5000;

const SYSTEM_PROMPT = `Sen "Kahvehane Koruma" adlı bir Discord botunun yapay zeka asistanısın. Kahvehane adlı bir Türk Discord sunucusunda görev yapıyorsun.

TEMEL KİŞİLİK KURALLARI:
- Türkçe konuş, doğal ve samimi bir üslup kullan
- Kısa ve öz cevaplar ver — gereksiz uzatma, laf kalabalığı yapma
- Kullanıcının ne söylediğini tam anla, kelimeleri yanlış yorumlama
- Sohbet havasında ol, resmi bir asistan gibi davranma
- Espri anlayışın var, gerektiğinde esprili olabilirsin

DİSCORD ORTAMI HAKKINDA BİLGİN OLSUN:
- OWO, MEE6, Dyno gibi Discord botları var — bunlar hakkında soru gelirse bilgini paylaş
- Discord komutları (/, !), bot etiketleri (@bot), emoji kullanımı normal
- Kullanıcılar bazen başka botlara komut yazabilir — bu senin için söylenmiş değildir, atlarsın
- "bana owo at" gibi şeyler başka bir bota hitap ediyor olabilir, kafana takma

YANITLAMA KURALLARI:
- Eğer kullanıcı başka bir bota komut gönderiyorsa (owo, !play, $rank vb.) tepki verme
- Anlamsız veya bağlamı olmayan mesajlara "ne demek istediğini anlayamadım, biraz açar mısın?" gibi kısa bir şey söyle
- Hiçbir zaman saçma veya alakasız bilgi üretme — bilmiyorsan "bilmiyorum" de
- Kullanıcı sana hakaret ederse sakin kal, kısa ve net cevap ver
- Felsefi, tarihi, teknik — her konuda yardımcı olabilirsin

YASAK DAVRANIŞLAR:
- Uzun ve anlamsız paragraflar yazma
- Konuyla alakasız kavramları birbirine bağlama (örn. "Medine" ile ilgisi olmayan şeylere Medine'yi sokma)
- Kullanıcının mesajındaki kelimelerden yanlış anlam çıkarma
- "Bu konuda daha fazla bilgiye ulaşamadım" gibi yapay asistan klişeleri kullanma
- Kendin hakkında yalan söyleme — sen bir Discord botusun, bunu kabul et`;

async function getAIResponse(
  userId: string,
  username: string,
  userMessage: string,
): Promise<string> {
  const history = userHistory.get(userId) ?? [];

  // Yeni kullanıcı mesajını ekle
  history.push({ role: "user", parts: [{ text: userMessage }] });

  // Geçmişi MAX_HISTORY ile sınırla (her biri role+parts, çift tutuyoruz)
  while (history.length > MAX_HISTORY) {
    history.shift();
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: history,
    config: {
      systemInstruction: SYSTEM_PROMPT + `\n\nŞu an konuştuğun kişi: ${username}`,
      maxOutputTokens: 512,
      temperature: 0.85,
    },
  });

  const text = response.text?.trim() ?? "Bir sorun oluştu, tekrar dene.";

  // Model cevabını geçmişe ekle
  history.push({ role: "model", parts: [{ text }] });
  userHistory.set(userId, history);

  return text;
}

export function registerAiChat(client: Client): void {
  client.on(Events.MessageCreate, async (message: Message) => {
    if (message.author.bot) return;
    if (message.channelId !== CONFIG.AI_CHANNEL_ID) return;
    if (!message.content.trim()) return;

    // Başka bota yazılan komutları atla (/, !, $, ?, owo ile başlayanlar)
    const botCommandPrefixes = /^[!/\$\?]|^(owo|pls|m!|>|>>|\+|r!|k!|d!)\s/i;
    if (botCommandPrefixes.test(message.content.trim())) return;

    // Typing göster
    const typingInterval = setInterval(() => {
      message.channel.sendTyping().catch(() => {});
    }, TYPING_INTERVAL_MS);
    await message.channel.sendTyping().catch(() => {});

    try {
      const reply = await getAIResponse(
        message.author.id,
        message.author.displayName || message.author.username,
        message.content,
      );

      clearInterval(typingInterval);

      // Discord mesaj limiti 2000 karakter
      if (reply.length > 1950) {
        const chunks = reply.match(/[\s\S]{1,1950}/g) ?? [reply];
        for (const chunk of chunks) {
          await message.reply(chunk);
        }
      } else {
        await message.reply(reply);
      }
    } catch (err) {
      clearInterval(typingInterval);
      console.error("AI sohbet hatası:", err);
      await message.reply("Şu an bir sorun yaşıyorum, birazdan tekrar dene.").catch(() => {});
    }
  });
}
