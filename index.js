const bcrypt = require('bcrypt');
const saltrate = 10;


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

const { promisify } = require('util');
const queryAsync = promisify(pool.query).bind(pool);

const logged_in_users = {};
const admins = [1292731256];

var keyboards = {
	main_menu: {
		reply_markup: {
			keyboard: [ ["Создать обращение"], ["Список обращений"], ["Выйти из системы"] ]
		}
	},
	retry_menu: {
		reply_markup: {
			keyboard: [ ["Зарегистрироваться"], ["Попытаться еще раз"] ]
		}
	},
	start_menu: {
		reply_markup: {
			keyboard: [ ["Зарегистрироваться"], ["Войти"] ]
		}
	},
};

/*bot.onText(/\/start/i, async (msg) => {
	const rows = await queryAsync("SELECT * FROM users WHERE chatId=?", [msg.chat.id]);
	if (rows.length === 0) return bot.sendMessage(msg.chat.id, "Здравствуйте! Вас приветствует бот Клиентская рассылка. Вы не зарегистрированы. Пожалуйста, выберите нужный пункт меню.",
	keyboards.reg_menu);
	const userData = rows[0];
	logged_in_users[msg.chat.id] = userData.id;
	if (userData.isOnline === 0) return bot.sendMessage(msg.chat.id, `Здравствуйте, ${userData.name[0]}. ${userData.patronymic[0]}. ${userData.surname}! Вы зарегистрированы, но не вошли в систему.`,
	keyboards.login_menu);
	bot.sendMessage(msg.chat.id, `Здравствуйте, ${userData.name[0]}. ${userData.patronymic[0]}. ${userData.surname}! Выберите нужный пункт меню.`,
	keyboards.main_menu);
});*/

bot.onText(/\/start/i, async (msg) => {
	const rows = await queryAsync("SELECT * FROM users WHERE chatId=?", [msg.chat.id]);
	if (rows.length === 0) return bot.sendMessage(msg.chat.id, "Здравствуйте! Вас приветствует бот Клиентская рассылка. Пожалуйста, выберите нужный пункт меню.",
	keyboards.start_menu);
	const userData = rows[0];
	logged_in_users[msg.chat.id] = userData.id;
	if (userData.isOnline === 0) return bot.sendMessage(msg.chat.id, `Здравствуйте, ${userData.name[0]}. ${userData.patronymic[0]}. ${userData.surname}! Вы зарегистрированы, но не вошли в систему.`,
	keyboards.start_menu);
	bot.sendMessage(msg.chat.id, `Здравствуйте, ${userData.name[0]}. ${userData.patronymic[0]}. ${userData.surname}! Выберите нужный пункт меню.`,
	keyboards.main_menu);
});

const finduserhandle = async (msg) => {
	const rows = await queryAsync("SELECT * FROM users WHERE chatId=?", [msg.chat.id]);
	const userData = rows[0];
	if (rows.length > 0 && userData.isOnline === 0) {		
		const pswrdenter = await bot.sendMessage(msg.chat.id, "Введите пароль.", {
			reply_markup: {
				force_reply: true,
			},
		});
		bot.onReplyToMessage(msg.chat.id, pswrdenter.message_id, async (pswrdMsg) => {
			const pswrd = pswrdMsg.text;
			const hashedpswrd = userData.password;
			
			bcrypt.compare(pswrd, hashedpswrd, function (err, res) {
				if (err) {
					bot.sendMessage(admins[0], "User " + userData.id + " encountered an issue during login.\nMsg chat id: "
					+ msg.chat.id + "\nErr msg: " + err);
					return bot.sendMessage(msg.chat.id, "Возникла ошибка. Попробуйте позже.");
				};
				if (!res) return bot.sendMessage(msg.chat.id, "Неверный пароль.");
				logged_in_users[msg.chat.id] = userData.id;
				queryAsync("UPDATE users SET isOnline=1 WHERE id=?", [userData.id]);
				bot.sendMessage(msg.chat.id, `Добро пожаловать в систему, ${userData.name[0]}. ${userData.patronymic[0]}. ${userData.surname}.`,
				keyboards.main_menu);
			});
		});
	} else {
		const id = await bot.sendMessage(msg.chat.id, "Напишите, пожалуйста, ваш ID", {
			reply_markup: {
				force_reply: true,
			},
		});
		bot.onReplyToMessage(msg.chat.id, id.message_id, async (idMsg) => {
			const id = idMsg.text;
			pool.query("SELECT * FROM users WHERE id=?", [id], async (err, data) => {
				if (err) return bot.sendMessage(msg.chat.id, "Возникла ошибка во время поиска. Пожалуйста, проверьте правильность ввода данных.");
				if (data.length === 0) return bot.sendMessage(msg.chat.id, "Такого пользователя не существует."
				+ " Желаете ли зарегистрироваться или попытаться еще раз?",
				keyboards.retry_menu);
				bot.sendMessage(msg.chat.id, "Пользователь обнаружен.");
				
				const userData = data[0];
				
				const pswrdenter = await bot.sendMessage(msg.chat.id, "Введите пароль.", {
					reply_markup: {
						force_reply: true,
					},
				});
				bot.onReplyToMessage(msg.chat.id, pswrdenter.message_id, async (pswrdMsg) => {
					const pswrd = pswrdMsg.text;
					const hashedpswrd = userData.password;
					
					bcrypt.compare(pswrd, hashedpswrd, function (err, res) {
						if (err) {
							bot.sendMessage(admins[0], "User " + userData.id + " encountered an issue during login.\nMsg chat id: "
							+ msg.chat.id + "\nErr msg: " + err);
							return bot.sendMessage(msg.chat.id, "Возникла ошибка. Попробуйте позже.");
						};
						if (!res) return bot.sendMessage(msg.chat.id, "Неверный пароль.");
						logged_in_users[msg.chat.id] = userData.id;
						pool.query("UPDATE users SET chatId=?, isOnline=1 WHERE id=?", [msg.chat.id, userData.id]);
						bot.sendMessage(msg.chat.id, `Добро пожаловать в систему, ${userData.name[0]}. ${userData.patronymic[0]}. ${userData.surname}.`,
						keyboards.main_menu);
					});
				});
			});
		});
	};
};

