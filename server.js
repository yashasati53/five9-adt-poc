const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Allow iframe framing and cross-origin access for local testing
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    // Remove X-Frame-Options to permit iframe embedding of local mock ADT
    res.removeHeader('X-Frame-Options');
    next();
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`🚀 Five9 ADT & CRM SDK Integration POC is running!`);
    console.log(`👉 Portal URL: http://localhost:${PORT}`);
    console.log(`👉 Mock ADT URL: http://localhost:${PORT}/mock-adt.html`);
    console.log(`==================================================`);
});
