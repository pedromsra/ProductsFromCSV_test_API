const path = require("path");
require("dotenv/config")

	module.exports = {

		development: {
			client: 'mysql',
			connection: {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: 'shopper'
			},
			migrations: {
				directory: path.resolve(__dirname, "src", "database", "knex", "migrations")
			},
			useNullAsDefault: true
		}
	};