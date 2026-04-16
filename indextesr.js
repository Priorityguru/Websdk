process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // עוקף את בעיית נטפרי

const express = require('express');
const axios = require('axios'); // ספרייה לביצוע בקשות HTTP (כמו פוסטמן)

const app = express();
app.use(express.json());

// --- ההגדרות שלך ---
// הכתובת שעובדת לך בפוסטמן (בלי ה-tabula.ini/demo בסוף, נוסיף אותם בקוד)
const BASE_URL = 'https://host6013.priority-guru.co.il/odata/Priority/tabula.ini/demo';
const USERNAME = 'TEST';
const PASSWORD = 'fuko560';

app.post('/api/close-tiv', async (req, res) => {
    const ivNum = req.body.ivNum;

    if (!ivNum) {
        return res.status(400).send({ error: "חובה לשלוח מספר (ivNum)" });
    }

    console.log(`מנסה להפעיל פרוצדורה עבור: ${ivNum} דרך OData...`);

    try {
        // ב-OData, הרצת פרוצדורה נעשית בדרך כלל דרך "Action" או עדכון שדה.
        // מכיוון שאנחנו לא יודעים איך הפרוצדורה חשופה ב-OData אצלך,
        // אני אכתוב כאן קוד שמנסה להפעיל אותה בצורה הסטנדרטית של Priority OData.
        
        // הערה: יש לוודא ששם הפרוצדורה (CLOSETIV) מופיע בתוך מסך "ממשק לתוכניות חיצוניות" בפריוריטי
        
        const response = await axios({
            method: 'post',
            url: `${BASE_URL}/CLOSETIV`, // הנחה: שם הפרוצדורה הוא היישות
            headers: {
                'Content-Type': 'application/json',
                // יצירת הכותרת לאימות (Basic Auth)
                'Authorization': 'Basic ' + Buffer.from(USERNAME + ":" + PASSWORD).toString('base64')
            },
            data: {
                // כאן אנחנו שולחים את הפרמטרים.
                // ב-OData שמות השדות חייבים להיות זהים לקלט של הפרוצדורה
                "PAR": ivNum
            }
        });

        console.log("הצלחה!", response.data);
        return res.json({ status: "success", data: response.data });

    } catch (error) {
        // טיפול בשגיאות
        const errorMsg = error.response ? error.response.data : error.message;
        console.error("שגיאה ב-OData:", JSON.stringify(errorMsg, null, 2));
        
        return res.status(500).json({ 
            status: "error", 
            message: "הבקשה נכשלה", 
            details: errorMsg 
        });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});