const axios = require('axios');

async function testLocalServer() {
    console.log("מנסה להתחבר לשרת ה-IIS המקומי...");

    try {
        const response = await axios.post('http://localhost:3000/api/close-tiv', {
            // שימי כאן מספר חשבונית אמיתי שקיים אצלך במערכת לבדיקה
            ivNum: "6334" 
        });

        console.log("✅ הצלחה! תשובת השרת:");
        console.log(JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.error("❌ שגיאה:");
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error("Data:", error.response.data);
        } else {
            console.error(error.message);
        }
    }
}

async function testServer_bank() {
    console.log("מנסה להתחבר לשרת ה-IIS המקומי...");

    try {
        const response = await axios.post('http://localhost:3000/api/prep-bank-recorn', {
            "inputs": {
                "CSH": ["1212"],     
                "FNC": "01/01/26",     
                "EXTFILE": ["00"],     
                "TYP": "C",            
                "MC": "",             
                "BTC": "*",            
                "RCD": 42             
            } 
        });

        console.log("✅ הצלחה! תשובת השרת:");
        console.log(JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.error("❌ שגיאה:");
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error("Data:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
    }
}


testServer_bank();
//testLocalServer();