const knex = require("../database/knex");

class CsvRepository {
  async findByProductCode(product_code) {
    const product = await knex('products').where('code', product_code).first()
    return product
  }

  async findPackByPackId(pack_id) {
    const pack = await knex('packs').where('pack_id', pack_id)
    return pack
  }

  async findPackByProductId(product_id) {
    const pack = await knex('packs').where('pack_id', product_id)
    return pack
  }
}

module.exports = CsvRepository