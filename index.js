require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = './users.json';

const Adsterra = require('./adsterra.js')

// Access the token and API key from environment variables
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;                               console.log(TELEGRAM_TOKEN);                        

// Adsterra API endpoint
const ADSTERRA_API_URL = 'https://api3.adsterratools.com/publisher/stats.json'; 

// Create a bot instance
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });




// Load the user data from the JSON file
let users = {};

// Read the file and load existing users (if the file exists)
if (fs.existsSync(path)) {
  users = JSON.parse(fs.readFileSync(path, 'utf8'));
}

// Function to save the API key
function saveUserApiKey(userId, apiKey, user) {
  users[userId] = {user, apiKey };

  // Save the updated users object to the JSON file
  fs.writeFileSync(path, JSON.stringify(users, null, 2), 'utf8');
}
// Use the user's API key when needed
function getUserApiKey(userId) {
  return users[userId]?.apiKey || null;
}

function hasApi(userId) {
  return getUserApiKey(userId) != null
}



// Handle the /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  console.log('user has api: ', hasApi(msg.from.id))
  
  if(hasApi(msg.from.id)) {
    bot.sendMessage(chatId, "Welcome to Adsterra Statistics Bot!\nPlease interact with button below.");
    showMainMenu(chatId) 
  } else {
    bot.sendMessage(chatId, "Welcome to Adsterra Statistics Bot!\nPlease set up your Adsterra API key to get started. Send your API key to continue:", showGuestMenu());
  }
  
 
    
});

bot.onText(/\/setup_api/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const opts = {
    reply_markup: {
      inline_keyboard: [[{ text: 'go to adsterra', callback_data: 'setup_api_key'}]]
    }
  }
  const opts_api = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Edit', callback_data: 'edit_api_key' },
          { text: 'Delete', callback_data: 'delete_api_key' },
        ]
      ]
    }
  };

  // Ask the user for their API key
  if(hasApi(userId)) {

    bot.sendMessage(chatId, `Your Api Key\n *${getUserApiKey(userId)}*`, opts_api );

  } else {

      bot.sendMessage(chatId, "Please Enter Your API KEY ?");
      // Set up a listener to capture the next message as the API key
      bot.once("message", async (msg) => {
        const apiKey = msg.text.trim();
        
        // Define a regex pattern for validating the API key (example regex, adjust as necessary)
        const apiKeyRegex = /^[a-f0-9]{32}$/; // Assuming the API key is a 32-character alphanumeric string

        if (apiKeyRegex.test(apiKey)) {

            const testing_progress_message = await bot.sendMessage(chatId, '👀 Testing API on Adsterra Server...')
            const test_api_status = await Adsterra.testAPi_status_code(apiKey);

            if(test_api_status === 200) {
              // Save the API key
              saveUserApiKey(userId, apiKey, msg.from);
              await bot.editMessageText('✅ Status Code 200 ✅', {
                chat_id: chatId,
                message_id: testing_progress_message.message_id
              })

              // Send success message
              bot.sendMessage(chatId, "API key successfully integrated!", showMainMenu());
            } else {
              await bot.editMessageText('❌ Bad Status Code Detected! ❌', {
                chat_id: chatId,
                message_id: testing_progress_message.message_id
              })
              // Send success message
              bot.sendMessage(chatId, "something went wrong!", showGuestMenu());
            }

          

        } else {
          // API key is invalid, prompt the user to try again
          bot.sendMessage(chatId, "Invalid API key. Please enter a valid key.\nfor /setup_api correctly.");
        }
      });
  }
  


})

// Function to make Adsterra API request
const getAdsterraStats = async (startDate, endDate, groupBy = 'date', apiKey) => {
  console.log('calling getAdsterraStats(): api=', apiKey)
  try {
    const params = {
      start_date: startDate,
      finish_date: endDate,
      group_by: groupBy,
    };
    

    const options = {
      method: 'GET',
      url: ADSTERRA_API_URL,
      timeout: 5000, // Set timeout to 5 seconds
      params: params,
      headers: {
        'Accept': 'application/json',
        'X-API-Key': apiKey,
      }
    };

    const response = await axios.request(options);
    console.log('getAdsterraStats(): response=', response.data)
    return response.data;
  } catch (error) {
    console.error('Error fetching data from Adsterra:', error);
    return 'Failed to retrieve data';
  }
};

