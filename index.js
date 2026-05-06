// עוקף את חסימת האבטחה של נטפרי (חובה!)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const priority = require('priority-web-sdk');

const app = express();
app.use(express.json());

let config = {
    url: '', 
    virtualApiUrl: '',
    tabulaini: '',
    language: 1,
    company: '',       
    username: '', 
    password: ''
};

function fillConfig(req) {
  config = {
    url: req.body.priorityUrl, 
    virtualApiUrl: req.body.virtualApiUrl, 
    tabulaini: req.body.tabulaIni,
    language: 1,
    company: req.body.company,       
    username: req.body.username, 
    password: req.body.password
    };
};

app.post('/api/close-tiv', async (req, res) => {
    
	// --- הוספת אבטחה: בדיקת מפתח סודי ---
    const mySecret = "MY_SUPER_SECRET_PASSWORD_123"; // סיסמה שרק את ו-Make יודעים
    const providedKey = req.headers['x-api-key']; // Make ישלח את זה בכותרת

    if (providedKey !== mySecret) {
        return res.status(401).json({ error: "Access Denied: Wrong Password" });
    }
    // ------------------------------------

    const ivNum = req.body.ivNum; 

    if (!ivNum) {
        return res.status(400).send({ error: "חובה לשלוח מזהה חשבונית (ivNum)" });
    }

    try {
        console.log(`-------------------------------------------`);
        console.log(`מתחיל תהליך עבור מזהה חשבונית: ${ivNum}`);

        // 1. התחברות
        fillConfig(req);
        await priority.login(config);
        console.log("1. מחובר בהצלחה.");

        // 2. פתיחת הפרוצדורה
        let step = await priority.procStart('CLOSETIV', 'P', null);
        console.log("2. פרוצדורה נפתחה. סטטוס:", step.type);

        // 3. הזנת נתונים
        // בודקים אם אנחנו בשלב של קליטת פרמטרים
        if (step.type === 'inputFields') {
            
            // מכינים את אובייקט הקלט לפי המבנה שה-SDK דורש
            // אנחנו לוקחים את ה-ID של השדה הראשון (PAR) מתוך מה שהשרת שלח לנו
            const fieldId = step.input.EditFields[0].field; 

            const inputData = {
                EditFields: [
                    {
                        field: fieldId,     // מזהה השדה (בדרך כלל 1)
                        value: ivNum.toString() // הערך לשליחה
                    }
                ]
            };

            console.log("3. שולח ערך:", ivNum);
            
            // שימוש בפונקציה inputFields הנמצאת תחת .proc
            // המספר 1 בהתחלה מסמן "אישור/המשך"
            step = await step.proc.inputFields(1, inputData);
        }

        // 4. בדיקת תוצאות (הצעד הבא שהתקבל)
        // אם הפרוצדורה הסתיימה, נקבל בדרך כלל הודעה או שהצעד יהיה מסוג אחר
        console.log("4. סטטוס סופי:", step.type);
        
        let messages = [];
        if (step.proc && step.proc.message) {
            messages = step.proc.message; // לפעמים ההודעות כאן
        } 
        // לפעמים ההודעה נמצאת בגוף הצעד עצמו כתלות בגרסה
        if (step.message) {
             messages = step.message;
        }

        // התנתקות
        try { await priority.logout(); } catch(e) {}

        console.log("✅ סיום בהצלחה!");

        return res.json({ 
            status: "success", 
            stepType: step.type,
            messages: messages 
        });

    } catch (error) {
        console.error("❌ שגיאה:", error); // מדפיס את כל האובייקט שגיאה
        return res.status(500).json({ 
            status: "error", 
            message: error.message || "שגיאה בביצוע הפרוצדורה" 
        });
    }
});

