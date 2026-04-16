const express = require('express');
const priority = require('priority-web-sdk'); // וודאי שהספריה מותקנת
const app = express();

app.use(express.json());

app.post('/api/close-tiv', async (req, res) => {
    
    // 1. אבטחה: בדיקת מפתח סודי (Header)
    // שנו את המחרוזת הזו למשהו סודי משלכם
    const MY_INTERNAL_KEY = "*Bank_AI@2026&"; 
    const providedKey = req.headers['x-api-key']; 

    if (!providedKey || providedKey !== MY_INTERNAL_KEY) {
        console.error("❌ ניסיון גישה לא מורשה");
        return res.status(401).json({ 
            status: "error", 
            message: "Access Denied: Invalid or missing API Key" 
        });
    }

    // 2. חילוץ פרמטרים מגוף הבקשה
    const { 
        priorityUrl, 
        company, 
        username, 
        password, 
        ivNum 
    } = req.body;

    // 3. ניהול שגיאות קלט (Validation)
    // בודק שכל השדות הגיעו לפני שבכלל מנסים להתחבר
    const missingFields = [];
    if (!priorityUrl) missingFields.push("priorityUrl");
    if (!company) missingFields.push("company");
    if (!username) missingFields.push("username");
    if (!password) missingFields.push("password");
    if (!ivNum) missingFields.push("ivNum");

    if (missingFields.length > 0) {
        return res.status(400).json({ 
            status: "error", 
            message: `Missing required parameters: ${missingFields.join(', ')}` 
        });
    }

    // הגדרת הקונפיגורציה הדינמית
    const config = {
        url: priorityUrl, 
        tabulaini: 'tabula.ini',
        language: 1, // 1 לעברית
        company: company,      
        username: username, 
        password: password
    };

    try {
        console.log(`-------------------------------------------`);
        console.log(`מתחיל תהליך עבור מזהה חשבונית: ${ivNum} בסביבת: ${company}`);

        // 4. התחברות לפריוריטי
        try {
            await priority.login(config);
            console.log("1. מחובר בהצלחה.");
        } catch (loginError) {
            throw new Error(`Priority Login Failed: ${loginError.message}`);
        }

        // 5. הפעלת הפרוצדורה
        let step;
        try {
            step = await priority.procStart('CLOSETIV', 'P', null);
            console.log("2. פרוצדורה נפתחה. סטטוס:", step.type);
        } catch (procError) {
            throw new Error(`Failed to start procedure: ${procError.message}`);
        }

        // 6. הזנת נתונים (אם הפרוצדורה מבקשת קלט)
        if (step.type === 'inputFields') {
            const fieldId = step.input.EditFields[0].field; 

            const inputData = {
                EditFields: [
                    {
                        field: fieldId,
                        value: ivNum.toString()
                    }
                ]
            };

            console.log("3. שולח ערך:", ivNum);
            step = await step.proc.inputFields(1, inputData);
        }

        // 7. איסוף הודעות סיום
        console.log("4. סטטוס סופי:", step.type);
        
        let messages = [];
        if (step.proc && step.proc.message) messages = step.proc.message;
        if (step.message) messages = step.message;

        // התנתקות מסודרת
        try { await priority.logout(); } catch(e) { console.log("Logout warning:", e.message); }

        console.log("✅ סיום בהצלחה!");

        return res.json({ 
            status: "success", 
            stepType: step.type,
            messages: messages 
        });

    } catch (error) {
        // 8. ניהול שגיאות זמן הרצה (Runtime Errors)
        console.error("❌ שגיאת מערכת:", error.message);
        
        // ניסיון התנתקות גם במקרה של שגיאה כדי לא לתפוס רישיונות
        try { await priority.logout(); } catch(e) {}

        return res.status(500).json({ 
            status: "error", 
            message: error.message || "שגיאה לא צפויה בביצוע הפרוצדורה"
        });
    }
});

// הפעלת השרת (אם זה הקובץ הראשי)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));