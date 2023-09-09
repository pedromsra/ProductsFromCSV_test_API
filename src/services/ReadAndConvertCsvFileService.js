class ReadAndConvertCsvFileService {

  constructor(csvRepository) {
    this.csvRepository = csvRepository
  }

  async execute(csvDataRaw) {
    const csvData = csvDataRaw.splice(1)

    let productsFromCsv = [] //lista dos produtos com os respectivos novos valores
    let errors = []
    if (csvDataRaw[0] !== 'product_code,new_price') {
      errors.push('cabeçalho ausente ou errado')
    }

    //Ler a array de strings para converter numa array de objetos {code, name, cost_price, sales_price, new_price}
    for (let d = 0; d < csvData.length; d++) {
      let dataToUpdate = csvData[d].split(',')
      if (dataToUpdate.length > 2) {
        errors.push({ error: `Porfavor, utilize o ponto(.) como identificador decial e não a virgula(,). Foi identificado erros na linha ${d + 2} do seu arquivo .CSV` })
        continue
      }
      if (dataToUpdate.length !== 2) {
        errors.push({ error: `Por favor, informe apenas o código do produto e o novo valor (R$) a ser atualizado` })
        continue
      }
      
      let test = await this.csvRepository.findByProductCode(Number(dataToUpdate[0]))
      
      if (test !== undefined) {
        let { code, name, cost_price, sales_price } = await this.csvRepository.findByProductCode(Number(dataToUpdate[0]))
        let new_price = Number(Number(dataToUpdate[1]).toFixed(2))
        productsFromCsv.push({ code, name, cost_price, sales_price, new_price })
      } else {
        errors.push({ error: `Produto de código ${Number(dataToUpdate[0])} não encontrado (linha ${d + 2} do arquivo .csv)`, code: Number(dataToUpdate[0]) })
      }
    }

    //Verificações de presença de (,) e ausência de informação, gerando os respectivos erros
    
    return {productsFromCsv, errors}
    
  }
}

module.exports = ReadAndConvertCsvFileService