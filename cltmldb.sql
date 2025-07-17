CREATE TABLE users (
	id INT AUTO_INCREMENT PRIMARY KEY,
    chatId BIGINT NOT NULL,
    username VARCHAR(255),
    registeredAt DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE broadcasts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    message TEXT NOT NULL,
    buttons JSON,
	userList JSON NOT NULL, -- хранение id (не chatId)
    scheduledAt DATETIME NOT NULL,
	createdAt DATETIME NOT NULL,
    status ENUM('pending', 'sent') DEFAULT 'pending' NOT NULL
);

CREATE TABLE events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    broadcastId INT NOT NULL,
    eventType ENUM('sent', 'clicked') NOT NULL,
    eventTime DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	btnCallback VARCHAR(255),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (broadcastId) REFERENCES broadcasts(id) ON DELETE CASCADE
);

CREATE TABLE admins (
	id INT AUTO_INCREMENT PRIMARY KEY,
	chatId BIGINT NOT NULL,
	username VARCHAR(255) NOT NULL
);

CREATE EVENT IF NOT EXISTS deleteOldEvents
ON SCHEDULE EVERY 1 DAY
DO
DELETE FROM events WHERE eventTime < NOW() - INTERVAL 1 YEAR;

SET GLOBAL event_scheduler="ON"