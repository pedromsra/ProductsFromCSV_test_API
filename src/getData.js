const fs = require('fs')

const knex = require("./database/knex/index")

const filename = require.resolve('../assets/database.sql')

const defaultData = fs.readFileSync(filename, 'utf8', function (err, sql) {
  if (err) {
    throw err
  }
  sql
}).split(/\r?\n/).filter(insert => insert.includes('INSERT INTO'))

const prodUp = async () => {
  try {
    const productsData = defaultData.filter(products => products.includes('products VALUES'))
    productsData.forEach(async (product) => {
      const code = Number(product.substring(product.indexOf('(') + 1, product.indexOf(')')).split(',')[0])

      const codeCheck = await knex('products')
        .where({ code })
        .first()

      if (codeCheck) {
        return
      } else {
        await knex.raw(product)
      }
    })
  } catch (e) {
    console.log(e)
  }
}

const packUp = async () => {
  try {
    const packsData = defaultData.filter(packs => packs.includes('INTO packs'))
    for(let pack = 0; pack < packsData.length; pack++) {
      const pack_infos = {
        pack_id: Number(packsData[pack].substring(packsData[pack].indexOf('VALUES (') + 8, packsData[pack].indexOf(');')).split(',')[0]),
        product_id: Number(packsData[pack].substring(packsData[pack].indexOf('VALUES (') + 8, packsData[pack].indexOf(');')).split(',')[1]),
        qty: Number(packsData[pack].substring(packsData[pack].indexOf('VALUES (') + 8, packsData[pack].indexOf(');')).split(',')[2])
      }
      const packIdCheck = await knex('packs')
        .where({ pack_id: pack_infos.pack_id, product_id: pack_infos.product_id, qty: pack_infos.qty })
        .first()
        
        if (packIdCheck) {
          return
        } else {
        await knex.raw(packsData[pack])
      }
    }
  } catch (e) {
    console.log(e)
  }
}

module.exports = { prodUp, packUp }