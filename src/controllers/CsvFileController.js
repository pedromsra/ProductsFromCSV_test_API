const AppError = require("../utils/AppError");

const knex = require("../database/knex");

const CsvRepository = require("../repositories/CsvRepositories")
const ReadAndConvertCsvFileService = require("../services/ReadAndConvertCsvFileService")
const CheckForErrorsService = require('../services/CheckForErrorsService')

const fs = require('fs');


class PriceController {
  async uploadCSV(req, response) {

    const filename = require.resolve(`../../uploads/${req.files[0].filename}`) //obter arquivo .csv da requisição

    const csvRepository = new CsvRepository();
    const readAndConvertCsvFileService = new ReadAndConvertCsvFileService(csvRepository)
    const checkForErrorsService = new CheckForErrorsService(csvRepository)

    const csvDataRaw = fs.readFileSync(filename, 'utf8', function (err, csv) {
        if (err) {
          throw err
        }
        csv
      }).trim().split(/\r?\n/)

      const csvData = await readAndConvertCsvFileService.execute(csvDataRaw)

      const csvDataAnalised = await checkForErrorsService.execute(csvData)
      
      fs.unlinkSync(filename)
      
      response.json({ products: csvDataAnalised.productsFromCsv, errors: csvDataAnalised.errors })
  }

