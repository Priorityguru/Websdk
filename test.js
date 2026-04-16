// קוד הבדיקה המעודכן שלך
fetch('http://localhost:3000/api/close-tiv', {
    method: 'POST',
    headers: { 
        'Content-Type': 'application/json',
        'x-api-key': '*Bank_AI@2026&' // המפתח שהגדרת בשרת
    },
    body: JSON.stringify({
        // נתוני ההתחברות לסביבת הפריוריטי הספציפית
        priorityUrl: 'https://host6013.priority-guru.co.il', 
        company: 'demo',
        username: 'TEST',
        password: 'fuko560',
        
        // הפרמטר של הפרוצדורה
        ivNum: 6343 
    })
})
.then(res => res.json())
.then(data => {
    if (data.status === "error") {
        console.error("שגיאה מהשרת:", data.message);
    } else {
        console.log("הצלחה! תשובה מהשרת:", data);
    }
})
.catch(err => console.error("תקלה בתקשורת:", err));