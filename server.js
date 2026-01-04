const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors()); // Herkese kapıyı aç (React girebilsin)
app.use(express.json());

// 1. VERİTABANI BAĞLANTISI (MAMP Ayarları)
// Mac MAMP genelde şifre olarak 'root' kullanır. Port genelde 8889'dur.
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root', // MAMP varsayılan şifresi
    database: 'eticaret_db',
    port: 8889 // DİKKAT: Windows'ta bu satırı sil, Mac'te MAMP portuna bak (Genelde 8889)
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

// 3. SUNUCUYU BAŞLAT
app.listen(3000, () => {
    console.log('Server 3000 portunda çalışıyor...');
});