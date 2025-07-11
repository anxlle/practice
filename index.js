const tgbot = require('node-telegram-bot-api');
const mysql = require('mysql2');

const token = '8030698838:AAHz2It07gElG8p4aG9Vk5pv6sOQ2MKIkGc';
const bot = new tgbot(token, {polling: true});

const pool = mysql.createPool({
	host: "localhost",
	user: "root",
	database: "mldb",
	password: ""
});

bot.onText(/\/start/i, async (msg) => {
	const data = await bot.sendMessage(msg.chat.id, "Здравствуйте\\! Для начала работы необходимо зарегистрироваться\\."
	+ "\nУкажите, пожалуйста, ваше ФИО, дату рождения \\(ДД\\.ММ\\.ГГГГ\\) и пол \\(М/Ж\\)\\."
	+ "\nНапример, `Иванов Иван Иванович 01\\.01\\.1970 М`", {
		reply_markup: {
			force_reply: true,
		},
		parse_mode: "MarkdownV2"
	});
	bot.onReplyToMessage(msg.chat.id, data.message_id, async (nameMsg) => {
		const lines = nameMsg.text.split(' ');
		const formattedtext = lines.join('\n');
		try {
			const array = formattedtext.split('\n').map(String);
			var name = array[0], surname = array[1];
			pool.query("INSERT INTO test VALUES (?, ?)", [name, surname], function (err, data) {
				if (err) return bot.sendMessage(msg.chat.id, "Возникла ошибка при регистрации. Проверьте правильность ввода данных.");
				bot.sendMessage(msg.chat.id, "Регистрация завершена!");
			});
		} catch (err) {
			console.log("Parsing error");
		}
	});
});

process.on('SIGINT', async () => {
	console.log("mldb DISCONNECTING");
	process.exit(0);
});