const tgbot = require('node-telegram-bot-api');
const mysql = require('mysql2');

const token = '8030698838:AAHz2It07gElG8p4aG9Vk5pv6sOQ2MKIkGc';
const bot = new tgbot(token, {polling: true});

const pool = mysql.createPool({
	//connectionLimit: 5,
	host: "localhost",
	user: "root",
	database: "mldb",
	password: ""
});

bot.onText(/\/start/i, (msg) => {
	bot.sendMessage(msg.chat.id, "Здравствуйте\\! Для начала работы необходимо зарегистрироваться\\."
	+ "\nУкажите, пожалуйста, ваше ФИО, дату рождения \\(ДД\\.ММ\\.ГГГГ\\) и пол \\(М/Ж\\) построчно\\."
	+ "\nНапример, \n`Иванов\nИван\nИванович\n01\\.01\\.1970\nМ`", {parse_mode: "MarkdownV2"});
});

process.on('SIGINT', async () => {
	console.log("mldb DISCONNECTING");
	process.exit(0);
});