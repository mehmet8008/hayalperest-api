require('dotenv').config(); // .env dosyasını oku
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// --- VERİTABANI BAĞLANTISI (TiDB / Bulut Uyumlu) ---
const db = mysql.createConnection({
    host: process.env.DB_HOST,      // .env'den al
    user: process.env.DB_USER,      // .env'den al
    password: process.env.DB_PASS,  // .env'den al
    database: process.env.DB_NAME,  // .env'den al
    port: process.env.DB_PORT,      // .env'den al
    ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
    }
});

db.connect((err) => {
    if (err) {
        console.log('❌ Veritabanına bağlanılamadı:', err);
    } else {
        console.log('✅ TiDB Bulut Veritabanı Bağlantısı Başarılı!');
    }
});

// GİZLİ ANAHTAR (Tek bir kez tanımlandı)
const SECRET_KEY = process.env.JWT_SECRET;

// --- API ROTALARI ---

app.get('/', (req, res) => {
    res.send('Hayalperest API Sunucusu (TiDB Cloud) Çalışıyor 🚀');
});

// 1. ÜRÜNLERİ GETİR
app.get('/api/urunler', (req, res) => {
    const sql = "SELECT * FROM urunler";
    db.query(sql, (err, data) => {
        if (err) return res.json(err);
        return res.json(data);
    });
});

// 2. KATEGORİLERİ GETİR
app.get('/api/kategoriler', (req, res) => {
    const sql = "SELECT * FROM kategoriler";
    db.query(sql, (err, data) => {
        if (err) return res.json(err);
        return res.json(data);
    });
});

// 3. KATEGORİYE GÖRE FİLTRELE
app.get('/api/urunler/kategori/:id', (req, res) => {
    const kategoriId = req.params.id;
    const sql = "SELECT * FROM urunler WHERE kategori_id = ?";
    db.query(sql, [kategoriId], (err, data) => {
        if (err) return res.json(err);
        return res.json(data);
    });
});

// 4. KAYIT OL (Register)
app.post('/api/kayit', (req, res) => {
    const { ad_soyad, email, sifre } = req.body;

    db.query("SELECT * FROM uyeler WHERE email = ?", [email], async (err, result) => {
        if(err) return res.status(500).json(err);
        if(result.length > 0) return res.status(400).json({ mesaj: "Bu e-posta zaten kayıtlı!" });

        const hashliSifre = await bcrypt.hash(sifre, 10);

        const sql = "INSERT INTO uyeler (ad_soyad, email, sifre) VALUES (?, ?, ?)";
        db.query(sql, [ad_soyad, email, hashliSifre], (err, result) => {
            if(err) return res.status(500).json(err);
            res.json({ mesaj: "Kayıt başarılı! Şimdi giriş yapabilirsiniz." });
        });
    });
});

// 5. GİRİŞ YAP (Login)
app.post('/api/giris', (req, res) => {
    const { email, sifre } = req.body;

    db.query("SELECT * FROM uyeler WHERE email = ?", [email], async (err, result) => {
        if(err) return res.status(500).json(err);
        if(result.length === 0) return res.status(401).json({ mesaj: "Kullanıcı bulunamadı!" });

        const kullanici = result[0];
        const sifreDogruMu = await bcrypt.compare(sifre, kullanici.sifre);
        
        if(!sifreDogruMu){
            return res.status(401).json({ mesaj: "Hatalı şifre!" });
        }

        const token = jwt.sign(
            { id: kullanici.id, ad: kullanici.ad_soyad, email: kullanici.email },
            SECRET_KEY,
            { expiresIn: '1h' }
        );

        res.json({ 
            mesaj: "Giriş Başarılı", 
            token: token,
            kullanici: { ad: kullanici.ad_soyad, email: kullanici.email }
        });
    });
});

// 6. SİPARİŞ VER
app.post('/api/siparis-ver', (req, res) => {
    const { musteri_ad, toplam_tutar, sepet } = req.body;

    const sqlSiparis = "INSERT INTO siparisler (uye_id, musteri_ad, toplam_tutar, durum) VALUES (?, ?, ?, ?)";
    
    // Not: Üye ID şimdilik 1 gönderiliyor, token entegrasyonu ile dinamik yapılabilir.
    db.query(sqlSiparis, [1, musteri_ad, toplam_tutar, 'Hazırlanıyor'], (err, result) => {
        if (err) {
            console.error("Sipariş hatası:", err);
            return res.status(500).json({ hata: "Sipariş kaydedilemedi" });
        }

        const siparisId = result.insertId;

        sepet.forEach(urun => {
            const sqlDetay = "INSERT INTO siparis_detay (siparis_id, urun_id, adet, fiyat) VALUES (?, ?, ?, ?)";
            db.query(sqlDetay, [siparisId, urun.id, 1, urun.fiyat], (errDetay) => {
                if(errDetay) console.error("Detay hatası:", errDetay);
            });
        });

        console.log(`✅ Yeni Sipariş Alındı! ID: ${siparisId}`);
        res.json({ mesaj: "Sipariş başarıyla alındı", siparisId: siparisId });
    });
});

// 7. PROFİL (SİPARİŞ GEÇMİŞİ)
app.post('/api/siparislerim', (req, res) => {
    const { musteri_ad } = req.body;

    const sql = `
        SELECT s.id, s.tarih, s.toplam_tutar, s.durum,
               GROUP_CONCAT(u.ad SEPARATOR ', ') as urunler
        FROM siparisler s
        LEFT JOIN siparis_detay sd ON s.id = sd.siparis_id
        LEFT JOIN urunler u ON sd.urun_id = u.id
        WHERE s.musteri_ad = ?
        GROUP BY s.id
        ORDER BY s.tarih DESC
    `;

    db.query(sql, [musteri_ad], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ mesaj: "Hata oluştu" });
        }
        res.json(result);
    });
});

// SUNUCUYU BAŞLAT
app.listen(3000, () => {
    console.log('Server 3000 portunda çalışıyor...');
});