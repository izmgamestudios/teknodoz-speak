# Konuşma Pratiği (Node.js)

Oxford 3000 kelimeleri (A1-B2), C1-C2 ek kelimeleri ve 3-5 kelimelik aksiyon cümleleriyle İngilizce konuşma pratiği uygulaması.
Sunucu **bağımlılıksızdır** (yalnızca Node.js yerleşik modülleri), `npm install` gerekmez. Node.js 18 veya üzeri yeterlidir.

## Özellikler
- 4500+ kart: kelimeler ve cümleler, Türkçe çevirili, A1-C2 seviyeli
- Duyarlı arayüz (mobil, tablet, masaüstü) ve alt menü
- **Sade** mod (göz yormayan renkler, yalnızca kart + oynatıcı) ve **Detaylı** mod (tüm paneller)
- Detaylı modda paneller açılır/kapanır ve ▲ ▼ düğmeleriyle yukarı aşağı taşınır; düzen tarayıcıda hatırlanır
- Dinleme oynatıcısı: başlat, duraklat, durdur, hız, otomatik oynatma, tekrar sayısı
- **Shadowing:** otomatik modda okuma sonrası ayarlanabilir tekrar boşluğu (0-8 sn); etiket seçilene kadar bekleme; etiket seçmek sesi kesmez
- WAV kayıt (16/22/44.1 kHz), kaydı dinleme, WAV içe/dışa aktarma, toplu ZIP
- **Sınav** sekmesi: dinle ve seç, Türkçeden seç, dikte; yanlışlar otomatik Bilmiyorum olur
- **Bugünün planı** (günlük tekrar + yeni kart listesi), 13 rozet, açık/koyu/sistem teması
- Favoriler (⭐, kısayol F), son 30 gün çalışma grafiği, yazı boyutu ayarı
- Credits sekmesi (geliştirici, kaynaklar, lisanslar)
- **Aralıklı tekrar** (Leitner): "Bugün tekrar" kartları, etiketlere göre otomatik takvim
- Arama (kelime veya Türkçe anlam) ve masaüstü klavye kısayolları (Boşluk, ←, →, 1/2/3, T, A, S, R, F)
- Tonlama ve vurgu kartları (↗ ↘, BÜYÜK harf vurgu), özgün film/dizi tarzı replikler, kamu malı şiir ve şarkı dizeleri, tekerlemeler; kartta "not" alanı
- **Telaffuz puanı** (konuşma tanıma): kelime kelime hizalama, 0-100 puan, renkli geri bildirim, ABD/İngiliz aksanı
- **Oyunlaştırma:** XP ve seviye, günlük/haftalık görevler, sandık (değişken ödül), seri koruyucu, avatarlar, 9 duraklı yolculuk haritası, hatırlatıcı (.ics)
- Gezinme çubuğu, seviye atlama, 15/60/180 sn meydan okuma, günlük hedef ve seri
- CSV, JSON ve Word (.docx) içe/dışa aktarma, taslak dosyalar
- PNG/PDF rapor (infografik)
- PWA: telefona yüklenebilir, çevrimdışı çalışır
- **Veritabansız ve sunucusuz:** bütün ilerleme (XP, görev, kayıt) tarayıcıda saklanır. Node.js yalnızca statik dosya sunar, istersen `public/` klasörünü herhangi bir statik barındırmaya (veya CloudPanel static site) koyabilirsin
- İsteğe bağlı sunucu eşitleme (varsayılan KAPALI, `SYNC_ENABLED=1` ile açılır)

## Klasör yapısı
```
teknodoz-speak/
  server.js               Node.js sunucusu (statik dosyalar + eşitleme API)
  package.json
  ecosystem.config.js     PM2 ayarı
  .env.example            Ortam değişkenleri örneği
  public/                 Uygulama (index.html, manifest, sw.js, simgeler, vendor/)
  data/                   Eşitleme verileri (otomatik oluşur, yedeklenmeli)
  test/smoke.test.js      npm test
```