// Fetch Adsterra stats based on the date range
async function fetchAdsterraStats(startDate, endDate, groupBy, apiKey) {
    const statsResponse = await getAdsterraStats(startDate, endDate, groupBy, apiKey);
    const statistics = statsResponse?.items || []
    
     let message = `\n\n`;
  
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalcpm = 0;
    let totalRevenue = 0;
  
    if(statistics.lentgh===0) return "No Data"

    statistics.forEach(item => {
      totalImpressions += item.impression;
      totalClicks += item.clicks;
      totalcpm += item.cpm;
      totalRevenue += item.revenue;
      message += `\nImpressions: ${item.impression}\nCpm: ${item.cpm}\nClicks: ${item.clicks}\nRevenue: $${item.revenue.toFixed(2)}\n\n`;
    });
  
    message += `Total Impressions: ${totalImpressions}\nCpm: ${totalcpm}\nTotal Clicks: ${totalClicks}\nTotal Revenue: $${totalRevenue.toFixed(2)}`;
  
   return message
  }

  
bot.onText(/Websites/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if(!hasApi(userId)) return

    // Send the loading message and store the message ID
    const loadingMessage = await bot.sendMessage(chatId, '🔎 Searching...');

    const opts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Last 7 Days', callback_data: 'stats_7days' },
              { text: 'Last 30 Days', callback_data: 'stats_30days' },
            ],
            [
              { text: 'Custom Range', callback_data: 'stats_custom' }
            ]
          ]
        }
      };

    const apiKey = getUserApiKey(userId);
    const websites = await Adsterra.fetchWebsites(apiKey);
    
    
    await bot.editMessageText(websites, {
        chat_id: chatId,
        message_id: loadingMessage.message_id
      });
})

bot.onText(/Direct Links/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if(!hasApi(userId)) return

    // Send the loading message and store the message ID
    const loadingMessage = await bot.sendMessage(chatId, '🔎 Searching...');

    const apiKey = getUserApiKey(userId);
    const direct_links = await Adsterra.fetchDirectLinks(apiKey);

    await bot.editMessageText(direct_links, {
        chat_id: chatId,
        message_id: loadingMessage.message_id
      });
    // bot.sendMessage(chatId, direct_links)
})

// Handle the /stats command to get Adsterra earnings
bot.onText(/Statistics/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if(!hasApi(userId)) return;

  // First inline keyboard for date ranges
  const dateRangeKeyboard = {
      reply_markup: {
          inline_keyboard: [
              [{ text: 'Today', callback_data: 'stats_today' }, { text: 'Yesterday', callback_data: 'stats_yesterday' }],
              [{ text: 'Last 7 days', callback_data: 'stats_last_7_days' }, { text: 'Last 10 days', callback_data: 'stats_last_10_days' }],
              [{ text: 'Last 30 days', callback_data: 'stats_last_30_days' }],
              [{ text: 'This Month', callback_data: 'stats_this_month' }]
          ]
      }
  };

  bot.sendMessage(chatId, "Please select a date range:", dateRangeKeyboard);
});

// Handle Balance Command 
bot.onText(/Balance/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if(!hasApi(userId)) return;

  bot.sendMessage(chatId, 'Comming Soon...');
})


// Simple in-memory store for user selections
let userSelections = {};