bot.onText(/\Войти/i, (msg) => finduserhandle(msg));
bot.onText(/\Попытаться еще раз/i, (msg) => finduserhandle(msg));

bot.onText(/\Зарегистрироваться/i, async (msg) => {
	const reg = await bot.sendMessage(msg.chat.id, "\nУкажите, пожалуйста, ваше ФИО, дату рождения \\(ДД\\.ММ\\.ГГГГ\\) и пол \\(М/Ж\\) и пароль\\."
	+ "\nНапример, `Иванов Иван Иванович 01.01.1970 М coolpassword`", {
		reply_markup: {
			force_reply: true,
		},
		parse_mode: "MarkdownV2"
	});
	bot.onReplyToMessage(msg.chat.id, reg.message_id, async (nameMsg) => {
		const lines = nameMsg.text.split(' ');
		const formattedtext = lines.join('\n');
		const array = formattedtext.split('\n').map(String);
		const surname = array[0], name = array[1], patronymic = array[2],
		dob = array[3].split('.').reverse().join('-'),
		sex = array[4], pswrd = array[5];
		
		bcrypt.hash(pswrd, saltrate, function (err, hashedpswrd) {
			if (err) return console.log("Error hashing password: ", err);
			pool.query("INSERT INTO users(`surname`, `name`, `patronymic`, `dob`, `sex`, `password`, `chatId`, `isOnline`) VALUES (?, ?, ?, ?, ?, ?, ?, 1)",
						[surname, name, patronymic, dob, sex, hashedpswrd, msg.chat.id], function (err, data) {
				if (err) {
					bot.sendMessage(admins[0], "User " + userData.id + " encountered an issue during registration.\nMsg chat id: "
					+ msg.chat.id + "\nErr msg: " + err);
					return bot.sendMessage(msg.chat.id, "Возникла ошибка при регистрации. Проверьте правильность ввода данных, попробуйте позже или обратитесь в тех. поддержку если ошибка остается.");
				};
				pool.query("UPDATE users SET isOnline=1 WHERE chatId=?", [msg.chat.id]);
				bot.sendMessage(msg.chat.id, `Регистрация прошла успешно! Добро пожаловать в систему, ${name[0]}. ${patronymic[0]}. ${surname}.`, keyboards.main_menu);
			});
		});
	});
});

bot.onText(/\Создать обращение/i, (msg) => {
	console.log("haha");
});

bot.onText(/\Список обращений/i, (msg) => {
	console.log("haha");
});

bot.onText(/\Выйти из системы/i, async (msg) => {
	await queryAsync("UPDATE users SET isOnline=0 WHERE chatId=?", [msg.chat.id]);
	delete logged_in_users[msg.chat.id];
	await bot.sendMessage(msg.chat.id, "Вы успешно вышли из системы.", keyboards.start_menu);
});

//admin

bot.onText(/\broadcast (.+)/i, async (msg, match) => {
	if (!admins.include(msg.chat.id)) return bot.sendMessage(msg.chat.id, "Вы не являетесь администратором системы", keyboards.main_menu);
	
	const message = match[1];
	console.log("haha");
});

process.on('SIGINT', async () => {
	console.log("mldb DISCONNECTING");
	process.exit(0);
});