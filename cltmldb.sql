CREATE TABLE users (
    chatId BIGINT PRIMARY KEY,
    username VARCHAR(255),
    registeredAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE broadcasts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    message TEXT NOT NULL,
    buttons JSON,
    scheduledTime DATETIME,
    status ENUM('pending', 'sent', 'cancelled') DEFAULT 'pending'
);

CREATE TABLE events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    chatId BIGINT,
    broadcastId INT,
    eventType ENUM('sent', 'clicked'),
    eventTime DATETIME DEFAULT CURRENT_TIMESTAMP,
	btnCallback VARCHAR(255),
    FOREIGN KEY (chat_id) REFERENCES users(chat_id),
    FOREIGN KEY (broadcast_id) REFERENCES broadcasts(id)
);

CREATE EVENT IF NOT EXISTS delete_old_events
ON SCHEDULE EVERY 1 DAY
DO
DELETE FROM events WHERE event_time < NOW() - INTERVAL 1 YEAR;