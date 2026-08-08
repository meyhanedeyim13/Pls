---
name: Discord güvenlik botu kuralları
description: Discord mesaj filtreleri ve audit-log tabanlı işlem sayaçlarında korunması gereken güvenlik ilkeleri.
---

Küfür filtreleri kelime sınırlarında çalışmalı; kısa ve anlamı bağlama göre değişen parçalar İngilizce veya normal kelimelerde yanlış pozitif üretmemeli. Audit-log tabanlı sayaçlar yalnızca doğru hedef ve kısa zaman aralığıyla eşleşen kaydı saymalı ve aynı kayıt birden fazla event handler tarafından ikinci kez işlenmemeli.

**Why:** Kısa bir token normal İngilizce kelimelerin içinde eşleşebiliyor; Discord audit log API'si yoğun işlemlerde en yeni olmayan veya aynı kaydı tekrar döndürebiliyor.

**How to apply:** Yeni filtre kelimeleri eklerken tam kelime eşleşmesini ve belirsiz kısa tokenleri gözden geçir. Ban/kick/kanal/mute handler'larında hedef, zaman ve audit-entry tekilleştirmesini birlikte uygula.

Koruma logları tek bir ortak embed üreticisinden geçmeli; kategori, önem seviyesi, sonuç alanı ve standart footer merkezi olarak yönetilmeli.

**Why:** Farklı handler'ların birbirinden kopuk mesajları bakım maliyetini artırıyor ve güvenlik olaylarının önemini görsel olarak ayırt etmeyi zorlaştırıyor.

**How to apply:** Yeni koruma mesajlarında ortak embed üreticisini kullan; başlıktan otomatik kategori/önem türetme mantığını koru, özel durumlarda açıkça kategori veya önem seviyesi ver.