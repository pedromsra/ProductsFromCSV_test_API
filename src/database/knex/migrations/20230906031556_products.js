exports.up = knex => knex.schema.createTable('products', table => {
  table.increments("code")
  table.string("name", 100).notNullable()
  table.decimal("cost_price", 9, 2).notNullable()
  table.decimal("sales_price", 9, 2).notNullable()
})

exports.down = knex => knex.schema.dropTable('products')