app.post('/api/prep-bank-recorn', async (req, res) => {
    
    // קליטת הנתונים
    const inputMap = req.body.inputs || {}; 
    let allMessages = []; 
    let stepsCounter = 0;

    const addMsg = (msgSource) => {
        if (!msgSource) return;
        const msgs = Array.isArray(msgSource) ? msgSource : [msgSource];
        msgs.forEach(m => {
            if (m && typeof m === 'string' && m.trim().length > 0) allMessages.push(m);
        });
    };

    try {
        console.log(`--- מתחיל תהליך PREPBANKRECON ---`);
        console.log("נתוני קלט:", JSON.stringify(inputMap)); 

        if (priority.login && typeof priority.login === 'function') 
        {
            fillConfig(req)
            await priority.login(config);
        }
        let step = await priority.procStart('PREPBANKRECON', 'P', null);

        while (step.type !== 'menu' && step.type !== 'end' && stepsCounter < 100) {
            stepsCounter++;
            console.log(`>> צעד ${stepsCounter} | סוג: ${step.type}`);
            
            addMsg(step.message);
            if (step.proc) addMsg(step.proc.message);

            // ---------------------------------------------------------
            // 1. טיפול בשדות קלט (INPUT) - התיקון: זיהוי לפי כותרת עברית
            // ---------------------------------------------------------
            if (step.type === 'inputFields') {
                console.log("📝 מסך קלט.");
                let fieldsToSubmit = [];
                
                if (step.input && step.input.EditFields) {
                    for (let field of step.input.EditFields) {
                        
                        // 1. נסיון למצוא שם אנגלי
                        let paramName = field.name || field.Name || field.key || field.Key;
                        
                        // 2. אם קיבלנו מספר (כמו '1') או כלום - ננסה לזהות לפי הכותרת בעברית!
                        // זה הפתרון לבעיה שלך כרגע
                        const title = field.title || field.Title || "";
                        
                        if ((!paramName || !isNaN(paramName)) && title) {
                            console.log(`   ℹ️ השם הוא מספרי ('${paramName}'), מנסה לזהות לפי כותרת: "${title}"`);
                            
                            if (title.includes("חש") || title.includes("בנק") || title.includes("אשראי")) paramName = "CSH";
                            else if (title.includes("תאריך")) paramName = "FNC";
                            else if (title.includes("קובץ")) paramName = "EXTFILE";
                            else if (title.includes("סוג")) paramName = "TYP";
                            // אפשר להוסיף כאן עוד מיפויים לפי הצורך
                        }

                        // --- דיבאג קריטי: אם עדיין לא מצאנו, נדפיס את הכל ---
                        if (!paramName || !isNaN(paramName)) {
                            console.log("   ❌ לא זוהה שם הגיוני. הנה כל המידע על השדה:", JSON.stringify(field));
                        }

                        let valueToSend = "";
                        
                        if (paramName && inputMap.hasOwnProperty(paramName)) {
                            let rawValue = inputMap[paramName];
                            if (Array.isArray(rawValue) && rawValue.length === 1) rawValue = rawValue[0];
                            valueToSend = Array.isArray(rawValue) ? rawValue.join('\r\n') : rawValue;
                            console.log(`   V שדה '${paramName}' (כותרת: ${title}): נשלח '${valueToSend}'`);
                        } else {
                            console.log(`   X שדה '${paramName}' חסר ב-JSON. שולח ריק.`);
                        }
                        
                        fieldsToSubmit.push({ field: field.field || field, value: valueToSend.toString() });
                    }
                }
                
                try {
                    step = await step.proc.inputFields(1, { EditFields: fieldsToSubmit });
                    if (step.error) throw new Error(`Priority Error: ${step.error}`);
                } catch (e) {
                    console.log("שגיאה ב-inputFields, מנסה להמשיך:", e.message);
                    step = await step.proc.inputFields(1, {});
                }
            } 
            
            // ---------------------------------------------------------
            // 2. טיפול באזהרות (WARNING / MESSAGE)
            // ---------------------------------------------------------
            else if (['warning', 'message', 'WRNMSG'].includes(step.type)) {
                console.log(`⚠️ אזהרה: "${step.message}".`);
                try {
                    step = await step.proc.inputFields(1, {}); 
                    console.log("   -> עבר (Enter)");
                } catch (e1) {
                    try {
                        step = await step.proc.warning(1);
                        console.log("   -> עבר (warning)");
                    } catch (e2) {
                        try { step = await step.proc.message(1); } catch(e) { break; }
                    }
                }
            }
            
            // הדפסה
            else if (step.type === 'reportOptions') {
                console.log("🖨️ שלב 30! מאשר...");
                try { step = await step.proc.reportOptions(1, {}); } 
                catch (e) { step = await step.proc.inputFields(1, {}); }
            }
            
            else if (step.type === 'help') { try { step = await step.proc.help(1); } catch(e) { break; } }
            else { try { step = await step.proc.inputFields(1, {}); } catch(e) { break; } }
        }

        console.log(">> סיום. סטטוס:", step.type);
        if (priority.logout) try { await priority.logout(); } catch(e) {}

        return res.json({ status: "success", messages: allMessages });

    } catch (error) {
        console.error("❌ שגיאה:", error.message);
        return res.status(500).json({ status: "error", message: error.message });
    }
});

