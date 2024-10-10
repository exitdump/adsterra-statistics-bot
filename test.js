const endDate = new Date().toISOString().split('T')[0]; // Today's date
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7); // 7 days ago
    const formattedStartDate = startDate.toISOString().split('T')[0];

    console.log(formattedStartDate)

    const ad = require('./adsterra.js');

    console.log(ad. name)