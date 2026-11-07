CREATE TABLE `mds_site_visits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitorHash` varchar(64) NOT NULL,
	`visitDay` date NOT NULL,
	`path` varchar(120) NOT NULL DEFAULT '/',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mds_site_visits_id` PRIMARY KEY(`id`),
	CONSTRAINT `site_visits_visitor_day` UNIQUE(`visitorHash`,`visitDay`)
);