app.post('/api/prepare-bank-Reconciliation', async (req, res) => {
    
    // קליטת הנתונים
    const inputMap = req.body || {}; 
    let allMessages = []; 
    let stepsCounter = 0;

    const addMsg = (msgSource) => {
        if (!msgSource) return;
        const msgs = Array.isArray(msgSource) ? msgSource : [msgSource];
        msgs.forEach(m => {
            if (m && typeof m === 'string' && m.trim().length > 0) allMessages.push(m);
        });
    };

    try {
        console.log(`--- מתחיל תהליך PREPBANKRECON ---`);
        console.log("נתוני קלט:", JSON.stringify(inputMap)); 

        if (priority.login && typeof priority.login === 'function') {
            fillConfig(req)
            await priority.login(config);
        }
        
        let step = await priority.procStart('PREPBANKRECON', 'P', null);

        while (step.type !== 'menu' && step.type !== 'end' && stepsCounter < 100) {
            stepsCounter++;
            console.log(`>> צעד ${stepsCounter} | סוג: ${step.type}`);
            
            addMsg(step.message);
            if (step.proc) addMsg(step.proc.message);

            // ---------------------------------------------------------
            // 1. טיפול בשדות קלט (INPUT) - התיקון: זיהוי לפי כותרת עברית
            // ---------------------------------------------------------
            if (step.type === 'inputFields') {
                console.log("📝 מסך קלט.");
                let fieldsToSubmit = [];
                
                if (step.input && step.input.EditFields) {
                    for (let field of step.input.EditFields) {
                        
                        // 1. נסיון למצוא שם אנגלי
                        let paramName = field.name || field.Name || field.key || field.Key;
                        
                        // 2. אם קיבלנו מספר (כמו '1') או כלום - ננסה לזהות לפי הכותרת בעברית!
                        // זה הפתרון לבעיה שלך כרגע
                        const title = field.title || field.Title || "";
                        
                        if ((!paramName || !isNaN(paramName)) && title) {
                            console.log(`   ℹ️ השם הוא מספרי ('${paramName}'), מנסה לזהות לפי כותרת: "${title}"`);
                            
                            if (title.includes("חש") && title.includes("בנק") && title.includes("אשראי")) paramName = "CSH";
                            else if (title.includes("תאריך")) paramName = "FNC";
                            else if (title.includes("קובץ")) paramName = "EXTFILE";
                            else if (title.includes("קוד") && title.includes("פעולת") && title.includes("בנק")) paramName = "TYP";
                            else if (title.includes("צביעת") && title.includes("המלצה") && title.includes("להתאמה")) paramName = "COLOR";
                            // אפשר להוסיף כאן עוד מיפויים לפי הצורך
                        }

                        // --- דיבאג קריטי: אם עדיין לא מצאנו, נדפיס את הכל ---
                        if (!paramName || !isNaN(paramName)) {
                            console.log("   ❌ לא זוהה שם הגיוני. הנה כל המידע על השדה:", JSON.stringify(field));
                        }

                        let valueToSend = "";
                        
                        if (paramName && inputMap.hasOwnProperty(paramName)) {
                            let rawValue = inputMap[paramName];
                            if (Array.isArray(rawValue) && rawValue.length === 1) rawValue = rawValue[0];
                            valueToSend = Array.isArray(rawValue) ? rawValue.join('\r\n') : rawValue;
                            console.log(`   V שדה '${paramName}' (כותרת: ${title}): נשלח '${valueToSend}'`);
                        } else {
                            console.log(`   X שדה '${paramName}' חסר ב-JSON. שולח ריק.`);
                        }
                        
                        fieldsToSubmit.push({ field: field.field || field, value: valueToSend.toString() });
                    }
                }
                
                try {
                    step = await step.proc.inputFields(1, { EditFields: fieldsToSubmit });
                    if (step.error) throw new Error(`Priority Error: ${step.error}`);
                } catch (e) {
                    console.log("שגיאה ב-inputFields, מנסה להמשיך:", e.message);
                    step = await step.proc.inputFields(1, {});
                }
            } 
            
            // ---------------------------------------------------------
            // 2. טיפול באזהרות (WARNING / MESSAGE)
            // ---------------------------------------------------------
            else if (['warning', 'message', 'WRNMSG'].includes(step.type)) {
                console.log(`⚠️ אזהרה: "${step.message}".`);
                try {
                    step = await step.proc.inputFields(1, {}); 
                    console.log("   -> עבר (Enter)");
                } catch (e1) {
                    try {
                        step = await step.proc.warning(1);
                        console.log("   -> עבר (warning)");
                    } catch (e2) {
                        try { step = await step.proc.message(1); } catch(e) { break; }
                    }
                }
            }
            
            // הדפסה
            else if (step.type === 'reportOptions') {
                console.log("🖨️ שלב 30! מאשר...");
                try { step = await step.proc.reportOptions(1, {}); } 
                catch (e) { step = await step.proc.inputFields(1, {}); }
            }
            
            else if (step.type === 'help') { try { step = await step.proc.help(1); } catch(e) { break; } }
            else { try { step = await step.proc.inputFields(1, {}); } catch(e) { break; } }
        }

        console.log(">> סיום. סטטוס:", step.type);
        if (priority.logout) try { await priority.logout(); } catch(e) {}

        return res.json({ status: "success", messages: allMessages });

    } catch (error) {
        console.error("❌ שגיאה:", error.message);
        return res.status(500).json({ status: "error", message: error.message });
    }
});