## Sunucusuz kullanım
Sunucu şart değildir: `public/` klasörünü olduğu gibi herhangi bir statik barındırmaya yükle ya da `public/index.html` dosyasını doğrudan aç (mikrofon için HTTPS veya localhost gerekir). Veritabanı yoktur; ilerleme tarayıcının localStorage ve IndexedDB alanında durur. Yedek için Veri sekmesinden JSON veya yedek kodu al.

## Yerelde çalıştırma
```bash
node server.js            # http://127.0.0.1:3000
npm test                  # sunucu testleri (eşitleme testte açılır)
```
Mikrofon yalnızca **HTTPS** veya `localhost` üzerinde çalışır (tarayıcı kuralı).

## CloudPanel'e kurulum
CloudPanel arayüzü sürüme göre küçük farklar gösterebilir, adımlar genel akıştır.

1. **Site oluştur:** CloudPanel > *Sites* > *Add Site* > *Create a Node.js Site*. Alan adını gir, Node.js sürümünü seç (18, 20 veya 22) ve **App Port** olarak `3000` yaz.
2. **Dosyaları yükle:** Bu klasörün içeriğini (zip'i açıp) site kullanıcısının dizinine yükle: `/home/<site-kullanıcısı>/htdocs/<alan-adı>/` (SFTP veya SCP ile). `server.js` bu dizinin kökünde olmalı.
3. **SSH ile bağlan** (site kullanıcısıyla) ve çalıştır:
   ```bash
   cd ~/htdocs/<alan-adı>
   pm2 start ecosystem.config.js
   pm2 save
   ```
   Sunucu yeniden başlayınca otomatik açılması için `pm2 startup` çıktısındaki komutu bir kez çalıştır. Uygulama CloudPanel'in Nginx ters vekili (reverse proxy) arkasında `127.0.0.1:3000` üzerinde çalışır.
4. **SSL:** Site > *SSL/TLS* > Let's Encrypt sertifikası al. **Mikrofon kaydı için HTTPS zorunludur.**
5. **Ortam değişkenleri:** `ecosystem.config.js` içindeki `env` bölümünü düzenle (PORT, App Port ile aynı olmalı). Eşitlemeyi korumak için `SYNC_TOKEN` ekle:
   ```js
   env: { NODE_ENV: 'production', PORT: 3000, HOST: '127.0.0.1', DATA_DIR: './data', SYNC_TOKEN: 'uzun-rastgele-bir-anahtar' }
   ```
   Değişiklikten sonra: `pm2 restart teknodoz-speak --update-env`
6. **Kontrol:** `https://alan-adin/api/health` adresi `{"ok":true,...}` dönmeli.

### GitHub'dan otomatik dağıtım (önerilen)
`main` dalına her push: test çalışır, geçerse dosyalar CloudPanel sunucusuna rsync ile gönderilir ve `scripts/post-deploy.sh` uygulamayı PM2 ile yeniden yükler. `data/` ve `.env` asla ezilmez.

**Bir kerelik kurulum**
1. Sunucuda (site kullanıcısıyla) deploy anahtarı üret: `ssh-keygen -t ed25519 -f ~/.ssh/gh_deploy -N ""` ve `cat ~/.ssh/gh_deploy.pub >> ~/.ssh/authorized_keys`. Özel anahtar `~/.ssh/gh_deploy` dosyasındadır.
2. CloudPanel'de site kullanıcısına SSH erişimi açık olmalı. Sunucuda `pm2` kurulu olmalı (`npm i -g pm2`).
3. GitHub > Repo > *Settings* > *Secrets and variables* > *Actions* altına şu secret'ları ekle:

| Secret | Değer |
|---|---|
| `DEPLOY_HOST` | Sunucu IP veya alan adı |
| `DEPLOY_USER` | CloudPanel site kullanıcısı |
| `DEPLOY_PATH` | `/home/<kullanıcı>/htdocs/<alan-adı>` |
| `DEPLOY_SSH_KEY` | `gh_deploy` özel anahtarının tüm içeriği |
| `DEPLOY_KNOWN_HOSTS` | (isteğe bağlı) `ssh-keyscan -H <sunucu>` çıktısı; boşsa workflow kendisi tarar |

4. İlk kurulumda sunucuda bir kez `pm2 start ecosystem.config.js && pm2 save` çalıştır (yukarıdaki 3. adım). Sonrası otomatik.

**Alternatif (Actions'sız):** sunucuda `git clone <repo-url> ~/htdocs/<alan-adı>`, güncellemek için `git pull && bash scripts/post-deploy.sh`.

### Güncelleme
Yeni `public/` ve `server.js` dosyalarını üzerine kopyala, `pm2 restart teknodoz-speak`. Servis çalışanı sürümünü yükseltmek için `public/sw.js` içindeki `VERSION` değerini değiştir.

### Yedekleme
Eşitleme verileri `data/` klasöründedir (`data/<profil>/state.json` ve `data/<profil>/rec/*.wav`). Bu klasörü düzenli yedekle.

## Ortam değişkenleri
| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `PORT` | `3000` | Dinlenen port (CloudPanel App Port ile aynı) |
| `HOST` | `127.0.0.1` | Ters vekil arkasında böyle kalsın; doğrudan erişim için `0.0.0.0` |
| `DATA_DIR` | `./data` | Eşitleme verisi klasörü |
| `SYNC_TOKEN` | boş | Tanımlıysa API, `x-sync-token` başlığı ister |
| `SYNC_ENABLED` | `0` | `1` yaparsan isteğe bağlı eşitleme API'si açılır (dosya tabanlı, veritabanı yok) |

## Eşitleme API'si (isteğe bağlı, varsayılan kapalı)
Kimlik doğrulama yok; **profil kodu** (6-64 karakter: harf, rakam, `-`, `_`) gizli tutulmalıdır. `SYNC_TOKEN` tanımlıysa her istekte `x-sync-token` gerekir.

| İstek | Açıklama |
|---|---|
| `GET /api/health` | Sağlık ve ayar bilgisi |
| `GET/PUT /api/state/:profil` | Etiketler, ayarlar ve eklenen öğeler (JSON, en fazla 2 MB) |
| `GET /api/rec/:profil` | Kayıt listesi |
| `GET/PUT/DELETE /api/rec/:profil/:anahtar` | WAV kaydı (en fazla 10 MB, `x-en` başlığı cümleyi taşır) |

Sınırlar: IP başına dakikada 240 API isteği, profil başına 4000 kayıt. Gövde boyutu ve WAV başlığı doğrulanır.

## Uygulama içinde eşitleme
Uygulama Node sunucusundan açıldığında *Veri* sekmesinde **Sunucu eşitleme** bölümü görünür: profil kodu üret/gir, *Sunucuya yükle* / *Sunucudan al* ile durumu, *Kayıtları yükle* / *Kayıtları al* ile ses kayıtlarını taşı. Veriler yine de her cihazda tarayıcıda (localStorage ve IndexedDB) saklanır, eşitleme manueldir.

## Sorun giderme
- **Mikrofon açılmıyor:** HTTPS olduğundan ve tarayıcı iznini verdiğinden emin ol. iPhone'da Safari'yi kullan.
- **Ses okunmuyor:** Cihazın sessiz modunu ve İngilizce ses paketini kontrol et.
- **WAV inmiyor:** Açılır pencere/indirme engelleyiciyi kapat. Dosya adı cümlenin küçük harfli, alt çizgili hâlidir (`i_grab_my_keys.wav`).
- **Eşitleme bölümü görünmüyor:** Bu normaldir; `SYNC_ENABLED=1` yapmadığın sürece gizlidir.
- **Eski sürüm görünüyor:** Servis çalışanı önbelleği; sayfayı yenile veya `sw.js` `VERSION` değerini artır.

## Geliştirici ve iletişim
**Hüseyin Bayer**, izmgamestudios@gmail.com, 0541 770 92 05

## Kaynak ve lisans
Kelime listesi: The Oxford 3000 (Oxford University Press). C1-C2 kelimeleri, Türkçe karşılıklar, örnek cümleler ve film/dizi tarzı replikler bu projeye özgüdür (gerçek film/dizi alıntısı değildir). Şiir ve şarkı kartları kamu malı eserlerden kısa dizelerdir; modern şarkı sözü içermez. Resmî bir çeviri değildir.