// Handle date range selection and replace with group_by options
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const userId = chatId;
  const selectedData = query.data;
  console.log('chatId: ', chatId)
  console.log('messageId: ', messageId)
  console.log('selectedData: ', selectedData)

      // Handle callback for setup_api command
      if (selectedData === 'edit_api_key') {
        bot.editMessageText('Please provide a new API key:', {
            chat_id: chatId,
            message_id: messageId
        });

        // You can collect the new API key after this
    } else if (selectedData === 'delete_api_key') {
        const delete_api_confirmations = { reply_markup: { 
          inline_keyboard: [
            [ { text: 'Yes', callback_data: 'yes'}, { text: 'No', callback_data: 'no' } ]
          ] } }
        bot.editMessageText('🤨 Are you sure you want to delete?', {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: delete_api_confirmations.reply_markup
        });

        // Perform the actual key deletion logic here
    }

       // Handle callback for statistics command
    else if (selectedData.startsWith('stats_')) {
      let selectedRange;
      console.log('seleted data start with stats_')

      switch (selectedData) {
          case 'stats_today':
              selectedRange = 'Today';
              break;
          case 'stats_yesterday':
              selectedRange = 'Yesterday';
              break;
          case 'stats_last_7_days':
              selectedRange = 'Last 7 Days';
              break;
          case 'stats_last_10_days':
            selectedRange = 'Last 10 Days';
            break;
          case 'stats_last_30_days':
            selectedRange = 'Last 30 Days';
            break;
          case 'stats_this_month':
            selectedRange = 'This Month';
            break;
      }

      console.log('date range function', getDateRange(selectedData));
      userSelections[chatId+messageId] = getDateRange(selectedData);

      bot.editMessageText(`You selected: ${selectedRange}. Now select group by:`, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: {
              inline_keyboard: [
                  [{ text: 'Date', callback_data: 'group_by_date' }, { text: 'Domain', callback_data: 'group_by_domain' }, { text: 'Country', callback_data: 'group_by_country' }]
              ]
          }
      });

      // After the group selection, handle it similarly
   }

  else if (selectedData.startsWith('group_by')) {
    const selectedGroupBy = selectedData.split('_')[2];  // Extract group_by value
    const {startDate, finishDate} = userSelections[chatId+messageId];
    const apiKey = getUserApiKey(userId);
    bot.editMessageText('Loading.....', {chat_id:chatId, message_id:messageId})

    const statistics = await fetchAdsterraStats(startDate, finishDate, selectedGroupBy, apiKey);
    console.log(statistics)
    console.log('________ group_by_ ')
    console.log('user selection ', userSelections)
    console.log('group by ',selectedGroupBy)

    bot.editMessageText("Your Statistics:\n"+startDate+" to "+finishDate+" Group by: "+ selectedGroupBy + `\n
      ${statistics} 
      `, {
      chat_id: chatId,
      message_id: messageId
    })
   }


});

// Helper function to determine start_date and finish_date based on the selected date range
function getDateRange(selectedDateRange) {
  const today = new Date();
  let startDate, finishDate;

  switch (selectedDateRange) {
      case 'stats_today':
          startDate = finishDate = formatDate(today);
          break;
      case 'stats_yesterday':
          const yesterday = new Date(today);
          yesterday.setDate(today.getDate() - 1);
          startDate = finishDate = formatDate(yesterday);
          break;
      case 'stats_last_7_days':
          finishDate = formatDate(today);
          const last7Days = new Date(today);
          last7Days.setDate(today.getDate() - 7);
          startDate = formatDate(last7Days);
          break;
      case 'stats_last_10_days':
          finishDate = formatDate(today);
          const last10Days = new Date(today);
          last10Days.setDate(today.getDate() - 10);
          startDate = formatDate(last10Days);
          break;
      case 'stats_last_30_days':
          finishDate = formatDate(today);
          const last30Days = new Date(today);
          last30Days.setDate(today.getDate() - 30);
          startDate = formatDate(last30Days);
          break;
      case 'stats_this_month':
          startDate = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-01`;
          finishDate = formatDate(today);
          break;
  }

  return { startDate, finishDate };
}

// Helper function to format date as YYYY-MM-DD
function formatDate(date) {
  return date.toISOString().split('T')[0];
}



// Define the /dev_info command to show developer information
bot.onText(/\/developer_info/, (msg) => {
  const chatId = msg.chat.id;

  const devInfo = `
  *Info*
  
  *Bot Name*: Adsterra Statistics
  *Developer*: Jahid Hasan
  *About*: This bot helps you track Adsterra statistics and manage your account efficiently.
  
  *Key Features*:
  - Fetch statistics for your Adsterra account
  - View direct links and websites
  - Set up your Adsterra API for personalized data
  
  *Contact*: [jahidorjahid@gmail.com](mailto:jahidorjahid@gmail.com)
  *Telegram*: [Jahid Hasan](https://t.me/jahidorjahid)
  *Version*: 1.0.0
  *Source Code*: [GitHub Repository](https://github.com/jahidorjahid)
  *Last Updated*: 10 October 2024
  `;

  // Send the developer info to the user
  bot.sendMessage(chatId, devInfo, { parse_mode: "Markdown" });
});




// Function to show the main menu with buttons
function showMainMenu(chatId) {
  const options = {
    reply_markup: {
      keyboard: [
        [{text: "📊 Statistics"}],
        [{text: "🔗 Direct Links"}, {text: "🌐 Websites"}],
        [{text: "💰 Balance"}]
      ],
      one_time_keyboard: false, // Keep the keyboard open
      resize_keyboard: true // Adjust keyboard size for convenience
    }
  };

  return options
}

function showGuestMenu() {
  const options = {
    reply_markup: {
      keyboard: [["/setup_api"]],
      one_time_keyboard: false,
      resize_keyboard: true
    }
  }
  return options
}