app.post('/api/approve-bank-Reconciliation-using-websdk', async (req, res) => {
    
	// --- הוספת אבטחה: בדיקת מפתח סודי ---
    const mySecret = "MY_SUPER_SECRET_PASSWORD_123"; // סיסמה שרק את ו-Make יודעים
    const providedKey = req.headers['x-api-key']; // Make ישלח את זה בכותרת

    if (providedKey !== mySecret) {
        return res.status(401).json({ error: "Access Denied: Wrong Password" });
    }
    // ------------------------------------

    const user = req.body.user; 
    const bline = req.body.bline; 
    const axios = require('axios'); 
    
    if (!user) {
        return res.status(400).send({ error: "חובה לשלוח מזהה חשבונית (ivNum)" });
    }

     if (!bline) {
        return res.status(400).send({ error: "חובה לשלוח מזהה חשבונית (ivNum)" });
    }

    if (priority.login && typeof priority.login === 'function') {
        fillConfig(req)
        await priority.login(config);
    }

    let step = await priority.formStart('BANKRECONSP',null,null,null,1);
  
    let myFilter = {
        or: 0,          // 0 = AND, 1 = OR
        ignorecase: 1,  // 1 = Case insensitive
        QueryValues: [
            {
                field: "BLINE", // Must be the internal field name (all caps)
                fromval: bline,   // The value you are looking for
                op: "=",           // Operator: =, <, >, <=, >=, or LIKE
                sort: 0,           // 0 = No sort, 1 = Sort Asc, 2 = Sort Desc
                isdesc: 0
            },
            {
                field: "USER", // Must be the internal field name (all caps)
                fromval: user,   // The value you are looking for
                op: "=",           // Operator: =, <, >, <=, >=, or LIKE
                sort: 0,           // 0 = No sort, 1 = Sort Asc, 2 = Sort Desc
                isdesc: 0
            }
        ]
    };
        
    await step.setSearchFilter(myFilter);    
    let rows = await step.getRows(1);

    if (!rows || rows.length === 0) {
        throw new Error("No rows found for filter");
    }

    await step.setActiveRow(1);
    
    await step.fieldUpdate("RECONNUM", 7);
    await step.fieldUpdate("RECONMARK", 5);
     
    try {    
        await step.saveRow();
        } catch (e) {
        console.error("Field update failed", e);
    }

    await step.endCurrentForm();

    return res.json({ 
            status: "success", 
            stepType: step.type,
            messages: messages 
        });
});

