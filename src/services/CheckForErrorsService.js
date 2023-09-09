class CheckForErrorsService {
  constructor(csvRepository){
    this.csvRepository = csvRepository
  }
  
  async execute(csvData){
    for (let d = 0; d < csvData.productsFromCsv.length; d++) {
      if (csvData.productsFromCsv[d].new_price <= csvData.productsFromCsv[d].cost_price) {
        csvData.errors.push({ error: `O novo preço de venda de ${csvData.productsFromCsv[d].code} - ${csvData.productsFromCsv[d].name} está abaixo de seu custo`, code: csvData.productsFromCsv[d].code, name: csvData.productsFromCsv[d].name })
      }

      if (Number((csvData.productsFromCsv[d].new_price).toFixed(2)) < Number((csvData.productsFromCsv[d].sales_price * 0.9).toFixed(2))) {
        csvData.errors.push({ error: `O novo preço de venda de ${csvData.productsFromCsv[d].code} - ${csvData.productsFromCsv[d].name} está muito abaixo de seu preço atual (<90% ou <R$ ${(csvData.productsFromCsv[d].sales_price * 0.9).toFixed(2)})`, code: csvData.productsFromCsv[d].code, name: csvData.productsFromCsv[d].name })
      }

      if (Number((csvData.productsFromCsv[d].new_price).toFixed(2)) > Number((csvData.productsFromCsv[d].sales_price * 1.1).toFixed(2))) {
        csvData.errors.push({ error: `O novo preço de venda de ${csvData.productsFromCsv[d].code} - ${csvData.productsFromCsv[d].name} está muito acima de seu preço atual (>110% ou >R$ ${(csvData.productsFromCsv[d].sales_price * 1.1).toFixed(2)})`, code: csvData.productsFromCsv[d].code, name: csvData.productsFromCsv[d].name })
      }

      let test = await this.csvRepository.findPackByPackId(csvData.productsFromCsv[d].code)

      let packCheck = null
      
      let productsFromPack = [] //produtos que compões o pack
      let productsFromPackList = [] //lista de codigo de produtos que compõe o pack, para exibir no relatorio de erros
      let productsFromPackToUpdate = [] //lista de produtos do pack que também estão sendo atualizados pelo .csv, simultâneamente
      let productsFromPackToUpdateList = [] //lista de codigo do pack que também estão sendo atualizados pelo .csv, simultanemante, para exibir no relatório de erros.

      if (test !== undefined) {
        packCheck = await this.csvRepository.findPackByPackId(csvData.productsFromCsv[d].code) //verificar se o produto é um pack

        if (packCheck.length) {
          packCheck.forEach(pack => {
            csvData.productsFromCsv.forEach(product => {
              if (pack.product_id === product.code) {
                if (packCheck.length > 1) {
                  productsFromPackToUpdate.push({ code: product.code, new_price: product.new_price })
                  productsFromPackToUpdateList.push(product.code)
                } else {
                  if (Number((csvData.productsFromCsv[d].new_price / pack.qty).toFixed(2)) !== product.new_price) {
                    csvData.errors.push({ error: `O pack ${pack.pack_id} - ${csvData.productsFromCsv[d].name} está com novo valor de R$ ${csvData.productsFromCsv[d].new_price} (R$ ${(csvData.productsFromCsv[d].new_price / pack.qty).toFixed(2)}/und) e o prduto que compões o pack ${product.code} - ${product.name} está com novo valor sugerido de R$ ${(product.new_price).toFixed(2)}, os valores unitários estão divergentes` })
                  }
                }
              }
            })
          });
        }
      }
      
      if (packCheck.length > 1) {

        for (let p = 0; p < packCheck.length; p++) {

          let test = await this.csvRepository.findByProductCode(packCheck[p].product_id)

          if (test !== undefined) {
            let { code, name, cost_price, sales_price } = await this.csvRepository.findByProductCode(packCheck[p].product_id)
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
        
        if (Number((packPriceCheck).toFixed(2)) !== Number((csvData.productsFromCsv[d].new_price).toFixed(2))) {
          console.log(packPriceCheck, Number((csvData.productsFromCsv[d].new_price).toFixed(2)))
          csvData.errors.push({ error: `O pack ${csvData.productsFromCsv[d].code} - ${csvData.productsFromCsv[d].name} de produtos de código ${productsFromPackList} está com valor divergente do somatório de seus componentes. Foi sugerida alteração dos componentes de código ${productsFromPackToUpdateList}`, code: csvData.productsFromCsv[d].code, name: csvData.productsFromCsv[d].name })
        }
      }
    }

    return csvData
  }
}

module.exports = CheckForErrorsService