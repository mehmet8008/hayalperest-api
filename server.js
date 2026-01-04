const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors()); // Herkese kapıyı aç (React girebilsin)
app.use(express.json());

// 1. VERİTABANI BAĞLANTISI (MAMP Ayarları)
// Mac MAMP genelde şifre olarak 'root' kullanır. Port genelde 8889'dur.
// 1. VERİTABANI BAĞLANTISI (GÜNCELLENMİŞ)
const db = mysql.createConnection({
    host: '127.0.0.1', // DİKKAT: 'localhost' yerine bunu yazdık!
    user: 'root',
    password: 'root',
    database: 'eticaret_db',
    port: 8889 // MAMP Portun 8889 ise burası kalsın, farklıysa değiştir.
});

db.connect((err) => {
    if (err) {
        console.log('❌ Veritabanına bağlanılamadı:', err);
    } else {
        console.log('✅ MySQL Bağlantısı Başarılı!');
    }
});

// 2. API ROTALARI (React buraya istek atacak)

// Ana Sayfa Testi
app.get('/', (req, res) => {
    res.send('Hayalperest API Sunucusu Çalışıyor 🚀');
});

// Ürünleri Getiren Link
app.get('/api/urunler', (req, res) => {
    const sql = "SELECT * FROM urunler";
    db.query(sql, (err, data) => {
        if (err) return res.json(err);
        return res.json(data); // Veritabanından gelen listeyi React'e gönder
    });
});
// --- SİPARİŞ OLUŞTURMA (POST İsteği) ---
app.post('/api/siparis-ver', (req, res) => {
    const { musteri_ad, toplam_tutar, sepet } = req.body; // React'ten gelen veriler

    // 1. Önce Siparişi Kaydet (siparisler tablosu)
    // Not: Şimdilik üye sistemi React'te olmadığı için üye_id'yi 0 veya 1 alıyoruz.
    const sqlSiparis = "INSERT INTO siparisler (uye_id, musteri_ad, toplam_tutar, durum) VALUES (?, ?, ?, ?)";
    
    db.query(sqlSiparis, [1, musteri_ad, toplam_tutar, 'Hazırlanıyor'], (err, result) => {
        if (err) {
            console.error("Sipariş hatası:", err);
            return res.status(500).json({ hata: "Sipariş kaydedilemedi" });
        }

        const siparisId = result.insertId; // Yeni oluşan siparişin ID'si

        // 2. Sonra Sepetteki Ürünleri Kaydet (siparis_detay tablosu)
        // Sepetteki her ürün için tek tek ekleme yapıyoruz
        sepet.forEach(urun => {
            const sqlDetay = "INSERT INTO siparis_detay (siparis_id, urun_id, adet, fiyat) VALUES (?, ?, ?, ?)";
            // React tarafında 'adet' tutmuyoruz şimdilik, varsayılan 1 gönderiyoruz
            db.query(sqlDetay, [siparisId, urun.id, 1, urun.fiyat], (errDetay) => {
                if(errDetay) console.error("Detay hatası:", errDetay);
            });
        });

        console.log(`✅ Yeni Sipariş Alındı! ID: ${siparisId}`);
        res.json({ mesaj: "Sipariş başarıyla alındı", siparisId: siparisId });
    });
});
// 3. SUNUCUYU BAŞLAT
app.listen(3000, () => {
    console.log('Server 3000 portunda çalışıyor...');
});