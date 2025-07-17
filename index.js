const tgbot = require('node-telegram-bot-api');
const mysql = require('mysql2');

const schedule = require('node-schedule');

const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const token = '8030698838:AAHz2It07gElG8p4aG9Vk5pv6sOQ2MKIkGc';
const bot = new tgbot(token, {polling: true});

const pool = mysql.createPool({
	host: "localhost",
	user: "root",
	database: "cltmldb",
	password: ""
});

const { promisify } = require('util');
const queryAsync = promisify(pool.query).bind(pool);

let admins = [];

async function loadAdmins() {
	const res = await queryAsync("SELECT chatId FROM admins");
	admins = res.map(row => row.chatId);
};

loadAdmins();

setInterval(loadAdmins, 5*60*1000);

bot.onText(/\/start/i, async (msg) => {
	if (admins.includes(msg.chat.id)) {
		const data = await queryAsync("SELECT * FROM admins WHERE chatId=?", [msg.chat.id]);
		return bot.sendMessage(msg.chat.id, `Добро пожаловать, администратор ${data[0].username}!`);
	};
	
	const on = await queryAsync("SELECT * FROM users WHERE chatId=?", [msg.chat.id]);
	if (on.length > 0) return bot.sendMessage(msg.chat.id, "Вы уже зарегистрированы.");
	
	await queryAsync("INSERT IGNORE INTO users (`chatId`, `username`) VALUES (?, ?)", [msg.chat.id, msg.chat.username]);		
	bot.sendMessage(msg.chat.id, "Добро пожаловать! Вы зарегистрированы.");
});

//admin

bot.onText(/\/createbroadcast(.*)/i, async (msg, match) => {
	if (!admins.includes(msg.chat.id)) return bot.sendMessage(msg.chat.id, "Вы не являетесь администратором системы.");
	
	try {
		const args = match[1];
		
		const p = match[1].split('|');
		if (!args || p.length !== 4)
			return bot.sendMessage(msg.chat.id, "Синтаксис: `/createbroadcast message | button1:callback1; button2:callback2 | список получателей | дата и время отправки`"
		+ "\nНапример, `/createbroadcast Hello | Hello:btnHi ; Bye:btnBye | 1-5,7,9 | 2025-07-20 12:00`"
		+ "\nФормат даты и времени: `YYYY-MM-DD hh:mm`"
		+ "\nИспользование `_` в поле `callback` запрещено\\."
		+ "\nОбратите внимание на использование `;` в качестве разделителя кнопок в поле `callback`\\."
		+ "\nЕсли кнопки не предусмотрены, пишите `no_btns` в поле `button:callback`\\."
		+ "\nНапример, `/createbroadcast Hello | no_btns | 1-5,7,9 | 2025-07-20 12:00`"
		+ "\nДля переноса строки в `message` пишите `\\\\n`\\."
		+ "\nНапример, `/createbroadcast Hello\\\\nWorld! | Hello!:btnHi ; Bye!:btnBye | 1-5,7,9 | 2025-07-20 12:00`",
			{ parse_mode: 'MarkdownV2' });
		
		const msgtext = p[0].trim().replace(/\\n/g, '\n');
		if (!msgtext) return bot.sendMessage(msg.chat.id, "Сообщение не может быть пустым.");
		const uls = p[2];
		const schedtime = p[3];
		
		let btns = [];
		if (p[1].trim() !== "no_btns") {
			const btnpairs = p[1].trim().split(';').map(btn => btn.trim());
			for (const pair of btnpairs) {
				if (!pair.includes(':')) return bot.sendMessage(msg.chat.id, `Неверный формат кнопки ${pair}.`);
				const [text, callback] = pair.split(':');
				if (!text || !callback || callback.includes('_')) return bot.sendMessage(msg.chat.id, `Неверный текст или callback кнопки ${pair}.`);
				btns.push({ text: text.trim(), callback: callback.trim() });
			}
		};
		
		const parseul = (input) => {
			const ids = new Set();
			input.split(',').forEach(range => {
				range = range.trim();
				if (range.includes('-')) {
					const [a, b] = range.split('-').map(Number);
					if (isNaN(a) || isNaN(b)) return null;
					for (let i = a; i <= b; i++) ids.add(i);
				} else {
					if (isNaN(Number(range))) return null;
					ids.add(Number(range));
				}
			});
			return Array.from(ids);
		};
		
		const ul = parseul(uls)
		if (!ul.length) return bot.sendMessage(msg.chat.id, "Не удалось разобрать список получателей.");
		
		const on = await queryAsync(`SELECT id FROM users WHERE id IN (${ul.join(',')})`);
		
		const onids = new Set(on.map(u => u.id));
		const found = ul.filter(id => onids.has(id));
		const notFound = ul.filter(id => !onids.has(id));
		
		if (found.length === 0) return bot.sendMessage(msg.chat.id, "Получатели не найдены. Проверьте список получателей.");
		if (notFound.length > 0) await bot.sendMessage(msg.chat.id, `ID ${notFound.join(', ')} не были найдены. Проверьте список получателей. Рассылка будет отправлена существующим пользователям.`);
			
		const scheddate = new Date(schedtime);
		if (isNaN(scheddate.getTime()))
			return bot.sendMessage(msg.chat.id, "Неверный формат даты (YYYY-MM-DD hh:mm).");
		if (scheddate.getTime() < new Date())
			return bot.sendMessage(msg.chat.id, `Введенное время прошло.\nВы указали ${scheddate}\nСейчас ${new Date()}.`);
		
		const bcdata = {
			message: msgtext,
			buttons: JSON.stringify(btns),
			userList: JSON.stringify(found),
			scheduledAt: schedtime,
			createdAt: new Date()
		};
		
		await queryAsync("INSERT INTO broadcasts SET ?", bcdata);
		const bcid = (await queryAsync("SELECT LAST_INSERT_ID() AS id"))[0].id;
		
		bot.sendMessage(msg.chat.id, `Рассылка №${bcid} создана.`);	
	} catch (err) {
		console.error("Произошла ошибка /createbroadcast\n", err);
		bot.sendMessage(msg.chat.id, "Произошла ошибка при обработке данных.");
	};
});

