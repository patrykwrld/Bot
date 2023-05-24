require('dotenv/config');
const { Client, Collection, Intents } = require('discord.js');
const { OpenAIApi } = require('openai');
const LRU = require('lru-cache');

const client = new Client({
    intents: [
        Intents.FLAGS.Guilds,
        Intents.FLAGS.GuildMessages,
        Intents.FLAGS.MessageContent,
    ]
});

client.commands = new Collection();

const openai = new OpenAIApi({ apiKey: process.env.API_KEY });

// Create a cache for storing responses to frequently asked questions
const responseCache = new LRU({ max: 500 });

client.once('ready', () => {
    console.log("Bot is running!");
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || message.channel.id !== process.env.CHANNEL_ID) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName);

    if (!command) {
        // If the command doesn't exist, generate a response using OpenAI
        await message.channel.sendTyping();

        const conversationLog = [{ role: 'system', content: "You are a friendly Chatbot." }];

        const prevMessages = await message.channel.messages.fetch({ limit: 15 });

        prevMessages
            .filter(msg => !msg.content.startsWith('!') && !msg.author.bot && msg.author.id === message.author.id)
            .forEach(msg => conversationLog.push({ role: 'user', content: msg.content }));

        // Check if the response is in the cache
        const cachedResponse = responseCache.get(message.content);
        let response;

        if (cachedResponse) {
            // Use the cached response if it exists
            response = cachedResponse;
        } else {
            // Otherwise, generate a new response and store it in the cache
            const result = await openai.createChatCompletion({
                model: 'gpt-3.5-turbo',
                messages: conversationLog,
            });

            response = result.data.choices[0].message.content;
            responseCache.set(message.content, response);
        }

        message.reply(response);
    } else {
        // If the command exists, execute it
        try {
            command.execute(message, args);
        } catch (error) {
            console.error(error);
            message.reply('There was an error trying to execute that command!');
        }
    }
});

// Define commands
// ...

client.login(process.env.TOKEN);
