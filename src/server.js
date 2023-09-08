require("express-async-errors");
require("dotenv/config")

const express = require("express");

const cors = require("cors");

const routes = require("./routes")

const AppError = require("./utils/AppError");

const { prodUp, packUp } = require('./getData')

const app = express();

app.use(express.json())

app.use(cors())

app.use(routes)


prodUp()
packUp()

app.use((error, request, response, next) => {
  if (error instanceof AppError) {
    return response.status(error.statusCode).json({
      status: "error",
      message: error.message
    });
  }

  return response.status(500).json({
    status: "error",
    message: "internal server error"
  })
})

const PORT = process.env.PORT || 3010;

app.listen(PORT, () => console.log(`Running on Port: ${PORT}`))