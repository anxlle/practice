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

var keyboards;

bot.onText(/\/start/i, async (msg) => {
	await bot.sendMessage(msg.chat.id, "Здравствуйте! Вас приветствует бот Клиентская рассылка. Пожалуйста, выберите нужный пункт меню.", {
		reply_markup: {
			keyboard: [ ["Найти меня по ID"], ["Зарегистрироваться"] ],
		},
	});
});

const finduserhandle = async (msg) => {
	const id = await bot.sendMessage(msg.chat.id, "Скажите, пожалуйста, ваш ID", {
		reply_markup: {
			force_reply: true,
		},
	});
	bot.onReplyToMessage(msg.chat.id, id.message_id, async (idMsg) => {
		const id = idMsg.text;
		pool.query("SELECT * FROM users WHERE id=?", [id], function (err, data) {
			if (err) return bot.sendMessage(msg.chat.id, "Возникла ошибка во время поиска. Пожалуйста, проверьте правильность ввода данных.");
			if (data.length === 0) return bot.sendMessage(msg.chat.id, "Такого пользователя не существует. Желаете ли зарегистрироваться или попытаться еще раз?", {
				reply_markup: {
					keyboard: [ ["Зарегистрироваться"], ["Попытаться еще раз"] ],
				},
			});
			bot.sendMessage(msg.chat.id, "Здравствуйте!");
		});
	});
};

bot.onText(/\Найти меня по ID/i, (msg) => {
	finduserhandle(msg);
});

bot.onText(/\Попытаться еще раз/i, (msg) => {
	finduserhandle(msg);
});

bot.onText(/\Зарегистрироваться/i, async (msg) => {
	const reg = await bot.sendMessage(msg.chat.id, "\nУкажите, пожалуйста, ваше ФИО, дату рождения \\(ДД\\.ММ\\.ГГГГ\\) и пол \\(М/Ж\\)\\."
	+ "\nНапример, `Иванов Иван Иванович 01.01.1970 М`", {
		reply_markup: {
			force_reply: true,
		},
		parse_mode: "MarkdownV2"
	});
	bot.onReplyToMessage(msg.chat.id, reg.message_id, async (nameMsg) => {
		const lines = nameMsg.text.split(' ');
		const formattedtext = lines.join('\n');
		try {
			const array = formattedtext.split('\n').map(String);
			var surname = array[0], name = array[1], patronymic = array[2], dob = array[3].split('.').reverse().join('-'), sex = array[4];
			pool.query("INSERT INTO users(`surname`, `name`, `patronymic`, `dob`, `sex`) VALUES (?, ?, ?, ?, ?)", [surname, name, patronymic, dob, sex], function (err, data) {
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