  async updatePrices(req, res) {
    
    if(req.body.errors && req.body.errors.length) {
      return res.status(401).json('ainda existem erros no arquivo .csv')
    }
    
    const productsToUpdate = req.body.products
    
    let productsFromPacks = []
    let packsFromPacks = []
    let productFromProduct = []
    
    for (let p = 0; p < productsToUpdate.length; p++) {
    
      const productPack = await knex('packs').where({ product_id: productsToUpdate[p].code })
      const pack = await knex('packs').where({ pack_id: productsToUpdate[p].code })
      const product = await knex('products').where({ code: productsToUpdate[p].code }).first()

      productsFromPacks.push(productPack)
      if (productPack.length) {
        for (let pp = 0; pp < productPack.length; pp++) {
          productFromProduct.push({ code: product.code, new_price: productsToUpdate[p].new_price, qty: productPack[pp].qty })
        }
      }
      if (pack.length) {
        for (let pk = 0; pk < pack.length; pk++) {
          packsFromPacks.push({ id: pack[pk].id, pack_id: pack[pk].pack_id, product_id: pack[pk].product_id, qty: pack[pk].qty, new_price: productsToUpdate[p].new_price, itensQty: pack.length })
        }
      }

      if (!product.length && !pack.length) {
        await knex('products').where({ code: productsToUpdate[p].code }).update({ sales_price: productsToUpdate[p].new_price })
      }

      if (pack.length === 1) {
        let newPriceProductFromPack = productsToUpdate[p].new_price / pack[0].qty
        await knex('products').where({ code: pack[0].product_id }).update({ sales_price: newPriceProductFromPack })
        await knex('products').where({ code: pack[0].pack_id }).update({ sales_price: productsToUpdate[p].new_price })
      }
    }

    let packProduct = []

    for (let pack = 0; pack < packsFromPacks.length; pack++) {
      if (packsFromPacks[pack].itensQty <= 1) {
        continue
      }

      let productsFinder = []

      for (let prod = 0; prod < productsFromPacks.length; prod++) {
        if (productsFromPacks[prod].length && packsFromPacks[pack].product_id === productsFromPacks[prod][0].product_id) {
          productsFinder.push({ code: productsFromPacks[prod][0].product_id, qty: productsFromPacks[prod][0].qty })
        } else {
          continue
        }
      }
      if (productsFinder.length) {
        packProduct.push({ pack_id: packsFromPacks[pack].pack_id, code: productsFinder[0].code, qty: productsFinder[0].qty })
      }
    }

    let packsToChange = []

    for (let pack = 0; pack < packsFromPacks.length; pack++) {
      if (packsFromPacks[pack].itensQty <= 1) {
        continue
      }
      for (let pp = 0; pp < packProduct.length; pp++) {
        if (!packsToChange.includes(packsFromPacks[pack].pack_id)) {
          packsToChange.push(packsFromPacks[pack].pack_id)
        }
        if (packsFromPacks[pack].pack_id === packProduct[pp].pack_id) {
          if (packsFromPacks[pack].product_id === packProduct[pp].code) {
            for (let prod = 0; prod < productsToUpdate.length; prod++) {
              if (packProduct[pp].code === productsToUpdate[prod].code) {

                await knex('products').where({ code: packProduct[pp].code }).update({ sales_price: productsToUpdate[prod].new_price })

              }
            }
            pp = packProduct.length
            continue
          } else {
            let aux = packProduct.filter(prod => prod.code === packsFromPacks[pack].product_id)
            if (!aux.length) {
              continue
            }
          }
        } else {
          continue
        }
      }
    }

    for (let prod = 0; prod < productsFromPacks.length; prod++) {
      if (productsFromPacks[prod].length && !packsToChange.includes(productsFromPacks[prod][0].pack_id)) {
        packsToChange.push(productsFromPacks[prod][0].pack_id)
        continue
      }
    }


    let packsToChangeTemp = []

    for (let prod = 0; prod < packsToChange.length; prod++) {
      for (let proc = 0; proc < packsFromPacks.length; proc++) {
        if (packsFromPacks[proc].pack_id === packsToChange[prod] && packsFromPacks[proc].itensQty <= 1) {
          packsToChangeTemp.push(packsToChange[prod])
        }
      }
    }

    let packsToChangeN = packsToChange.filter(pack => !packsToChangeTemp.includes(pack))

    for (let p = 0; p < packsToChangeN.length; p++) {
      let packWithProducts = await knex('packs').where({ pack_id: packsToChangeN[p] })
      let oldProductPack = await knex('products').where({ code: packsToChangeN[p] }).first()


      let productsWithNewPrice = packWithProducts.filter(product => {
        let productFromUpdate = productsToUpdate.filter(prod => product.product_id === prod.code)
        if (productFromUpdate.length) {
          return product
        }
      }
      )
      let productsWithoutNewPrice = []



      for (let b = 0; b < productsWithNewPrice.length; b++) {
        for (let a = 0; a < packWithProducts.length; a++) {
          let aux2 = productsToUpdate.map(p => {
            if (p.code === packWithProducts[a].product_id) {
              return true
            } else {
              return null
            }
          })

          if (!aux2.includes(true)) {
            if (packWithProducts[a].product_id !== productsWithNewPrice[b].product_id) {
              productsWithoutNewPrice.push(packWithProducts[a])
              a = packWithProducts.length
            } else {
              continue
            }
          }
        }
      }

      let sumOfProductsWithNewPrice = null
      let sumOfProductsWthoutNewPrice = null

      for (let pn = 0; pn < productsWithNewPrice.length; pn++) {
        for (let pp = 0; pp < productFromProduct.length; pp++) {
          if (productsWithNewPrice[pn].product_id === productFromProduct[pp].code) {

            sumOfProductsWithNewPrice += productFromProduct[pp].new_price * productFromProduct[pp].qty
          }
        }
      }


      for (let pn = 0; pn < productsWithoutNewPrice.length; pn++) {
        let { sales_price } = await knex('products').where({ code: productsWithoutNewPrice[pn].product_id }).first()
        for (let pack = 0; pack < packWithProducts.length; pack++) {
          if (packWithProducts[pack].product_id === productsWithNewPrice[pn].product_id) {
            sumOfProductsWthoutNewPrice += sales_price * packWithProducts[pack].qty
          }
        }
      }


      if (!productsWithoutNewPrice.length) { //se todos os produtos do pack foram alterados pelo .csv
        await knex('products').where({ code: packsToChangeN[p] }).update({ sales_price: Number(sumOfProductsWithNewPrice.toFixed(2)) })
      } else { //Se existem produtos que nao foram alterados pelo arquivo .csv
        let sumOfProducts = Number((sumOfProductsWithNewPrice + sumOfProductsWthoutNewPrice).toFixed(2)) //soma total dos valores
        let packNewPrice = productsToUpdate.filter(product => product.code === packsToChangeN[p])
        if (packNewPrice.length) { //se é informado novo valor para o pack
          await knex('products').where({ code: packsToChangeN[p] }).update({ sales_price: packNewPrice[0].new_price }) //enviar novo valor do pack para o servidor
          if (sumOfProducts !== packNewPrice[0].new_price) { //se o somatorio for diferente do novo valor informado no arquivo .csv
            for (let prod = 0; prod < productsWithoutNewPrice.length; prod++) { //paraa cada produto que não possui novo valor
              let { sales_price } = await knex('products').where({ code: productsWithoutNewPrice[prod].product_id }).first() //pegar valor original
              let relativePrice = (sales_price * productsWithoutNewPrice[prod].qty) / sumOfProductsWthoutNewPrice // obter % desse valor, referente aos valores sem atualização
              let new_price = null

              new_price = Number((((packNewPrice[0].new_price - sumOfProductsWithNewPrice) / productsWithoutNewPrice[prod].qty) * relativePrice).toFixed(2)) //PARA CADA COMPONENTE DO PACOTE QUE NAO TEM NOVO PREÇO, CALCULAR
              await knex('products').where({ code: productsWithoutNewPrice[prod].product_id }).update({ sales_price: new_price })
            }
            for (let prod = 0; prod < productsWithNewPrice.length; prod++) { //para cada produto que possui valor
              let productNewPrice = productsToUpdate.filter(product => product.code === productsWithNewPrice[prod].product_id)
              await knex('products').where({ code: productsWithNewPrice[prod].product_id }).update({ sales_price: productNewPrice[0].new_price })
            }
          }
        } else { //se nao é informado novo valor para o pack
          await knex('products').where({ code: packsToChangeN[p] }).update({ sales_price: sumOfProducts }) //enviar novo valor do pack para o servidor
          for (let prod = 0; prod < productsWithNewPrice.length; prod++) { //para cada produto que possui valor
            let productNewPrice = productsToUpdate.filter(product => product.code === productsWithNewPrice[prod].product_id)
            await knex('products').where({ code: productsWithNewPrice[prod].product_id }).update({ sales_price: productNewPrice[0].new_price })
          }
          for (let prod = 0; prod < productsWithoutNewPrice.length; prod++) { //paraa cada produto que não possui novo valor no pack
            let { sales_price } = await knex('products').where({ code: productsWithoutNewPrice[prod].product_id }).first() //pegar valor original
            let relativePrice = (sales_price * productsWithoutNewPrice[prod].qty) / sumOfProductsWthoutNewPrice // obter % desse valor, referente aos valores sem atualização
            let new_price = null

            new_price = Number((((sumOfProducts - sumOfProductsWithNewPrice) / productsWithoutNewPrice[prod].qty) * relativePrice).toFixed(2)) //PARA CADA COMPONENTE DO PACOTE QUE NAO TEM NOVO PREÇO, CALCULAR
            await knex('products').where({ code: productsWithoutNewPrice[prod].product_id }).update({ sales_price: new_price })
          }
        }
      }
    }
    
    return res.status(201).json(`Foram atualizados ${productsToUpdate.length} produtos, seus pacotes e subprodutos`)
  }
}

module.exports = PriceController