// -----   אישור התאמות גורף    ------
app.post('/api/approve-bank-Reconciliation', async (req, res) => {
    
	// --- הוספת אבטחה: בדיקת מפתח סודי ---
    const mySecret = "MY_SUPER_SECRET_PASSWORD_123"; // סיסמה שרק את ו-Make יודעים
    const providedKey = req.headers['x-api-key']; // Make ישלח את זה בכותרת
    let stepsCounter = 0 ;

    if (providedKey !== mySecret) {
        return res.status(401).json({ error: "Access Denied: Wrong Password" });
    }
    // ------------------------------------

    const line = req.body.line; 
    const bankpage = req.body.bankpage; 
    const iv = req.body.iv; 
    const axios = require('axios'); 
   
    if (!bankpage) {
        return res.status(400).send({ error: "חובה לשלוח מזהה דף בנק (bankpage)" });
    }

     if (!line) {
        return res.status(400).send({ error: "חובה לשלוח מזהה שורה (line)" });
    }

     if (!iv) {
        return res.status(400).send({ error: "חובה לשלוח מזהה קבלה (iv)" });
    }

    fillConfig(req);

    const userpassword = config.username + ':' + config.password
    const headers = {
        'Authorization': 'Basic ' + Buffer.from(userpassword).toString('base64'),
        'Content-Type': 'application/json'
    };

    let params = {"$filter": ""};
    let userlogin = "";
    const baseURL = config.url + '/' + config.virtualApiUrl + '/' + config.tabulaini + '/' + config.company    
    let formname = "";    
    
    // Check if user is using a token    
    if (config.password == "PAT") {    
        console.log(`קבלת שם משתמש לפי טוקן`);
        formname = '/PATOKENS' ;                    
        const patname = config.username.slice(0, 4) + '*'.repeat(config.username.length - 8) + config.username.slice(-4);
        params = {"$filter": "PATNAME eq '" + patname + "'"};

        try {            
            let response = await axios.get(baseURL + formname, { headers, params});
            userlogin = response.data.value[0].USERLOGIN ;

            console.log(`התקבל שם משתמש לפי טוקן: ${userlogin}`);
        } catch (error) {
            console.log(`נכשלה קבלת שם משתמש לפי טוקן`);
            return res.status(500).json({ 
            status: "error", 
            message: "נכשלה קבלת שם משתמש לפי טוקן" + error.message 
            });
        }
        
    }
    else {        
        userlogin = config.username;
    }

    // Get USER ID by user name
    let userId = 0;
    try {    
            console.log(`-------------------------------------------`);
            console.log(`קבלת מספר משתמש לפי שם משתמש`);

            params = {
                "$filter": "USERLOGIN eq '" + userlogin + "'"
            };
            formname = '/USERS' ;

            response = await axios.get(baseURL + formname, { headers, params});

            userId = response.data.value[0].USER ;

            console.log(`התקבל מספר משתמש לפי שם משתמש: ${userId}`);
        } catch (error) {
            console.log(`נכשלה קבלת מספר משתמש לפי שם משתמש`);
            return res.status(500).json({ 
            status: "error", 
            message: "נכשלה קבלת מספר משתמש לפי שם משתמש" + error.message
            });
        }

    // Get IVNUM by iv 
    let ivnum = 0;   
    try {    
        console.log(`-------------------------------------------`);
        console.log(`קבלת מספר חשבונית`);

        params = {
            "$filter": "IV eq " + iv 
        };
        formname = '/TINVOICES' ;

        response = await axios.get(baseURL + formname, { headers, params});

        ivnum = response.data.value[0].IVNUM ;

        console.log(`התקבלה מספר קבלה  ${ivnum}`);
    } catch (error) {
        console.log(`נכשלה קבלת מספר קבלה`);
        return res.status(500).json({ 
        status: "error", 
        message: "נכשלה קבלת מספר קבלה" + error.message 
        });
    }
    
    // Get bline by ivnum
    let ivbline = 0;
    try {    
        console.log(`-------------------------------------------`);
        console.log(`קבלת מספר שורה עבור קבלה`);

        params = {
            "$filter": "FRST_IVNUM eq '" + ivnum + "'" 
        };
        formname = '/BANKRECONSP' ;

        response = await axios.get(baseURL + formname, { headers, params});

        ivbline = response.data.value[0].BLINE ;

        console.log(`התקבל מספר שורה עבור קבלה  ${ivbline}`);
    } catch (error) {
        console.log(`נכשלה קבלת מספר שורה עבור קבלה`);
        return res.status(500).json({ 
        status: "error", 
        message: "נכשלה קבלת מספר שורה עבור קבלה במשטח התאמות בנק"  + error.message
        });
    }
    
    // Get bline by bank page and line
    let bline = 0;
    try {    
        console.log(`-------------------------------------------`);
        console.log(`קבלת מספר שורה`);

        params = {
            "$filter": "ERPG_BANKPAGE eq " + bankpage + " AND ERPG_KLINE eq " + line
        };
        formname = '/BANKRECONSP' ;

        response = await axios.get(baseURL + formname, { headers, params});

        bline = response.data.value[0].BLINE ;

        console.log(`התקבל מספר שורה ${bline}`);
    } catch (error) {
        console.log(`נכשלה קבלת מספר שורה`);
        return res.status(500).json({ 
        status: "error", 
        message: "נכשלה קבלת מספר שורה במשטח התאמות בנק" + error.message 
        });
    }

    console.log(`-------------------------------------------`);
    console.log(`מתחיל תהליך עדכון`);

    try {
        console.log(`-------------------------------------------`);
        console.log(`סימון שורת קבלה`);

        formname = "/BANKRECONSP(BLINE=" + ivbline + ",USER=" + userId + ")" ;
      
        try {
            await axios.patch(baseURL + formname, 
                {"RECON": "Y"}, { headers });

            console.log(`סימון שורת קבלה הסתיים בהצלחה`);
        } catch (error) {
            console.log(`סימון שורת קבלה נכשל`);
            return res.status(500).json({ 
            status: "error", 
            message: "סימון שורת קבלה במשטח התאמות בנק נכשל" + error.message
            });
        }

        console.log(`-------------------------------------------`);
        console.log(`סימון שורת דף בנק`);

        formname = "/BANKRECONSP(BLINE=" + bline + ",USER=" + userId + ")" ;
      
        try {
            await axios.patch(baseURL + formname, 
                {"RECON": "Y"}, { headers });

            console.log(`סימון שורת דף בנק הסתיים בהצלחה`);
        } catch (error) {
            console.log(`סימון שורת דף בנק נכשל`);
            return res.status(500).json({ 
            status: "error", 
            message: "סימון שורת דף בנק במשטח התאמות בנק נכשל" + error.message
            });
        }

        // 1. התחברות           
        await priority.login(config);
        console.log("1. מחובר בהצלחה.");

        // 2.  פתיחת פרוצדורה התאמה
        let step = await priority.procStart('CLOSEBANKRECONISP', 'P', null);
        console.log("פרוצדורת התאמה נפתחה:", step.type);

        while (step.type !== 'menu' && step.type !== 'end' && stepsCounter < 100) {
            stepsCounter++;
            console.log(`>> צעד ${stepsCounter} | סוג: ${step.type}`);


            messages = [];
            if (step.proc && step.proc.message) {
                messages = step.proc.message; // לפעמים ההודעות כאן
            } 
            // לפעמים ההודעה נמצאת בגוף הצעד עצמו כתלות בגרסה
            if (step.message) {
                messages = step.message;
            }

            if (messages){
                console.log(messages);
            }

            if (['warning', 'message', 'WRNMSG'].includes(step.type)) {
                console.log(`⚠️ אזהרה: "${step.message}".`);
                try {
                    step = await step.proc.inputFields(1, {}); 
                    console.log("   -> עבר (Enter)");
                } catch (e1) {
                    try {
                        step = await step.proc.warning(1);
                        console.log("   -> עבר (warning)");
                    } catch (e2) {
                        try { step = await step.proc.message(1); } catch(e) {}
                    }
                }
            }
        }

        // 3.  פתיחת פרוצדורה אישור התאמות גורף
        step = await priority.procStart('CLOSECREDITRECONSP', 'P', null);
        console.log("פרוצדורת אישור התאמות גורף נפתחה. סטטוס:", step.type);
        stepsCounter = 0;

        while (step.type !== 'menu' && step.type !== 'end' && stepsCounter < 100) {
            stepsCounter++;
            console.log(`>> צעד ${stepsCounter} | סוג: ${step.type}`);

            let messages = [];
            if (step.proc && step.proc.message) {
                messages = step.proc.message; // לפעמים ההודעות כאן
            } 
            // לפעמים ההודעה נמצאת בגוף הצעד עצמו כתלות בגרסה
            if (step.message) {
                messages = step.message;
            }

            if (messages){
                console.log(messages);
            }

            if (['warning', 'message', 'WRNMSG'].includes(step.type)) {
                console.log(`⚠️ אזהרה: "${step.message}".`);
                try {
                    step = await step.proc.inputFields(1, {}); 
                    console.log("   -> עבר (Enter)");
                } catch (e1) {
                    try {
                        step = await step.proc.warning(1);
                        console.log("   -> עבר (warning)");
                    } catch (e2) {
                        try { step = await step.proc.message(1); } catch(e) {}
                    }
                }
            }
        }

        // התנתקות
        try { await priority.logout(); } catch(e) {}

        console.log("✅ סיום בהצלחה!");

        return res.json({ 
            status: "success", 
            stepType: "התאמה",
            messages: "עדכון בוצע בהצלחה" 
        });

    } catch (error) {
        console.error("❌ שגיאה:", error); // מדפיס את כל האובייקט שגיאה
        return res.status(500).json({ 
            status: "error", 
            message: error.message || "שגיאה בביצוע הפרוצדורה" 
        });
    }
});

