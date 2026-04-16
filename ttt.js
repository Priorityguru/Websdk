process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // חובה לנטפרי
const priority = require('priority-web-sdk');

// פרטי ההתחברות שלך
const loginConfig = {
    tabulaini: 'tabula.ini',
    language: 1,
    company: 'demo',       // ודאי שוב אם זה demo או Demo (משנה מאוד!)
    username: 'TEST',
    password: 'fuko560'
};

// רשימת כל הכתובות האפשריות בשרתי Priority Guru
const potentialUrls = [
    'https://host6013.priority-guru.co.il',
    'https://host6013.priority-guru.co.il/Priority',
    'https://host6013.priority-guru.co.il/net',
    'https://host6013.priority-guru.co.il/up',
    'https://host6013.priority-guru.co.il/wcf',
    'https://host6013.priority-guru.co.il/Priority/wcf',
    'https://host6013.priority-guru.co.il/net/wcf'
];

async function findWorkingUrl() {
    console.log("מתחיל בסריקת כתובות לחיבור SDK...");

    for (const url of potentialUrls) {
        process.stdout.write(`בודק את: ${url} ... `);
        
        // מעדכן את הכתובת בקונפיג
        const currentConfig = { ...loginConfig, url: url };

        try {
            await priority.login(currentConfig);
            console.log("\n✅ הצלחה!!! הכתובת הנכונה היא:");
            console.log("\x1b[32m%s\x1b[0m", url); // צבע ירוק
            
            await priority.logout();
            return; // עוצר כשיש הצלחה
        } catch (error) {
            // אם השגיאה היא לא "404" או "LoginFailed", אולי זה משהו אחר
            if (error.message.includes('404') || error.message.includes('connect')) {
                console.log("❌ לא נמצא");
            } else {
                console.log(`❌ שגיאה אחרת: ${error.message}`);
                // לפעמים שווה לראות את השגיאה המלאה אם היא על שם משתמש
            }
        }
    }
    console.log("\nסיימנו לסרוק. אם שום דבר לא עבד, ייתכן שיש חסימה לממשק ה-Web למשתמש הזה.");
}

findWorkingUrl();