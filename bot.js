require("dotenv").config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// Retrieve the token
const token = process.env.TL_BOT_TOKEN;
const youtubeApiKey = process.env.YOUTUBE_API_KEY;

// Create a bot using 'polling' to fetch new updates
const bot = new TelegramBot(token, { polling: true });

//Store language settings
let userPreferences = {};
function initiateInteraction(chatId) {
  sendSearchOptions(chatId);
  // if (!userPreferences[chatId]?.language) {
  //   const welcomeMessage = "Hello, it’s Pasteur. which language would you like us to speak?";
  //   const options = {
  //     reply_markup: JSON.stringify({
  //       inline_keyboard: [
  //         [{ text: 'English', callback_data: 'language_english' }],
  //         [{ text: '中文', callback_data: 'language_chinese' }],
  //         [{ text: 'Tiếng Việt', callback_data: 'language_vietnamese' }]
  //       ]
  //     })
  //   };
  //   bot.sendMessage(chatId, welcomeMessage, options);
  // } else {
  //   sendSearchOptions(chatId);
  // }
}

// Define greetings
const greetings = ["hi", "hello", "你好", "chào", "play", "music", "menu"];

function setUserLanguage(userId, languageCode) {
  let language;
  switch (languageCode) {
    case 'english':
      language = 'english';
      break;
    case 'chinese':
      language = 'chinese';
      break;
    case 'vietnamese':
      language = 'vietnamese';
      break;
    default:
      language = 'english';
  }
  userPreferences[userId] = { language: language, state: null };
  // sendSearchOptions(userId);
}
function getUserLanguage(userId) {
  const language = userPreferences[userId]?.language;
  return ['english', 'chinese', 'vietnamese'].includes(language) ? language : 'english';
}

function getResponse(userId, key) {
  const language = getUserLanguage(userId);
  return responses[language][key];
}

const responses = {
  english: {
    searchOptions: "Tell Pasteur how you want to search for music:",
    genrePrompt: "What genre are you interested in?",
    titlePrompt: "What's the title of the song?",
    artistPrompt: "Who's the artist?",
    moodPrompt: "Well, how do you feel?",
    unknownCommand: "Sorry, I didn't understand that."
  },
  chinese: {
    searchOptions: "告诉Pasteur你想如何搜索音乐呢:",
    genrePrompt: "您感兴趣的音乐类型是什么？",
    titlePrompt: "歌曲的标题是什么？",
    artistPrompt: "艺术家是谁？",
    moodPrompt: "您现在的心情如何？",
    unknownCommand: "不好意思 不太明白你要什么呢？"
  },
  vietnamese: {
    searchOptions: "Cùng Pasteur tìm nhạc theo cách của bạn:",
    genrePrompt: "Thể loại nhạc bạn chọn là gì?",
    titlePrompt: "Mời chọn tên bài hát?",
    artistPrompt: "MỜi chọn ca sỹ?",
    moodPrompt: "Bạn cảm thấy thế nào?",
    unknownCommand: "Xin lỗi, bạn cần tìm kiếm bài hát nào."
  }
};

function sendSearchOptions(chatId) {
  const searchOptionsMessage = getResponse(chatId, 'searchOptions');
  const options = {
    reply_markup: JSON.stringify({
      inline_keyboard: [
        [{ text: 'Search by genre', callback_data: 'search_by_genre' }],
        [{ text: 'Search by title', callback_data: 'search_by_title' }],
        [{ text: 'Search by artist', callback_data: 'search_by_artist' }],
        [{ text: 'Search by mood', callback_data: 'search_by_mood' }]
      ]
    })
  };
  bot.sendMessage(chatId, searchOptionsMessage, options);
}

bot.on('callback_query', (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  // Update the user state in userPreferences
  userPreferences[chatId] = { ...userPreferences[chatId], state: data };

  // Handle language selection from inline keyboard
  if (data.startsWith('language_')) {
    const selectedLanguage = data.split('_')[1];
    setUserLanguage(chatId, selectedLanguage);
    sendSearchOptions(chatId);
    return;
  }

  // Handle the callback data
  switch (data) {
    case 'search_by_genre':
      bot.sendMessage(chatId, getResponse(chatId, 'genrePrompt'));
      break;
    case 'search_by_title':
      bot.sendMessage(chatId, getResponse(chatId, 'titlePrompt'));
      break;
    case 'search_by_artist':
      bot.sendMessage(chatId, getResponse(chatId, 'artistPrompt'));
      break;
    case 'search_by_mood':
      bot.sendMessage(chatId, getResponse(chatId, 'moodPrompt'));
      break;
    default:
      bot.sendMessage(chatId, getResponse(chatId, 'unknownCommand'));
  }
});


bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  initiateInteraction(chatId);
});

bot.on('message', (msg) => {
  const chatId = msg.chat.id;

  if (msg.text.startsWith('/')) {
    return;
  }

  // Skip if it's a response to a search option
  if (userPreferences[chatId]?.state) {
    const query = msg.text.trim();
    searchYouTube(userPreferences[chatId].state + ' ' + query, chatId);
    userPreferences[chatId].state = null;
    return;
  }

  // Handle greetings with an inline keyboard for language selection
  if (greetings.includes(msg.text.toLowerCase())) {
    initiateInteraction(chatId);
  }

});

function searchYouTube(query, chatId) {
  const musicCategoryId = "10";
  const regionCode = "IN";

  const youtubeApiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&regionCode=${regionCode}&type=video&videoCategoryId=${musicCategoryId}&q=${encodeURIComponent(query)}&maxResults=5&key=${youtubeApiKey}`;

  axios.get(youtubeApiUrl)
    .then(response => {
      if (response.data.items.length > 0) {
        let message = "Here is your list:\n";
        response.data.items.forEach((item, index) => {
          message += `${index + 1}. ${item.snippet.title}, ${item.snippet.channelTitle}. [YouTube Link](https://www.youtube.com/watch?v=${item.id.videoId})\n`;
        });
        bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      } else {
        bot.sendMessage(chatId, 'No music videos found.');
      }
    })
    .catch(error => {
      console.error('Error fetching YouTube data:', error);
      bot.sendMessage(chatId, 'Error searching YouTube.');
    });
}