// -----   פונקציה ללמידה של המערכת מהתאמות שביצע המשתמש   ------
app.post('/api/get-bank-Reconciliation', async (req, res) => {
    
	// --- הוספת אבטחה: בדיקת מפתח סודי ---
    const mySecret = "MY_SUPER_SECRET_PASSWORD_123"; // סיסמה שרק את ו-Make יודעים
    const providedKey = req.headers['x-api-key']; // Make ישלח את זה בכותרת

    if (providedKey !== mySecret) {
        return res.status(401).json({ error: "Access Denied: Wrong Password" });
    }
    // ------------------------------------

    const line = req.body.line; 
    const bankpage = req.body.bankpage; 
    const bankcode = req.body.bankcode; 
    const accountingcode = req.body.accountingcode;     
    const customerid = req.body.customerid; 
    const axios = require('axios');
   
    if (!line) {
        return res.status(400).send({ error: "חובה לשלוח מזהה שורה (line)" });
    }

    if (!bankpage) {
        return res.status(400).send({ error: "חובה לשלוח מזהה דף בנק (bankpage)" });
    }

     if (!bankcode) {
        return res.status(400).send({ error: "חובה לשלוח מזהה קוד חשבון בנק (bankcode)" });
    }

    if (!accountingcode) {
        return res.status(400).send({ error: "חובה לשלוח מזהה מספר חשבון בנק בהנהלת חשבונות (accountingcode)" });
    }

    if (!customerid) {
        return res.status(400).send({ error: "חובה לשלוח מזהה לקוח (accountingcode)" });
    }

    fillConfig(req);

    const userpassword = config.username + ':' + config.password
    const headers = {
        'Authorization': 'Basic ' + Buffer.from(userpassword).toString('base64'),
        'Content-Type': 'application/json'
    };

    let params = {"$filter": ""};    
    const baseURL = config.url + '/' + config.virtualApiUrl + '/' + config.tabulaini + '/' + config.company    
    let formname = "";    
    
    // Get ERECONNUM by bankpage and line
    let ereconnum = 0;
    try {    
            console.log(`-------------------------------------------`);
            console.log(`קבלת מספר התאמה`);

            params = {
                "$filter": "BANKPAGE eq " + bankpage + " AND KLINE eq " + line
            };
            formname = '/BANKLINESA' ;

            response = await axios.get(baseURL + formname, { headers, params});

            ereconnum = response.data.value[0].ERECONNUM ;

            console.log(`התקבל מספר משתמש לפי שם משתמש: ${ereconnum}`);

            if (ereconnum === 0){
                return res.json({ 
                status: "success", 
                stepType: "התאמה",
                messages: "אין מספר התאמה" 
                });
            }
        } catch (error) {
            console.log(`נכשלה קבלת מספר משתמש לפי שם משתמש`);
            return res.status(500).json({ 
            status: "error", 
            message: "נכשלה קבלת מספר משתמש לפי שם משתמש" + error.message
            });
        }

    // Get record from finances log by ERECONNUM    
    try {    
            console.log(`-------------------------------------------`);
            console.log(`קבלת רשומות מלוג תנועות יומן`);

            params = {
                "$filter": "ERECONNUM eq " + ereconnum + " AND ACCNAME eq '" + accountingcode + "'"
            };
            formname = '/FNCLOG' ;

            response = await axios.get(baseURL + formname, { headers, params});

            if (response.data.value.length === 1){
                const iAccountName = response.data.value[0].IACCNAME ;
                if (iAccountName === customerid) {
                    return res.json({ 
                    status: "success", 
                    stepType: "התאמה",
                    messages: customerid
                    });
                // Get from List of financial certificates
                } else {
                    const referenceNo = response.data.value[0].IVNUM ;
                    params = {
                        "$filter": "IVNUM  eq " + referenceNo 
                    };
                    formname = '/GENINVOICES' ;

                    response = await axios.get(baseURL + formname, { headers, params});

                    if (response.data.value.length === 0){
                        return res.json({ 
                        status: "success", 
                        stepType: "התאמה",
                        messages: "NC"
                        });

                    } else {
                        if (response.data.value[0].IVDES === "קבלות") {
                            return res.json({ 
                            status: "success", 
                            stepType: "התאמה",
                            messages: iAccountName
                            });
                        } else {
                            return res.json({ 
                            status: "success", 
                            stepType: "התאמה",
                            messages: "NC"
                            });
                        }
                    }
                }
                
            } else {
                return res.json({ 
                    status: "success", 
                    stepType: "התאמה",
                    messages: "NC"
                    });
            }

        } catch (error) {
            console.log(`נכשלה קבלת מספר משתמש לפי שם משתמש`);
            return res.status(500).json({ 
            status: "error", 
            message: "נכשלה קבלת מספר משתמש לפי שם משתמש" + error.message
            });
        }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});