const AppError = require("../utils/AppError");

const knex = require("../database/knex");

const fs = require('fs')


class PriceController {
  async uploadCSV(req, response) {

    const filename = require.resolve(`../../uploads/${req.files[0].filename}`) //obter arquivo .csv da requisição

    try {

      const csvData = fs.readFileSync(filename, 'utf8', function (err, csv) {
        if (err) {
          throw err
        }
        csv
      }).trim().split(/\r?\n/).splice(1)

      let productsFromCsv = [] //lista dos produtos com os respectivos novos valores
      let errors = []
      let commaError = [] //lista para armazenas as linhas que apresentarem virgula no lugar de ponto para decimais
      let fieldsError = [] //lista para armazenar linhas com informações ausentes


      //Ler a array de strings para converter numa array de objetos {code, name, cost_price, sales_price, new_price}
      for (let d = 0; d < csvData.length; d++) {
        let dataToUpdate = csvData[d].split(',')
        if (dataToUpdate.length > 2) {
          commaError.push(d + 2)
        }
        if (dataToUpdate.length !== 2) {
          fieldsError.push(d + 2)
        }

        let test = await knex('products').where('code', Number(dataToUpdate[0])).first()

        if (test !== undefined) {
          let { code, name, cost_price, sales_price } = await knex('products').where('code', Number(dataToUpdate[0])).first()
          let new_price = Number(Number(dataToUpdate[1]).toFixed(2))
          productsFromCsv.push({ code, name, cost_price, sales_price, new_price })
        } else {
          errors.push({ error: `Produto de código ${Number(dataToUpdate[0])} não encontrado (linha ${d + 2} do arquivo .csv)`, code: Number(dataToUpdate[0]) })
        }
      }

      //Verificações de presença de (,) e ausência de informação, gerando os respectivos erros

      if (commaError.length) {
        errors.push({ error: `Porfavor, utilize o ponto(.) como identificador decial e não a virgula(,). Foram identificados erros nas linhas ${commaError} do seu arquivo .CSV` })
      }

      if (fieldsError.length) {
        errors.push({ error: `Por favor, informe apenas o código do produto e o novo valor (R$) a ser atualizado` })
      }


      for (let d = 0; d < productsFromCsv.length; d++) {
        if (productsFromCsv[d].new_price <= productsFromCsv[d].cost_price) {
          errors.push({ error: `O novo preço de venda de ${productsFromCsv[d].code} - ${productsFromCsv[d].name} está abaixo de seu custo`, code: productsFromCsv[d].code, name: productsFromCsv[d].name })
        }

        if (Number((productsFromCsv[d].new_price).toFixed(2)) < Number((productsFromCsv[d].sales_price * 0.9).toFixed(2))) {
          errors.push({ error: `O novo preço de venda de ${productsFromCsv[d].code} - ${productsFromCsv[d].name} está muito abaixo de seu preço atual (<90% ou <R$ ${(productsFromCsv[d].sales_price * 0.9).toFixed(2)})`, code: productsFromCsv[d].code, name: productsFromCsv[d].name })
        }

        if (Number((productsFromCsv[d].new_price).toFixed(2)) > Number((productsFromCsv[d].sales_price * 1.1).toFixed(2))) {
          errors.push({ error: `O novo preço de venda de ${productsFromCsv[d].code} - ${productsFromCsv[d].name} está muito acima de seu preço atual (>110% ou >R$ ${(productsFromCsv[d].sales_price * 1.1).toFixed(2)})`, code: productsFromCsv[d].code, name: productsFromCsv[d].name })
        }

        let test = await knex('packs').where({ pack_id: productsFromCsv[d].code })

        let packCheck = null

        let productsFromPack = [] //produtos que compões o pack
        let productsFromPackList = [] //lista de codigo de produtos que compõe o pack, para exibir no relatorio de erros
        let productsFromPackToUpdate = [] //lista de produtos do pack que também estão sendo atualizados pelo .csv, simultâneamente
        let productsFromPackToUpdateList = [] //lista de codigo do pack que também estão sendo atualizados pelo .csv, simultanemante, para exibir no relatório de erros.

        if (test !== undefined) {
          packCheck = await knex('packs').where({ pack_id: productsFromCsv[d].code }) //verificar se o produto é um pack

          if (packCheck.length) {
            packCheck.forEach(pack => {
              productsFromCsv.forEach(product => {
                if (pack.product_id === product.code) {
                  if (packCheck.length > 1) {
                    productsFromPackToUpdate.push({ code: product.code, new_price: product.new_price })
                    productsFromPackToUpdateList.push(product.code)
                  } else {
                    if (Number((productsFromCsv[d].new_price / pack.qty).toFixed(2)) !== product.new_price) {
                      errors.push({ error: `O pack ${pack.pack_id} - ${productsFromCsv[d].name} está com novo valor de R$ ${productsFromCsv[d].new_price} (R$ ${(productsFromCsv[d].new_price / pack.qty).toFixed(2)}/und) e o prduto que compões o pack ${product.code} - ${product.name} está com novo valor sugerido de R$ ${(product.new_price).toFixed(2)}, os valores unitários estão divergentes` })
                    }
                  }
                }
              })
            });
          }
        }

        if (packCheck.length > 1) {

          for (let p = 0; p < packCheck.length; p++) {
            let test = await knex('products').where({ code: packCheck[p].product_id }).first()

            if (test !== undefined) {
              let { code, name, cost_price, sales_price } = await knex('products').where({ code: packCheck[p].product_id }).first()
              productsFromPack.push({ code, name, cost_price, sales_price, qty: packCheck[p].qty })
              productsFromPackList.push(code)
            }
          }

          let packPriceCheck = 0
          let aux = 0

          productsFromPack.forEach((pPack, index) => {
            productsFromPackToUpdate.forEach(pUpdate => {
              if (pUpdate.code === pPack.code) {
                packPriceCheck += Number((pUpdate.new_price).toFixed(2)) * pPack.qty
                aux++
              }
            })
            if (aux === index) {
              packPriceCheck += Number((pPack.sales_price).toFixed(2)) * pPack.qty
              aux++
            }
          })

          if (packPriceCheck !== Number((productsFromCsv[d].new_price).toFixed(2))) {
            errors.push({ error: `O pack ${productsFromCsv[d].code} - ${productsFromCsv[d].name} de produtos de código ${productsFromPackList} está com valor divergente do somatório de seus componentes. Foi sugerida alteração dos componentes de código ${productsFromPackToUpdateList}`, code: productsFromCsv[d].code, name: productsFromCsv[d].name })
          }
        }
      }

      fs.unlinkSync(filename)

      const productsToUpdate = productsFromCsv.map(product => {
        if (Object.keys(product).includes('error')) {
          return { code: product.code, name: product.name, sales_price: product.sales_price, new_price: product.new_price, error: product.error }
        } else {
          return { code: product.code, name: product.name, sales_price: product.sales_price, new_price: product.new_price }
        }
      })

      const errorLog = productsToUpdate.filter(product => {
        if (Object.keys(product).includes('error')) {
          return { error: product.error }
        }
      })

      if (errorLog.length) {
        response.json({ error: errorLog })
      } else {
        response.json({ products: productsToUpdate, errors })
      }
    }
    catch (e) {
      fs.unlinkSync(filename)
      throw new AppError(e, 401)
    }

  }

  async updatePrices(req, res) {
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