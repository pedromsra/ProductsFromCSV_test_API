exports.up = knex => knex.schema.createTable('packs', table => {
  table.increments("id")
  table.integer("pack_id").unsigned()
  table.integer("product_id").unsigned()
  table.integer("qty").notNullable()

  table.foreign('pack_id').references('products.code'),
    table.foreign('product_id').references('products.code')
})

exports.down = knex => knex.schema.dropTable('packs')