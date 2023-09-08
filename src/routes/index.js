const {Router} = require("express");

const priceRoutes = require("./prices.routes")

const routes = Router()

routes.use("/prices", priceRoutes)

module.exports = routes;