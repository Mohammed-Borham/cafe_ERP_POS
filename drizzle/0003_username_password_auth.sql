ALTER TABLE `users`
  ADD COLUMN `username` varchar(64) NULL,
  ADD COLUMN `passwordHash` varchar(128) NULL,
  ADD COLUMN `passwordSalt` varchar(64) NULL,
  ADD COLUMN `failedLoginAttempts` int NOT NULL DEFAULT 0,
  ADD COLUMN `lockedUntil` timestamp NULL,
  ADD UNIQUE KEY `users_username_uq` (`username`);