schedule.scheduleJob('* * * * *', async () => {
	try {
		const now = new Date();
		const bcs = await queryAsync("SELECT * FROM broadcasts WHERE status='pending' AND scheduledAt<=?", [now]);
		
		for (const bc of bcs) {
			const userIds = JSON.parse(bc.userList);
			const btns = JSON.parse(bc.buttons);
			const msg = bc.message;
			const bcid = bc.id;
			
			const inlinebtns = btns.map(btn => ({
				text: btn.text,
				callback_data: `broadcast_${bcid}_${btn.callback}`
			}));
			
			const kbd = {
				reply_markup: {
					inline_keyboard: [inlinebtns]
				}
			};
			
			let cnt = 0;
			for (const userId of userIds) {
				const user = await queryAsync("SELECT chatId FROM users WHERE id=?", [userId]);
				if (!user.length || !user[0].chatId) continue;
				
				try {
					await bot.sendMessage(user[0].chatId, msg, kbd);
					await queryAsync("INSERT INTO events (`userId`, `broadcastId`, `eventType`) VALUES (?, ?, 'sent')", [userId, bcid]);
					cnt++;
				} catch (err) {
					console.error(`Ошибка отправки рассылки пользователю ${userId}`, err);
				};
				
				if (cnt % 30 === 0) await new Promise(res => setTimeout(res, 1000));
			};
			
			await queryAsync("UPDATE broadcasts SET status='sent' WHERE id=?", [bcid]);
			console.log(`Рассылка №${bcid} отправлена ${cnt} клиентам.`);
		};		
	} catch (err) {
		console.error("Произошла ошибка schedule\n", err);
	}
});

bot.on('callback_query', async (query) => {
	try {
		const chatId = query.message.chat.id;
		const data = query.data;
		
		if (data.startsWith('broadcast_')) {
			const [_, bcid, btnid] = data.split('_');
			const user = await queryAsync("SELECT id FROM users WHERE chatId=?", [chatId]);
			const uid = user[0].id;
			
			await queryAsync("INSERT INTO events (userId, broadcastId, eventType, btnCallback) VALUES (?, ?, 'clicked', ?)", [uid, bcid, btnid]);
			
			await bot.editMessageReplyMarkup({
				inline_keyboard: []
			},
			{
				chat_id: chatId,
				message_id: query.message.message_id
			});
			bot.sendMessage(chatId, "Спасибо за Ваш ответ!");
		};
	} catch (err) {
		console.error("Произошла ошибка callback_query\n", err)
	}
});

bot.onText(/\/csv(.*)/i, async (msg, match) => {
	if (!admins.includes(msg.chat.id)) return bot.sendMessage(msg.chat.id, "Вы не являетесь администратором системы.");
	
	try {
		const args = match[1];
		const bcid = Number(args);
	
		if (!args) return bot.sendMessage(msg.chat.id, "Синтаксис: `/csv broadcastId`\\.\n`broadcastId` \\- целое положительное число, смотреть в таблице `events`\\.", { parse_mode: 'MarkdownV2' });
	
		if (isNaN(bcid) || bcid < 0 || !Number.isInteger(bcid)) return bot.sendMessage(msg.chat.id, "Синтаксис: `/csv broadcastId`\\.\n`broadcastId` \\- целое положительное число, смотреть в таблице `events`\\.", { parse_mode: 'MarkdownV2' });
	
		const rows = await queryAsync("SELECT userId, eventType, eventTime, btnCallback FROM events WHERE broadcastId=?", [bcid]);
		
		if (rows.length === 0) return bot.sendMessage(msg.chat.id, "Нет данных для экспорта.");
		
		const filepath = path.join(__dirname, `broadcast_${bcid}.csv`);
		
		const csvWriter = createCsvWriter({
			path: filepath,
			header: [
				{ id: 'userId', title: 'ID пользователя' },
				{ id: 'eventType', title: 'Тип события' },
				{ id: 'eventTime', title: 'Время' },
				{ id: 'btnCallback', title: 'Колбэк кнопки' }
			]
		});
		
		const prows = rows.map(row => ({
			userId: row.userId,
			eventType: row.eventType,
			eventTime: row.eventTime,
			btnCallback: row.btnCallback || 'null'
		}));
		
		await csvWriter.writeRecords(prows);
		
		await bot.sendDocument(msg.chat.id, filepath, {
			filename: `broadcast_${bcid}_events.csv`
		});
		
		fs.unlink(filepath, (err) => { if (err) return bot.sendMessage(msg.chat.id, "Возникла ошибка при удалении файла из корневой папки.\n", err); });
	} catch (err) {
		console.error("Произошла ошибка /csv\n", err);
		bot.sendMessage(msg.chat.id, "Произошла ошибка при создании CSV-файла.\n" + err);
	};
});

process.on('SIGINT', async () => {
	console.log("cltmldb DISCONNECTING");
	await pool.end();
	process.exit(0);
});