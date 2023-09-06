const path = require("path");

	module.exports = {

		development: {
			client: 'mysql',
			connection: {
        host: '127.0.0.1',
        user: 'root',
        password: 'Al12($*)',
        database: 'shopper'
			},
			migrations: {
				directory: path.resolve(__dirname, "src", "database", "knex", "migrations")
			},
			useNullAsDefault: true
		}
	};