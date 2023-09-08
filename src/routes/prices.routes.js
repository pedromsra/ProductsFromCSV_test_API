const { Router } = require('express')

const multer = require("multer")

const upload = multer({ dest: "uploads/" })

const CsvFileController = require("../controllers/CsvFileController")

const priceRoutes = Router() //iniciando o router

const csvFileController = new CsvFileController()

priceRoutes.post("/", upload.array("files"), csvFileController.uploadCSV)
priceRoutes.post("/update", upload.array("files"), csvFileController.updatePrices)

module.exports = priceRoutes;