const tgbot = require('node-telegram-bot-api');
const mysql = require('mysql2');

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

bot.onText(/\/start/i, async (msg) => {
	if (admins.includes(msg.chat.id)) {
		const data = await queryAsync("SELECT * FROM admins WHERE chatId=?", [msg.chat.id]);
		return bot.sendMessage(msg.chat.id, `Добро пожаловать, администратор ${data[0].username}!`);
	};
	
	await queryAsync("INSERT IGNORE INTO users (`chatId`, `username`) VALUES (?, ?)", [msg.chat.id, msg.chat.username]);		
	bot.sendMessage(msg.chat.id, "Добро пожаловать! Вы зарегистрированы.");
});

//admin

bot.onText(/\/createbroadcast (.+)/i, async (msg, match) => {
	if (!admins.includes(msg.chat.id)) return bot.sendMessage(msg.chat.id, "Вы не являетесь администратором системы.");
	
	const p = match[1].split('|');
	if (p.length < 2) return bot.sendMessage(msg.chat.id, "syntax\\: `/createbroadcast message | button1:callback1`", { parse_mode: 'MarkdownV2' });
	
	const msgtext = p[0].trim();
	
	let buttons = [];
	if (p[1].trim() !== "no_buttons") buttons = p[1].trim().split(',').map(btn => {
		const [text, callback] = btn.split(':');
		return { text: text.trim(), callback: callback.trim() };
	});
	
	const bcdata = {
		message: msgtext,
		buttons: JSON.stringify(buttons),
		scheduled_time: new Date()
	};
	
	await queryAsync("INSERT INTO broadcasts SET ?", bcdata);
	const bcid = (await queryAsync("SELECT LAST_INSERT_ID() AS id"))[0].id;
	
	bot.sendMessage(msg.chat.id, `Рассылка №${bcid} создана.`);
});

bot.onText(/\/sendbroadcast (\d+)/i, async (msg, match) => {
	if (!admins.includes(msg.chat.id)) return bot.sendMessage(msg.chat.id, "Вы не являетесь администратором системы.");
	
	const bcid = match[1]
	const bc = await queryAsync("SELECT * FROM broadcasts WHERE id=?", [bcid]);
	if (!bc.length) return bot.sendMessage(msg.chat.id, "Рассылка не найдена.");
	
	const data = bc[0];
	const users = await queryAsync("SELECT chatId FROM users");
	const buttons = JSON.parse(data.buttons);
	
	const inlinebtns = buttons.map(btn => ({
		text: btn.text,
		callback_data: `broadcast_${bcid}_${btn.callback}`
	}));
	
	const kbd = {
		reply_markup: {
			inline_keyboard: [inlinebtns]
		}
	};
	
	let cnt = 0;
	for (const user of users) {
		await bot.sendMessage(user.chatId, data.message, kbd);
		await queryAsync("INSERT INTO events (`chatId`, `broadcastId`, `eventType`) VALUES (?, ?, 'sent')", [user.chatId, bcid]);
		cnt++;
		
		if (cnt % 30 === 0) await new Promise(res => setTimeout(res, 1000));
	};
	
	await queryAsync("UPDATE broadcasts SET status='sent' WHERE id=?", [bcid]);
	bot.sendMessage(msg.chat.id, `Рассылка №${bcid} отправлена ${cnt} клиентам.`);
});

bot.on('callback_query', async (query) => {
	const chatId = query.message.chat.id
	const data = query.data;
	
	if (data.startsWith('broadcast_')) {
		const [_, broadcastId, buttonId] = data.split('_');
		await queryAsync("INSERT INTO events (chatId, broadcastId, eventType, btnCallback) VALUES (?, ?, 'clicked', ?)", [chatId, broadcastId, buttonId]);
	};
});

bot.onText(/\csv (\d+)/i, async (msg, match) => {
	if (!admins.includes(msg.chat.id)) return bot.sendMessage(msg.chat.id, "Вы не являетесь администратором системы.");
	
	const bcid = match[1];
	
	try {
		const rows = await queryAsync("SELECT chatId, eventType, eventTime FROM events WHERE broadcastId=?", [bcid]);
		
		if (rows.length === 0) return bot.sendMessage(msg.chat.id, "нет данных для экспорта.");
		
		const filepath = path.join(__dirname, `broadcast_${bcid}.csv`);
		
		const csvWriter = createCsvWriter({
			path: filepath,
			header: [
				{ id: 'chatId', title: 'ID чата' },
				{ id: 'eventType', title: 'Тип события' },
				{ id: 'eventTime', title: 'Время' },
				{ id: 'btnCallback', title: 'Колбэк кнопки' }
			]
		});
		
		//await csvWriter.writeRecords(rows).then(() => bot.sendMessage(msg.chat.id, "CSV-файл сохранен в корневой папке проекта."));
		await csvWriter.writeRecords(rows);
	} catch (err) {
		bot.sendMessage(msg.chat.id, "Произошла ошибка при создании CSV-файла.");
	};
});

process.on('SIGINT', async () => {
	console.log("cltmldb DISCONNECTING");
	await pool.end();
	process.exit(0);
});